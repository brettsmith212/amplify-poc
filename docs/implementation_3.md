# Implementation Plan

## Core Backend Infrastructure

- [x] Step 1: Create Thread Bootstrap Foundation

  - **Task**: Implement thread ID generation and persistence when creating sessions, and integrate `amp threads new` command execution in session creation flow
  - **Description**: This establishes the core thread tracking mechanism that all subsequent features depend on. The PRD specifies that thread bootstrap should store thread.id and amp.log path during session creation.
  - **Files**:
    - `backend/src/controllers/sessionController.ts`: Add thread ID generation and amp.log path creation
    - `backend/src/models/Session.ts`: Add threadId and ampLogPath fields to Session model
    - `backend/src/services/ampService.ts`: Create new service to handle amp command execution
  - **Step Dependencies**: None
  - **User Instructions**: This step modifies session creation to include thread bootstrapping. Test by creating a new session and verifying thread.id is generated and stored.

- [x] Step 2: Implement AmpLogParser Service

  - **Task**: Create the AmpLogParser service based on the parsing documentation to parse JSONL amp.log files and convert them to ThreadMessage objects
  - **Description**: This is the core parsing engine that converts amp's structured logs into UI-consumable messages. It handles deduplication, message routing, and state management as specified in the parsing docs.
  - **Files**:
    - `backend/src/services/ampLogParser.ts`: Complete AmpLogParser implementation from docs
    - `backend/src/types/threadMessage.ts`: Define ThreadMessage and related interfaces
    - `backend/src/utils/logParsingUtils.ts`: Utility functions for log parsing and message ID generation
  - **Step Dependencies**: Step 1
  - **User Instructions**: This creates the parsing engine. Test by providing sample amp.log files and verifying correct ThreadMessage output.

- [x] Step 3: Build LogTailer Service
  - **Task**: Implement LogTailer service that watches amp.log files for changes and streams new lines to AmpLogParser in real-time
  - **Description**: This enables real-time streaming of log updates to the UI. The service uses fs.watch with debouncing to efficiently track file changes and parse new content.
  - **Files**:
    - `backend/src/services/logTailer.ts`: Implement file watching and streaming logic
    - `backend/src/services/logTailerWithParser.ts`: Combine LogTailer with AmpLogParser
  - **Step Dependencies**: Step 2
  - **User Instructions**: This enables real-time log parsing. Test by appending to an amp.log file and verifying events are generated.

## API Layer Development

- [x] Step 4: Create Thread Message API Endpoints

  - **Task**: Implement REST API endpoints for thread message retrieval with pagination support
  - **Description**: These endpoints provide the HTTP interface for the frontend to fetch thread history. Includes GET /sessions/{id}/thread for paginated message retrieval.
  - **Files**:
    - `backend/src/routes/threads.ts`: New route file for thread-related endpoints
    - `backend/src/controllers/threadController.ts`: Controller for thread message operations
    - `backend/src/__tests__/routes/threads.test.ts`: API endpoint tests
  - **Step Dependencies**: Step 2
  - **User Instructions**: This creates the REST API. Test endpoints with curl or Postman to verify correct message retrieval and pagination.

- [x] Step 5: Implement WebSocket Thread Communication
  - **Task**: Create WebSocket handlers for real-time thread message streaming and user input handling
  - **Description**: Establishes bidirectional communication for real-time chat. Handles inbound user messages (which trigger amp commands) and outbound parsed messages from logs.
  - **Files**:
    - `backend/src/websocket/threadWebSocket.ts`: WebSocket handlers for thread communication
    - `backend/src/controllers/sessionController.ts`: Add WebSocket session management
    - `backend/src/__tests__/websocket/threadWebSocket.test.ts`: WebSocket communication tests
  - **Step Dependencies**: Step 3
  - **User Instructions**: This enables real-time communication. Test by connecting via WebSocket and sending/receiving messages.

## Frontend Core Components

- [x] Step 6: Create TaskTabs Navigation Component

  - **Task**: Build the tabbed navigation component with Thread, Terminal, and Git Diff tabs, including ARIA compliance and keyboard navigation
  - **Description**: This provides the core navigation structure for the session page. The component supports tab switching, visual indicators, and accessibility features as specified in the UI documentation.
  - **Files**:
    - `frontend/src/components/task/TaskTabs.tsx`: Main tab navigation component
    - `frontend/src/types/tabs.ts`: Tab-related type definitions
    - `frontend/src/__tests__/components/task/TaskTabs.test.tsx`: Component tests
  - **Step Dependencies**: None
  - **User Instructions**: This creates the tab navigation. Test by clicking tabs and verifying active states and keyboard navigation work correctly.

- [x] Step 7: Build MessageBubble Component

  - **Task**: Create the MessageBubble component with role-based styling, timestamps, metadata display, and avatar system
  - **Description**: This component renders individual messages with distinct visual styles for user, amp, and system roles. Includes support for message metadata like tool usage, file changes, and error indicators.
  - **Files**:
    - `frontend/src/components/task/MessageBubble.tsx`: Message bubble component with role styling
    - `frontend/src/utils/messageFormatting.ts`: Utilities for timestamp and metadata formatting
    - `frontend/src/__tests__/components/task/MessageBubble.test.tsx`: Component tests
  - **Step Dependencies**: None
  - **User Instructions**: This creates message display components. Test by rendering messages with different roles and metadata.

- [x] Step 8: Implement MarkdownRenderer Component
  - **Task**: Create MarkdownRenderer with syntax highlighting, copy-to-clipboard for code blocks, and responsive styling
  - **Description**: This component handles rich text rendering for message content. Includes react-markdown integration, code syntax highlighting with react-syntax-highlighter, and interactive features like copy buttons.
  - **Files**:
    - `frontend/src/components/ui/MarkdownRenderer.tsx`: Markdown rendering with syntax highlighting
    - `frontend/package.json`: Add react-markdown and react-syntax-highlighter dependencies
    - `frontend/src/__tests__/components/ui/MarkdownRenderer.test.tsx`: Component tests
  - **Step Dependencies**: None
  - **User Instructions**: This enables rich text rendering. Test by rendering markdown with code blocks and verifying syntax highlighting and copy functionality.

## Thread Interface Implementation

- [x] Step 9: Build ThreadView Main Container

  - **Task**: Create the main ThreadView component with message list display, auto-scrolling, loading states, and connection status
  - **Description**: This is the central component that orchestrates the thread interface. It manages message display, handles scrolling behavior, shows connection status, and provides loading states.
  - **Files**:
    - `frontend/src/components/task/ThreadView.tsx`: Main thread interface component
    - `frontend/src/hooks/useAutoScroll.ts`: Custom hook for scroll management
    - `frontend/src/__tests__/components/task/ThreadView.test.tsx`: Component tests
  - **Step Dependencies**: Steps 7, 8
  - **User Instructions**: This creates the main thread interface. Test message display, scrolling behavior, and loading states.

- [x] Step 10: Add Message Input and Send Functionality
  - **Task**: Implement message input textarea with send button, keyboard shortcuts (Cmd/Ctrl+Enter), and input validation
  - **Description**: This adds user interaction capabilities to the thread interface. Users can type messages, send them via button or keyboard shortcut, with proper validation and error handling.
  - **Files**:
    - `frontend/src/components/task/MessageInput.tsx`: Message input component
    - `frontend/src/hooks/useMessageSending.ts`: Custom hook for message sending logic
    - `frontend/src/__tests__/components/task/MessageInput.test.tsx`: Component tests
  - **Step Dependencies**: Step 9
  - **User Instructions**: This enables user input. Test typing messages, keyboard shortcuts, and send functionality.

## WebSocket Integration

- [x] Step 11: Implement Frontend WebSocket Client

  - **Task**: Create WebSocket client service for real-time thread communication with connection management and reconnection logic
  - **Description**: This establishes the real-time communication layer between frontend and backend. Includes connection state management, automatic reconnection, and message handling.
  - **Files**:
    - `frontend/src/services/threadWebSocket.ts`: WebSocket client implementation
    - `frontend/src/hooks/useWebSocket.ts`: React hook for WebSocket management
    - `frontend/src/__tests__/services/threadWebSocket.test.tsx`: WebSocket tests
  - **Step Dependencies**: Step 5
  - **User Instructions**: This enables real-time communication. Test connection establishment, message sending/receiving, and reconnection behavior.

- [x] Step 12: Connect Thread Data Flow
  - **Task**: Integrate WebSocket client with ThreadView component to enable real-time message streaming and user input handling
  - **Description**: This completes the data flow loop, connecting the UI components with the WebSocket communication layer. Messages from the backend stream into the UI, and user input flows back to trigger amp commands.
  - **Files**:
    - `frontend/src/components/task/ThreadView.tsx`: Add WebSocket integration
    - `frontend/src/hooks/useThreadMessages.ts`: Custom hook for message state management
    - `frontend/src/__tests__/integration/threadDataFlow.test.tsx`: Integration tests
  - **Step Dependencies**: Steps 10, 11
  - **User Instructions**: This completes the real-time functionality. Test by sending messages and verifying they appear in the thread and trigger backend actions.

## Page Integration

- [x] Step 13: Modify TerminalPage to Include Tabs

  - **Task**: Update the existing TerminalPage to use TaskTabs component and include both Terminal and Thread tabs
  - **Description**: This transforms the current terminal-only page into a tabbed interface. The Terminal tab maintains existing functionality while adding the new Thread tab.
  - **Files**:
    - `frontend/src/pages/TerminalPage.tsx`: Update to use TaskTabs and include ThreadView
    - `frontend/src/components/Layout.tsx`: Update layout to accommodate tab structure
    - `frontend/src/__tests__/pages/TerminalPage.test.tsx`: Update page tests
  - **Step Dependencies**: Steps 6, 9
  - **User Instructions**: This integrates tabs into the existing page. Test tab switching between Terminal and Thread views.

- [ ] Step 14: Add Thread History Loading
  - **Task**: Implement history loading functionality that fetches and displays existing thread messages when Thread tab is first accessed
  - **Description**: This enables users to see the full conversation history when they open the Thread tab. It loads existing messages from the backend and handles pagination for large conversations.
  - **Files**:
    - `frontend/src/hooks/useThreadHistory.ts`: Custom hook for loading thread history
    - `frontend/src/components/task/ThreadView.tsx`: Add history loading integration
    - `frontend/src/__tests__/hooks/useThreadHistory.test.tsx`: History loading tests
  - **Step Dependencies**: Steps 4, 12
  - **User Instructions**: This loads conversation history. Test by opening Thread tab and verifying past messages are displayed.

## Backend Integration & Session Updates

- [ ] Step 15: Update Session Creation for Thread Bootstrap

  - **Task**: Modify session creation process to execute `amp threads new` command and store thread metadata
  - **Description**: This integrates thread creation into the existing session workflow. When a session is created, it now also bootstraps an amp thread and stores the relevant metadata.
  - **Files**:
    - `backend/src/controllers/sessionController.ts`: Update createSession to include thread bootstrap
    - `backend/src/services/ampService.ts`: Add `amp threads new` execution
    - `backend/src/__tests__/controllers/sessionController.test.ts`: Update tests for thread bootstrap
  - **Step Dependencies**: Steps 1, 3
  - **User Instructions**: This integrates thread creation with sessions. Test by creating a new session and verifying thread bootstrap occurs.

- [ ] Step 16: Implement Session-Thread Association
  - **Task**: Create database/storage associations between sessions and their thread data, including amp.log file management
  - **Description**: This establishes the persistent relationship between sessions and threads. Each session has an associated thread ID and amp.log file path that are maintained throughout the session lifecycle.
  - **Files**:
    - `backend/src/services/sessionStore.ts`: Add thread association methods
    - `backend/src/models/Session.ts`: Finalize thread-related fields
    - `backend/src/__tests__/services/sessionStore.test.ts`: Test thread associations
  - **Step Dependencies**: Step 15
  - **User Instructions**: This links sessions with threads persistently. Test by stopping/starting sessions and verifying thread associations persist.

## Error Handling & Polish

- [ ] Step 17: Add Connection Status Indicators

  - **Task**: Implement connection status display in ThreadView with visual indicators for connected, disconnecting, and error states
  - **Description**: This provides users with clear feedback about the connection status to the backend. Includes animated indicators and appropriate messaging for different connection states.
  - **Files**:
    - `frontend/src/components/task/ConnectionStatus.tsx`: Connection status indicator component
    - `frontend/src/components/task/ThreadView.tsx`: Integrate connection status display
    - `frontend/src/__tests__/components/task/ConnectionStatus.test.tsx`: Component tests
  - **Step Dependencies**: Step 11
  - **User Instructions**: This shows connection status to users. Test by simulating connection issues and verifying appropriate status indicators appear.

- [ ] Step 18: Implement Error Handling and Recovery
  - **Task**: Add comprehensive error handling for WebSocket disconnections, message parsing failures, and API errors with user-friendly error messages
  - **Description**: This ensures the application gracefully handles various error conditions. Includes retry logic, error boundaries, and clear user messaging for different failure scenarios.
  - **Files**:
    - `frontend/src/components/ErrorBoundary.tsx`: Enhance existing error boundary for thread errors
    - `frontend/src/services/errorHandler.ts`: Centralized error handling service
    - `frontend/src/hooks/useErrorHandling.ts`: Error handling hook
    - `backend/src/middleware/errorHandling.ts`: Backend error handling for thread operations
  - **Step Dependencies**: Step 12
  - **User Instructions**: This improves error resilience. Test by simulating various error conditions and verifying appropriate handling and user feedback.

## Testing & Quality Assurance

- [ ] Step 19: Comprehensive Integration Testing

  - **Task**: Create end-to-end tests that verify the complete thread functionality from session creation through message exchange
  - **Description**: This ensures all components work together correctly. Tests cover the full workflow: session creation, thread bootstrap, message sending, real-time updates, and history loading.
  - **Files**:
    - `frontend/src/__tests__/integration/threadWorkflow.test.tsx`: End-to-end thread workflow tests
    - `backend/src/__tests__/integration/threadIntegration.test.ts`: Backend integration tests
    - `scripts/test-thread-functionality.sh`: Manual testing script
  - **Step Dependencies**: Steps 16, 18
  - **User Instructions**: This verifies end-to-end functionality. Run tests to ensure complete thread workflow operates correctly.

- [ ] Step 20: Performance Optimization and Final Polish
  - **Task**: Optimize component rendering with React.memo, implement virtual scrolling for large message lists, and add final UI polish including animations and responsive design
  - **Description**: This ensures the application performs well with large conversation histories and provides a polished user experience. Includes performance monitoring and responsive design verification.
  - **Files**:
    - `frontend/src/components/task/ThreadView.tsx`: Add virtual scrolling and performance optimizations
    - `frontend/src/components/task/MessageBubble.tsx`: Add React.memo optimization
    - `frontend/src/styles/animations.css`: Custom animations for message appearance
    - `frontend/src/hooks/useVirtualScroll.ts`: Virtual scrolling implementation
  - **Step Dependencies**: Step 19
  - **User Instructions**: This optimizes performance and adds polish. Test with large message lists and verify smooth scrolling and animations.

## Summary

This implementation plan breaks down the Phase 3 PRD into 20 manageable steps that build upon each other logically. The approach prioritizes:

1. **Backend Foundation First**: Steps 1-5 establish the core parsing and API infrastructure
2. **Frontend Components**: Steps 6-10 build the UI components independently
3. **Integration**: Steps 11-16 connect frontend and backend systems
4. **Polish & Quality**: Steps 17-20 add error handling, testing, and optimization

Key considerations:

- Each step is atomic and can be implemented independently by an AI
- Dependencies are clearly defined to ensure proper build order
- Testing is integrated throughout the process
- The plan covers all requirements from the PRD while being practical to implement
- Steps are designed to be completed in a single iteration with minimal file changes
