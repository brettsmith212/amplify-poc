# Thread Tab Implementation Guide

## Overview
This document provides a comprehensive guide to recreate the Thread tab functionality from the Amp CLI UI mockup. The Thread tab displays a conversational interface between users and an AI agent, with support for message rendering, auto-scrolling, input handling, and connection status.

## Architecture

### Component Structure
```
TaskDetail (Page)
├── TaskTabs (Tab Navigation)
└── ThreadView (Main Thread Container)
    ├── MessageBubble (Individual Messages)
    └── MarkdownRenderer (Message Content)
```

### Data Flow
1. **TaskDetail** manages the overall page state and tab switching
2. **ThreadView** handles message display, input, and scrolling
3. **MessageBubble** renders individual messages with role-based styling
4. **MarkdownRenderer** processes message content with syntax highlighting

## Core Components

### 1. TaskTabs Component
**File**: `src/components/task/TaskTabs.tsx`

**Purpose**: Tab navigation with three tabs: Thread, Logs, CI

**Key Features**:
- Tab switching with active state management
- Icons for each tab (MessageSquare, Terminal, Zap)
- Responsive design with hover states
- Border-bottom styling for active tab

**Tab Configuration**:
```typescript
const tabs = [
  { id: 'thread', label: 'Thread', icon: MessageSquare },
  { id: 'logs', label: 'Logs', icon: Terminal },
  { id: 'ci', label: 'CI', icon: Zap }
]
```

### 2. ThreadView Component
**File**: `src/components/task/ThreadView.tsx`

**Purpose**: Main container for the thread interface

**Key Features**:
- **Auto-scrolling**: Automatically scrolls to bottom when new messages arrive
- **Connection status**: Shows connection state with animated indicator
- **Loading states**: Loading spinner while fetching messages
- **Empty state**: Friendly message when no messages exist
- **Message input**: Textarea with send button and keyboard shortcuts
- **Input validation**: Prevents sending empty messages

**Layout Structure**:
```
ThreadView Container
├── Connection Status (conditional)
├── Messages Area (scrollable)
│   ├── Empty State OR Messages List
│   └── Scroll Anchor (invisible)
└── Input Area (fixed bottom)
    ├── Textarea
    └── Send Button
```

**Scrolling Implementation**:
```typescript
const messagesEndRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])
```

**Keyboard Shortcuts**:
- `Cmd/Ctrl + Enter`: Send message
- Auto-focus on textarea when component mounts

### 3. MessageBubble Component
**File**: `src/components/task/MessageBubble.tsx`

**Purpose**: Individual message display with role-based styling

**Message Roles**:
- **User**: Blue theme with User icon
- **Amp**: Green/emerald gradient with Bot icon  
- **System**: Gray theme with Settings icon

**Role Configuration**:
```typescript
const getRoleConfig = (role) => {
  switch (role) {
    case 'user':
      return {
        icon: User,
        label: 'You',
        bgColor: 'bg-blue-600',
        textColor: 'text-blue-600 dark:text-blue-400',
        bubbleColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800'
      }
    // ... other roles
  }
}
```

**Message Features**:
- **Timestamp formatting**: Relative time display (e.g., "2m ago", "1h ago")
- **Message type indicators**: Visual indicators for errors, file changes, code execution
- **File attachments**: Display list of affected files
- **Exit codes**: Show command execution results
- **Avatar**: Role-specific colored avatar with icon

**Message Layout**:
```
MessageBubble
├── Avatar (circular, role-colored)
└── Content Area
    ├── Header (name, timestamp, metadata)
    └── Message Bubble
        ├── Type Indicator (optional)
        ├── Markdown Content
        └── Files List (optional)
```

### 4. MarkdownRenderer Component
**File**: `src/components/ui/MarkdownRenderer.tsx`

**Purpose**: Render markdown content with syntax highlighting

**Features**:
- **Code blocks**: Syntax highlighting with copy button
- **Inline code**: Styled monospace text
- **Typography**: Consistent heading, paragraph, list styling
- **Links**: External links with security attributes
- **Tables**: Responsive table rendering
- **Blockquotes**: Styled quote blocks

**Code Block Features**:
- Language detection from markdown
- Copy-to-clipboard functionality
- Hover-based copy button visibility
- Dark theme syntax highlighting (VS Code Dark Plus)

## Data Types

### ThreadMessage Interface
```typescript
interface ThreadMessage {
  id: string
  role: 'user' | 'amp' | 'system'
  content: string
  ts: string  // ISO date string
  metadata?: {
    type?: 'text' | 'code' | 'error' | 'file_change'
    files?: string[]
    exitCode?: number
  }
}
```

### Component Props
```typescript
// ThreadView Props
interface ThreadViewProps {
  taskId: string
  messages: ThreadMessage[]
  isLoading?: boolean
  onSendMessage?: (message: string) => void
  isConnected?: boolean
}

// MessageBubble Props
interface MessageBubbleProps {
  message: ThreadMessage
  className?: string
}
```

## Styling Approach

### Design System
- **Colors**: Role-based color themes (blue, emerald, gray)
- **Typography**: Tailwind prose classes for consistency
- **Spacing**: Consistent padding and margins using Tailwind scale
- **Dark Mode**: Full dark mode support with appropriate contrast
- **Responsive**: Mobile-first responsive design

### Key CSS Classes
```css
/* Thread container */
.thread-container {
  height: calc(100vh - 400px);
  display: flex;
  flex-direction: column;
}

/* Messages area */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

/* Message bubbles */
.message-bubble {
  border-radius: 0.75rem;
  padding: 0.75rem;
  max-width: 64rem;
}

/* Input area */
.input-area {
  border-top: 1px solid theme('colors.gray.200');
  padding: 1rem;
  background: white;
}
```

## State Management

### Page-Level State (TaskDetail)
```typescript
const [activeTab, setActiveTab] = useState<TabType>('thread')
const { data: messages, isLoading } = useTaskThread(taskId)
const sendMessage = useSendMessage(taskId)
```

### Component State (ThreadView)
```typescript
const [newMessage, setNewMessage] = useState('')
const [isSending, setIsSending] = useState(false)
const messagesEndRef = useRef<HTMLDivElement>(null)
const textareaRef = useRef<HTMLTextAreaElement>(null)
```

### State Updates
- Messages are managed externally (React Query/SWR)
- Local state for input text and sending status
- Refs for DOM manipulation (scrolling, focus)

## Implementation Steps

### 1. Set Up Basic Structure
1. Create TaskTabs component with tab switching logic
2. Implement basic ThreadView container with flex layout
3. Add basic MessageBubble component structure

### 2. Implement Message Display
1. Create message role configurations with colors/icons
2. Add timestamp formatting utilities
3. Implement message metadata display (type indicators, files, exit codes)
4. Add empty state and loading states

### 3. Add Markdown Rendering
1. Install react-markdown and react-syntax-highlighter
2. Create MarkdownRenderer with custom component overrides
3. Implement code block copy functionality
4. Style all markdown elements consistently

### 4. Implement Interactivity
1. Add message input with controlled state
2. Implement send button with loading states
3. Add keyboard shortcuts (Cmd/Ctrl+Enter)
4. Add input validation and error handling

### 5. Add Auto-Scrolling
1. Create scroll anchor ref at bottom of messages
2. Add useEffect to scroll on new messages
3. Implement smooth scrolling behavior
4. Add focus management for textarea

### 6. Polish and Edge Cases
1. Add connection status indicator
2. Implement responsive design
3. Add dark mode support
4. Handle edge cases (long messages, network errors)
5. Add accessibility features (ARIA labels, keyboard navigation)

## Dependencies

### Required NPM Packages
```json
{
  "react-markdown": "^8.0.0",
  "react-syntax-highlighter": "^15.5.0",
  "lucide-react": "^0.200.0"
}
```

### Optional Enhancements
```json
{
  "react-query": "^3.39.0",  // For message state management
  "react-router-dom": "^6.8.0",  // For routing
  "tailwindcss": "^3.3.0"  // For styling
}
```

## Key Implementation Details

### Auto-Scroll Logic
```typescript
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])
```

### Keyboard Shortcuts
```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    handleSend()
  }
}
```

### Connection Status UI
```typescript
const getConnectionStatus = () => {
  if (!isConnected) {
    return (
      <div className="flex items-center justify-center p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4">
        <div className="flex items-center space-x-2 text-yellow-600 dark:text-yellow-400">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          <span className="text-sm">Connecting to task...</span>
        </div>
      </div>
    )
  }
  return null
}
```

### Message Timestamp Formatting
```typescript
const formatTimestamp = (ts: string) => {
  const date = new Date(ts)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return 'just now'
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
  return date.toLocaleDateString()
}
```

## Best Practices

### Performance
- Use React.memo for MessageBubble to prevent unnecessary re-renders
- Implement virtual scrolling for large message lists
- Debounce input changes to avoid excessive API calls

### Accessibility
- Proper ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly message structure
- Color contrast compliance

### User Experience
- Smooth animations and transitions
- Responsive design for mobile devices
- Clear loading and error states
- Intuitive keyboard shortcuts

### Code Organization
- Separate concerns (display, state, utils)
- Consistent TypeScript interfaces
- Reusable styling utilities
- Clear component boundaries

This implementation provides a fully functional thread interface that matches the design and functionality of the original Amp CLI UI mockup.
