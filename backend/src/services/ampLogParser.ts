/**
 * AmpLogParser - Parses amp JSONL log files and converts to ThreadMessage objects
 * Based on the parsing documentation in docs/parsing_amp_logs.md
 */

import {
  AmpLogEntry,
  AmpThread,
  AmpMessage,
  AmpContent,
  ThreadMessage,
  MessageType,
  MessageCallback,
  ParserState
} from '../types/threadMessage';
import {
  generateMessageId,
  parseTimestamp,
  cleanContent,
  formatToolUsage,
  isValidJson,
  safeJsonParse,
  extractFilesFromMetadata,
  determineMetadataType
} from '../utils/logParsingUtils';
import { logger } from '../utils/logger';

const parserLogger = logger.child('AmpLogParser');

export class AmpLogParser {
  private workerId: string;
  private onMessage: MessageCallback;
  private state: ParserState;

  constructor(workerId: string, onMessage: MessageCallback) {
    this.workerId = workerId;
    this.onMessage = onMessage;
    this.state = {
      lastThreadUpdate: new Date(),
      conversationProcessed: false,
      seenMessageIDs: new Set(),
      threadID: '',
      threadTitle: ''
    };
  }

  /**
   * Parse a single line from amp log file
   */
  parseLine(line: string): void {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      return;
    }

    try {
      if (!isValidJson(trimmedLine)) {
        return; // Skip non-JSON lines
      }

      const logEntry = safeJsonParse<Partial<AmpLogEntry>>(trimmedLine, {});
      if (!logEntry.timestamp || !logEntry.level || !logEntry.message) {
        return; // Skip entries without required fields
      }

      const timestamp = parseTimestamp(logEntry.timestamp);

      // Process different types of log entries
      this.processLogEntry(logEntry as AmpLogEntry, timestamp);

    } catch (error) {
      parserLogger.debug('Error parsing log line', {
        workerId: this.workerId,
        line: trimmedLine.substring(0, 100),
        error: (error as Error).message
      });
    }
  }

  /**
   * Process a parsed log entry
   */
  private processLogEntry(logEntry: AmpLogEntry, timestamp: Date): void {
    // Process events
    if (logEntry.event) {
      this.processEvent(logEntry.event, timestamp, logEntry);
    }

    // Process marked output (assistant responses)
    if (logEntry.message === 'marked output' && logEntry.out) {
      this.processAssistantOutput(logEntry.out, timestamp);
    }

    // Process piped input (user messages from continue operations)
    if (logEntry.pipedInput) {
      this.processUserInput(logEntry.pipedInput, timestamp);
    }
  }

  /**
   * Process event-based log entries
   */
  private processEvent(event: any, timestamp: Date, logEntry?: AmpLogEntry): void {
    switch (event.type) {
      case 'thread-state':
        if (event.thread) {
          this.updateThreadState(event.thread, timestamp);
        }
        break;

      case 'message':
        if (event.message) {
          this.processIncrementalMessage(event.message, timestamp);
        }
        break;

      case 'accept-message':
        // Process piped input from accept-message events (as per docs)
        if (logEntry?.pipedInput) {
          this.processUserInput(logEntry.pipedInput, timestamp);
        }
        break;

      case 'thread-title':
        if (event.title) {
          this.updateThreadTitle(event.title);
        }
        break;

      case 'thread-created':
        if (event.thread) {
          this.updateThreadState(event.thread, timestamp);
        }
        break;

      case 'thread-updated':
        if (event.thread) {
          this.updateThreadState(event.thread, timestamp);
        }
        break;

      default:
        parserLogger.debug('Unknown event type', {
          workerId: this.workerId,
          eventType: event.type
        });
    }
  }

  /**
   * Update thread state from thread-state events
   */
  private updateThreadState(thread: AmpThread, timestamp: Date): void {
    this.state.latestThread = thread;
    this.state.lastThreadUpdate = timestamp;
    this.state.threadID = thread.id;
    this.state.threadTitle = thread.title || '';
    this.state.conversationProcessed = false;

    parserLogger.debug('Updated thread state', {
      workerId: this.workerId,
      threadId: thread.id,
      title: thread.title,
      messageCount: thread.messages?.length || 0
    });
  }

  /**
   * Update thread title
   */
  private updateThreadTitle(title: string): void {
    this.state.threadTitle = title;
  }

  /**
   * Process incremental message events
   */
  private processIncrementalMessage(ampMessage: AmpMessage, timestamp: Date): void {
    this.processMessage(ampMessage, timestamp);
  }

  /**
   * Process user input from piped input
   */
  private processUserInput(input: string, timestamp: Date): void {
    const cleanedInput = cleanContent(input);
    if (cleanedInput) {
      this.emitMessage(MessageType.USER, cleanedInput, timestamp);
    }
  }

  /**
   * Process assistant output from marked output
   */
  private processAssistantOutput(output: string, timestamp: Date): void {
    const cleanedOutput = cleanContent(output);
    if (cleanedOutput) {
      this.emitMessage(MessageType.ASSISTANT, cleanedOutput, timestamp);
    }
  }

  /**
   * Process a single amp message
   */
  private processMessage(ampMessage: AmpMessage, timestamp: Date): void {
    if (!ampMessage.role || !ampMessage.content) {
      return;
    }

    switch (ampMessage.role.toLowerCase()) {
      case 'user':
        this.processUserMessage(ampMessage, timestamp);
        break;
      case 'assistant':
        this.processAssistantMessage(ampMessage, timestamp);
        break;
      case 'system':
        this.processSystemMessage(ampMessage, timestamp);
        break;
      default:
        parserLogger.debug('Unknown message role', {
          workerId: this.workerId,
          role: ampMessage.role
        });
    }
  }

  /**
   * Process user messages
   */
  private processUserMessage(ampMessage: AmpMessage, timestamp: Date): void {
    for (const content of ampMessage.content) {
      if (content.type === 'text' && content.text) {
        const cleanedText = cleanContent(content.text);
        if (cleanedText) {
          this.emitMessage(MessageType.USER, cleanedText, timestamp);
        }
      }
    }
  }

  /**
   * Process assistant messages with multiple content types
   */
  private processAssistantMessage(ampMessage: AmpMessage, timestamp: Date): void {
    // Process thinking content first
    for (const content of ampMessage.content) {
      if (content.type === 'thinking' && content.thinking) {
        const cleanedThinking = cleanContent(content.thinking);
        if (cleanedThinking) {
          this.emitMessage(MessageType.ASSISTANT, cleanedThinking, timestamp, {
            type: 'thinking'
          });
        }
      }
    }

    // Process tool usage
    for (const content of ampMessage.content) {
      if (content.type === 'tool_use' && content.name) {
        const toolDescription = formatToolUsage(content.name, content.input);
        const metadata = {
          type: 'tool_use' as const,
          tool_name: content.name,
          tool_id: content.id,
          input: content.input,
          files: extractFilesFromMetadata(content.input)
        };
        
        this.emitMessage(MessageType.TOOL, toolDescription, timestamp, metadata);
      }
    }

    // Process main text response
    for (const content of ampMessage.content) {
      if (content.type === 'text' && content.text) {
        const cleanedText = cleanContent(content.text);
        if (cleanedText) {
          this.emitMessage(MessageType.ASSISTANT, cleanedText, timestamp);
        }
      }
    }
  }

  /**
   * Process system messages
   */
  private processSystemMessage(ampMessage: AmpMessage, timestamp: Date): void {
    for (const content of ampMessage.content) {
      if (content.type === 'text' && content.text) {
        const cleanedText = cleanContent(content.text);
        if (cleanedText) {
          this.emitMessage(MessageType.SYSTEM, cleanedText, timestamp);
        }
      }
    }
  }

  /**
   * Emit a thread message with deduplication
   */
  private emitMessage(
    type: MessageType,
    content: string,
    timestamp: Date,
    metadata?: any
  ): void {
    const cleanedContent = cleanContent(content);
    if (!cleanedContent) {
      return;
    }

    // Generate deterministic ID for deduplication
    const messageId = generateMessageId(type, cleanedContent, timestamp);

    // Check for duplicates
    if (this.state.seenMessageIDs.has(messageId)) {
      return;
    }
    this.state.seenMessageIDs.add(messageId);

    // Create thread message
    const message: ThreadMessage = {
      id: messageId,
      type,
      content: cleanedContent,
      timestamp,
      metadata: metadata ? {
        ...metadata,
        files: metadata.files?.length > 0 ? metadata.files : undefined
      } : undefined
    };

    // Emit message
    try {
      this.onMessage(message);
    } catch (error) {
      parserLogger.error('Error emitting message', {
        workerId: this.workerId,
        messageId,
        error: (error as Error).message
      });
    }
  }

  /**
   * Process the final conversation from latest thread state
   * Call this after processing all log lines
   */
  processFinalConversation(): void {
    if (this.state.conversationProcessed || !this.state.latestThread) {
      return;
    }

    parserLogger.info('Processing final conversation', {
      workerId: this.workerId,
      threadId: this.state.threadID,
      messageCount: this.state.latestThread.messages?.length || 0
    });

    // Emit thread start message if we have a title
    if (this.state.threadTitle) {
      this.emitMessage(
        MessageType.SYSTEM,
        `Thread: ${this.state.threadTitle}`,
        this.state.lastThreadUpdate,
        {
          thread_id: this.state.threadID,
          thread_title: this.state.threadTitle
        }
      );
    }

    // Process all messages in final conversation
    if (this.state.latestThread.messages) {
      for (const message of this.state.latestThread.messages) {
        this.processMessage(message, this.state.lastThreadUpdate);
      }
    }

    this.state.conversationProcessed = true;
  }

  /**
   * Get parser statistics
   */
  getStats(): {
    threadId: string;
    threadTitle: string;
    messageCount: number;
    conversationProcessed: boolean;
  } {
    return {
      threadId: this.state.threadID,
      threadTitle: this.state.threadTitle,
      messageCount: this.state.seenMessageIDs.size,
      conversationProcessed: this.state.conversationProcessed
    };
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.state = {
      lastThreadUpdate: new Date(),
      conversationProcessed: false,
      seenMessageIDs: new Set(),
      threadID: '',
      threadTitle: ''
    };
  }
}

/**
 * Factory function to create a new parser instance
 */
export function createAmpLogParser(
  workerId: string,
  onMessage: MessageCallback
): AmpLogParser {
  return new AmpLogParser(workerId, onMessage);
}
