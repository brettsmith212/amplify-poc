/**
 * Thread message types and interfaces for amp log parsing
 */

export enum MessageType {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
  TOOL = 'tool'
}

export interface ThreadMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  type?: 'thinking' | 'tool_use' | 'error' | 'file_change';
  tool_name?: string;
  tool_id?: string;
  input?: any;
  files?: string[];
  exitCode?: number;
  [key: string]: any;
}

// Amp log entry structure from parsing docs
export interface AmpLogEntry {
  level: string;
  message: string;
  timestamp: string;
  event?: AmpEvent;
  pipedInput?: string;
  out?: string;
}

export interface AmpEvent {
  type: string;
  thread?: AmpThread;
  message?: AmpMessage;
  [key: string]: any;
}

export interface AmpThread {
  id: string;
  title?: string;
  messages: AmpMessage[];
}

export interface AmpMessage {
  role: string;
  content: AmpContent[];
}

export interface AmpContent {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  id?: string;
  input?: any;
}

// Parser state tracking
export interface ParserState {
  latestThread?: AmpThread;
  lastThreadUpdate: Date;
  conversationProcessed: boolean;
  seenMessageIDs: Set<string>;
  threadID: string;
  threadTitle: string;
}

// Message emission callback
export type MessageCallback = (message: ThreadMessage) => void;
