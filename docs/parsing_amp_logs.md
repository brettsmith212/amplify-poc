# Amp Log Parsing Documentation

This document describes the comprehensive approach to parsing amp's log files (`--log-file`) and propagating parsed messages to a chat UI interface.

## Table of Contents

1. [Amp Log File Structure](#amp-log-file-structure)
2. [Core Parsing Architecture](#core-parsing-architecture)  
3. [Message Types and Processing](#message-types-and-processing)
4. [State Management Patterns](#state-management-patterns)
5. [API Contract for UI Integration](#api-contract-for-ui-integration)
6. [Implementation Examples](#implementation-examples)
7. [Chat Interface Integration](#chat-interface-integration)

## Amp Log File Structure

Amp generates JSON log files when using the `--log-file` flag. Each line contains a JSON object with the following structure:

```json
{
  "level": "info",
  "message": "marked output",
  "timestamp": "2024-12-17T10:30:45.123Z",
  "event": {
    "type": "thread-state",
    "thread": {
      "id": "thread_abc123",
      "title": "Fix authentication bug",
      "messages": [...]
    }
  },
  "pipedInput": "continue with this task",
  "out": "I'll help you fix that authentication issue..."
}
```

### Key Log Entry Fields

- **level**: Log level (info, debug, error, etc.)
- **message**: Log message type ("marked output", event descriptions)
- **timestamp**: ISO 8601 timestamp
- **event**: Contains structured event data
- **pipedInput**: User input from continue operations
- **out**: Assistant output content

### Event Types

1. **thread-state**: Complete thread state with all messages
2. **message**: Individual message events (incremental)
3. **accept-message**: Continue operations with piped input
4. **thread-title**: Thread metadata updates
5. **thread-created**: New thread creation
6. **thread-updated**: Thread state changes

## Core Parsing Architecture

### AmpLogParser Structure

```go
type AmpLogParser struct {
    workerID             string
    onMessage            func(ThreadMessage)
    latestThread         *Thread
    lastThreadUpdate     time.Time
    conversationProcessed bool
    seenMessageIDs       map[string]bool
    threadID             string
    threadTitle          string
}
```

### Parsing Flow

1. **Line-by-Line Processing**: Each log line is parsed as JSON
2. **Event Routing**: Different event types trigger specific handlers
3. **State Management**: Parser maintains thread state and metadata
4. **Deduplication**: Message IDs prevent duplicate processing
5. **Message Emission**: Parsed messages are sent to callback functions

### Core Parsing Logic

```go
func (p *AmpLogParser) ParseLine(line string) {
    line = strings.TrimSpace(line)
    if line == "" {
        return
    }
    
    var logEntry AmpLogEntry
    if err := json.Unmarshal([]byte(line), &logEntry); err != nil {
        return // Skip malformed JSON
    }
    
    // Process events
    if logEntry.Event != nil {
        switch logEntry.Event.Type {
        case "thread-state":
            if logEntry.Event.Thread != nil {
                p.updateThreadState(logEntry.Event.Thread, logEntry.Timestamp)
            }
        case "message":
            if logEntry.Event.Message != nil {
                p.processIncrementalMessage(*logEntry.Event.Message, logEntry.Timestamp)
            }
        case "accept-message":
            if logEntry.PipedInput != "" {
                p.processUserInput(logEntry.PipedInput, logEntry.Timestamp)
            }
        }
    }
    
    // Process marked output (assistant responses)
    if logEntry.Message == "marked output" && logEntry.Out != "" {
        p.processAssistantOutput(logEntry.Out, logEntry.Timestamp)
    }
}
```

## Message Types and Processing

### ThreadMessage Structure

```go
type ThreadMessage struct {
    ID        string                 `json:"id"`
    Type      MessageType            `json:"type"`
    Content   string                 `json:"content"`
    Timestamp time.Time              `json:"timestamp"`
    Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

type MessageType string

const (
    MessageTypeUser      MessageType = "user"
    MessageTypeAssistant MessageType = "assistant" 
    MessageTypeSystem    MessageType = "system"
    MessageTypeTool      MessageType = "tool"
)
```

### Message Processing Patterns

#### 1. User Messages

```go
func (p *AmpLogParser) processUserMessage(ampMsg Message, msgTime time.Time) {
    for _, content := range ampMsg.Content {
        if content.Type == "text" && strings.TrimSpace(content.Text) != "" {
            p.emitMessage(MessageTypeUser, strings.TrimSpace(content.Text), msgTime, nil)
        }
    }
}
```

#### 2. Assistant Messages

Assistant messages can contain multiple content types processed in sequence:

```go
func (p *AmpLogParser) processAssistantMessage(ampMsg Message, msgTime time.Time) {
    // 1. Process thinking content first
    for _, content := range ampMsg.Content {
        if content.Type == "thinking" && strings.TrimSpace(content.Thinking) != "" {
            metadata := map[string]interface{}{"type": "thinking"}
            p.emitMessage(MessageTypeAssistant, content.Thinking, msgTime, metadata)
        }
    }
    
    // 2. Process tool usage
    for _, content := range ampMsg.Content {
        if content.Type == "tool_use" && content.Name != "" {
            toolDescription := p.formatToolUse(content)
            metadata := map[string]interface{}{
                "type":      "tool_use",
                "tool_name": content.Name,
                "tool_id":   content.ID,
                "input":     content.Input,
            }
            p.emitMessage(MessageTypeTool, toolDescription, msgTime, metadata)
        }
    }
    
    // 3. Process main text response
    for _, content := range ampMsg.Content {
        if content.Type == "text" && strings.TrimSpace(content.Text) != "" {
            p.emitMessage(MessageTypeAssistant, content.Text, msgTime, nil)
        }
    }
}
```

#### 3. Tool Usage Formatting

```go
func (p *AmpLogParser) formatToolUse(content Content) string {
    switch content.Name {
    case "create_file":
        if path, ok := content.Input["path"].(string); ok {
            return fmt.Sprintf("Creating file: %s", path)
        }
        return "Creating file"
        
    case "edit_file":
        if path, ok := content.Input["path"].(string); ok {
            return fmt.Sprintf("Editing file: %s", path)
        }
        return "Editing file"
        
    case "Bash":
        if cmd, ok := content.Input["cmd"].(string); ok {
            if len(cmd) > 100 {
                cmd = cmd[:97] + "..."
            }
            return fmt.Sprintf("Running command: %s", cmd)
        }
        return "Running command"
        
    case "Grep":
        if pattern, ok := content.Input["pattern"].(string); ok {
            return fmt.Sprintf("Searching for: %s", pattern)
        }
        return "Searching files"
        
    default:
        return fmt.Sprintf("Using tool: %s", content.Name)
    }
}
```

## State Management Patterns

### Deduplication Strategy

```go
func (p *AmpLogParser) emitMessage(msgType MessageType, content string, timestamp time.Time, metadata map[string]interface{}) {
    if strings.TrimSpace(content) == "" {
        return
    }
    
    // Create deterministic message ID for deduplication
    messageKey := fmt.Sprintf("%s_%d_%s", msgType, timestamp.Unix(), content)
    messageID := fmt.Sprintf("%x", sha256.Sum256([]byte(messageKey)))[:16]
    
    // Check for duplicates
    if p.seenMessageIDs[messageID] {
        return // Skip duplicate
    }
    p.seenMessageIDs[messageID] = true
    
    message := ThreadMessage{
        ID:        messageID,
        Type:      msgType,
        Content:   content,
        Timestamp: timestamp,
        Metadata:  metadata,
    }
    
    if p.onMessage != nil {
        p.onMessage(message)
    }
}
```

### Thread State Management

```go
func (p *AmpLogParser) updateThreadState(thread *Thread, timestamp time.Time) {
    p.latestThread = thread
    p.lastThreadUpdate = timestamp
    p.threadID = thread.ID
    p.threadTitle = thread.Title
    // Reset processed flag for new messages
    p.conversationProcessed = false
}
```

### Final Conversation Processing

```go
func (p *AmpLogParser) ProcessFinalConversation() {
    if p.conversationProcessed {
        return
    }
    
    if p.latestThread != nil {
        // Emit thread start message
        if p.latestThread.Title != "" {
            p.emitMessage(MessageTypeSystem, 
                fmt.Sprintf("Thread: %s", p.latestThread.Title), 
                p.lastThreadUpdate, 
                map[string]interface{}{
                    "thread_id": p.latestThread.ID,
                    "thread_title": p.latestThread.Title,
                })
        }
        
        // Process all messages in final conversation
        for _, message := range p.latestThread.Messages {
            p.processMessage(message, p.lastThreadUpdate)
        }
    }
    
    p.conversationProcessed = true
}
```

## API Contract for UI Integration

### REST API Endpoints

#### 1. Get Thread Messages

```
GET /api/tasks/{id}/thread?limit=50&offset=0
```

**Response:**
```json
{
  "messages": [
    {
      "id": "msg_abc123",
      "type": "system",
      "content": "Thread: Fix authentication bug",
      "timestamp": "2024-12-17T10:30:45.123Z",
      "metadata": {
        "thread_id": "thread_abc123",
        "thread_title": "Fix authentication bug"
      }
    },
    {
      "id": "msg_def456", 
      "type": "user",
      "content": "Can you help me fix the authentication issue?",
      "timestamp": "2024-12-17T10:31:00.456Z"
    },
    {
      "id": "msg_ghi789",
      "type": "tool",
      "content": "Reading file: auth.js",
      "timestamp": "2024-12-17T10:31:05.789Z",
      "metadata": {
        "type": "tool_use",
        "tool_name": "read_file",
        "tool_id": "call_123",
        "input": {"path": "auth.js"}
      }
    },
    {
      "id": "msg_jkl012",
      "type": "assistant",
      "content": "I'll help you fix the authentication issue. Let me examine the code first.",
      "timestamp": "2024-12-17T10:31:10.012Z"
    }
  ],
  "has_more": false,
  "total": 4
}
```

### WebSocket Real-time Updates

#### Connection

```javascript
const ws = new WebSocket('ws://localhost:8080/api/ws');
```

#### Message Events

```json
{
  "type": "thread_message",
  "data": {
    "id": "msg_new123",
    "type": "assistant", 
    "content": "I found the issue in the authentication code...",
    "timestamp": "2024-12-17T10:32:00.000Z",
    "metadata": null
  }
}
```

### Data Transfer Objects

```go
// ThreadMessageDTO for API responses
type ThreadMessageDTO struct {
    ID        string                 `json:"id"`
    Type      string                 `json:"type"`
    Content   string                 `json:"content"`
    Timestamp time.Time              `json:"timestamp"`
    Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// WebSocket event structure
type ThreadMessageEvent struct {
    Type string            `json:"type"` // "thread_message"
    Data ThreadMessageDTO `json:"data"`
}
```

## Implementation Examples

### Complete Parser Setup

```go
func main() {
    // Create parser with message callback
    parser := NewAmpLogParser("worker_123", func(msg ThreadMessage) {
        fmt.Printf("[%s] %s: %s\n", msg.Type, msg.Timestamp.Format("15:04:05"), msg.Content)
        
        // Send to WebSocket clients
        broadcastToClients(ThreadMessageEvent{
            Type: "thread_message",
            Data: ThreadMessageDTO{
                ID:        msg.ID,
                Type:      string(msg.Type),
                Content:   msg.Content,
                Timestamp: msg.Timestamp,
                Metadata:  msg.Metadata,
            },
        })
    })
    
    // Process log file line by line
    file, _ := os.Open("amp.log")
    defer file.Close()
    
    scanner := bufio.NewScanner(file)
    for scanner.Scan() {
        parser.ParseLine(scanner.Text())
    }
    
    // Process final conversation state
    parser.ProcessFinalConversation()
}
```

### Log Tailer with Real-time Parsing

```go
type LogTailerWithParser struct {
    *LogTailer
    parser *AmpLogParser
}

func NewLogTailerWithParser(logFile, workerID string, onLogLine func(LogLine), onThreadMessage func(ThreadMessage)) *LogTailerWithParser {
    parser := NewAmpLogParser(workerID, onThreadMessage)
    
    wrappedCallback := func(logLine LogLine) {
        // Send raw log to stdout viewers
        if onLogLine != nil {
            onLogLine(logLine)
        }
        
        // Parse for structured thread messages
        parser.ParseLine(logLine.Content)
    }
    
    tailer := NewLogTailer(logFile, workerID, wrappedCallback)
    
    return &LogTailerWithParser{
        LogTailer: tailer,
        parser:    parser,
    }
}
```

### Storage Integration

```go
type ThreadStorage struct {
    baseDir string
}

func (ts *ThreadStorage) AppendMessage(taskID string, message ThreadMessage) error {
    filePath := filepath.Join(ts.baseDir, fmt.Sprintf("thread_%s.jsonl", taskID))
    
    // Check for duplicates
    if ts.messageExists(filePath, message.ID) {
        return nil
    }
    
    file, err := os.OpenFile(filePath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
    if err != nil {
        return err
    }
    defer file.Close()
    
    messageJSON, _ := json.Marshal(message)
    file.Write(append(messageJSON, '\n'))
    
    return nil
}
```

## Chat Interface Integration

### JavaScript Client Implementation

```javascript
class AmpChatClient {
    constructor(taskId) {
        this.taskId = taskId;
        this.messages = [];
        this.ws = null;
        this.messageContainer = document.getElementById('messages');
        
        this.connectWebSocket();
        this.loadInitialMessages();
    }
    
    connectWebSocket() {
        this.ws = new WebSocket('ws://localhost:8080/api/ws');
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            if (data.type === 'thread_message') {
                this.addMessage(data.data);
            }
        };
    }
    
    async loadInitialMessages() {
        const response = await fetch(`/api/tasks/${this.taskId}/thread?limit=100`);
        const data = await response.json();
        
        data.messages.forEach(msg => this.addMessage(msg));
    }
    
    addMessage(message) {
        // Prevent duplicates
        if (this.messages.find(m => m.id === message.id)) {
            return;
        }
        
        this.messages.push(message);
        this.renderMessage(message);
    }
    
    renderMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${message.type}`;
        
        // Format timestamp
        const time = new Date(message.timestamp).toLocaleTimeString();
        
        // Handle different message types
        switch (message.type) {
            case 'system':
                messageEl.innerHTML = `
                    <div class="message-header">
                        <span class="message-type">System</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-content system-content">${message.content}</div>
                `;
                break;
                
            case 'user':
                messageEl.innerHTML = `
                    <div class="message-header">
                        <span class="message-type">User</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-content user-content">${message.content}</div>
                `;
                break;
                
            case 'assistant':
                const isThinking = message.metadata?.type === 'thinking';
                messageEl.innerHTML = `
                    <div class="message-header">
                        <span class="message-type">Assistant${isThinking ? ' (Thinking)' : ''}</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-content assistant-content ${isThinking ? 'thinking' : ''}">${message.content}</div>
                `;
                break;
                
            case 'tool':
                messageEl.innerHTML = `
                    <div class="message-header">
                        <span class="message-type">Tool</span>
                        <span class="message-time">${time}</span>
                    </div>
                    <div class="message-content tool-content">
                        <span class="tool-indicator">🔧</span>
                        ${message.content}
                    </div>
                `;
                break;
        }
        
        this.messageContainer.appendChild(messageEl);
        this.scrollToBottom();
    }
    
    scrollToBottom() {
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }
}

// Initialize chat client
const chatClient = new AmpChatClient('task_123');
```

### CSS Styling for Chat Interface

```css
.message {
    margin-bottom: 1rem;
    padding: 0.75rem;
    border-radius: 8px;
    max-width: 100%;
}

.message-system {
    background-color: #f8f9fa;
    border-left: 4px solid #6c757d;
}

.message-user {
    background-color: #e3f2fd;
    border-left: 4px solid #2196f3;
}

.message-assistant {
    background-color: #f3e5f5;
    border-left: 4px solid #9c27b0;
}

.message-assistant.thinking {
    background-color: #fff3e0;
    border-left: 4px solid #ff9800;
}

.message-tool {
    background-color: #e8f5e8;
    border-left: 4px solid #4caf50;
}

.message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    opacity: 0.8;
}

.message-content {
    line-height: 1.5;
    white-space: pre-wrap;
    word-wrap: break-word;
}

.tool-indicator {
    margin-right: 0.5rem;
}

.thinking {
    font-style: italic;
    opacity: 0.9;
}
```

This comprehensive documentation provides all the patterns, logic, and API contracts needed to implement amp log parsing and chat UI integration in your new project. The parsing approach handles all amp's event types, manages state properly, prevents duplicates, and provides both REST and WebSocket APIs for real-time chat interfaces.

<function_calls>
<invoke name="todo_write">
<parameter name="todos">[{"id": "1", "content": "Create comprehensive parsing.md document explaining amp log parsing patterns", "status": "completed", "priority": "high"}, {"id": "2", "content": "Document amp log file structure and JSON format", "status": "completed", "priority": "high"}, {"id": "3", "content": "Explain parsing logic and state management patterns", "status": "completed", "priority": "high"}, {"id": "4", "content": "Document API contract for UI consumption", "status": "completed", "priority": "high"}, {"id": "5", "content": "Provide code examples and implementation patterns", "status": "completed", "priority": "high"}]
