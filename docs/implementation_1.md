# Implementation Plan

## Project Foundation

- [x] Step 1: Initialize Node.js Project Structure

  - **Task**: Create a Node.js project with TypeScript, set up package.json with backend dependencies (commander, ws, express, dockerode) and initialize Vite React frontend with TypeScript and TailwindCSS.
  - **Description**: Establishes the foundation for the Amplify CLI tool with separate backend and frontend folders, backend CLI dependencies, and modern React frontend with TypeScript and TailwindCSS.
  - **Files**:
    - `backend/package.json`: Backend dependencies (commander, ws, express, serve-static, dockerode)
    - `backend/tsconfig.json`: TypeScript configuration for backend Node.js code
    - `frontend/package.json`: Frontend dependencies (vite, react, typescript, tailwindcss, xterm)
    - `frontend/tsconfig.json`: Frontend TypeScript configuration for React
    - `frontend/vite.config.ts`: Vite configuration with proper build output directory
    - `frontend/tailwind.config.js`: TailwindCSS configuration
    - `frontend/postcss.config.js`: PostCSS configuration for TailwindCSS
    - `.gitignore`: Ignore node_modules, dist, build artifacts, frontend/dist, and backend/dist
    - `backend/src/index.ts`: Entry point with basic CLI structure using commander
    - `README.md`: Initial documentation with project overview
  - **Step Dependencies**: None
  - **User Instructions**: Run `cd backend && npm install && cd ../frontend && npm install` to install dependencies

- [x] Step 2: Create Docker Base Image
  - **Task**: Implement the Dockerfile.base as specified in the PRD, with Ubuntu 24.04, Node.js, npm, and AMP CLI installation.
  - **Description**: Creates the foundational Docker image that will be reused across all sessions, containing the amp CLI and necessary tools.
  - **Files**:
    - `Dockerfile.base`: Docker configuration matching PRD specification exactly
    - `scripts/build-base-image.sh`: Script to build the base image with proper tagging
  - **Step Dependencies**: Step 1
  - **User Instructions**: Run `./scripts/build-base-image.sh` to build the base image

## Core CLI Implementation

- [x] Step 3: Implement Docker Image Management

  - **Task**: Create functionality to check if amplify-base image exists, build it if missing, and handle Docker operations using dockerode library.
  - **Description**: Handles the Docker image lifecycle management as specified in the PRD, ensuring the base image is available before running containers.
  - **Files**:
    - `backend/src/docker/imageManager.ts`: Image inspection, building, and management logic
    - `backend/src/docker/types.ts`: TypeScript interfaces for Docker operations
    - `backend/src/utils/logger.ts`: Logging utility for Docker operations
  - **Step Dependencies**: Step 2
  - **User Instructions**: Test with a fresh system where the base image doesn't exist

- [x] Step 4: Implement Container Lifecycle Management
  - **Task**: Create container creation, management, and cleanup functionality with proper session ID generation and environment variable handling.
  - **Description**: Manages the per-session container lifecycle including creation, running, and cleanup as specified in the PRD.
  - **Files**:
    - `backend/src/docker/containerManager.ts`: Container lifecycle management with session ID generation
    - `backend/src/docker/cleanup.ts`: Container cleanup and removal logic
    - `backend/src/config/environment.ts`: Environment variable validation and management
  - **Step Dependencies**: Step 3
  - **User Instructions**: Ensure AMP_API_KEY environment variable is set for testing

## Web Server and Terminal Interface

- [x] Step 5: Create Web Server with Vite Integration

  - **Task**: Implement Express server to serve Vite-built React app on localhost:3000 with WebSocket upgrade capability, including dev mode proxy for hot reload.
  - **Description**: Provides the web interface foundation that will host the React terminal UI and handle WebSocket connections, with development mode supporting Vite's hot reload.
  - **Files**:
    - `backend/src/server/webServer.ts`: Express server with Vite dev middleware and static build serving
    - `backend/src/server/middleware.ts`: Request logging, error handling, and Vite dev proxy middleware
    - `backend/src/server/viteConfig.ts`: Vite integration utilities for dev vs production mode
    - `frontend/src/main.tsx`: React app entry point
    - `frontend/src/App.tsx`: Main application component with terminal layout
    - `frontend/src/index.css`: TailwindCSS imports and base styles
  - **Step Dependencies**: Step 4
  - **User Instructions**: Access http://localhost:3000 to verify React app loads correctly

- [x] Step 6: Implement React Terminal Component with xterm.js
  - **Task**: Create a React component wrapping xterm.js with proper WebSocket connection handling, terminal rendering, and TypeScript integration.
  - **Description**: Implements the client-side terminal as a React component that users will interact with, handling keyboard input, display output, and WebSocket communication with proper TypeScript types.
  - **Files**:
    - `frontend/src/components/Terminal.tsx`: React component wrapping xterm.js with hooks
    - `frontend/src/hooks/useWebSocket.ts`: Custom hook for WebSocket connection management
    - `frontend/src/hooks/useTerminal.ts`: Custom hook for xterm.js terminal lifecycle
    - `frontend/src/types/terminal.ts`: TypeScript interfaces for terminal and WebSocket messages
    - `frontend/src/App.tsx`: Update to include Terminal component with proper layout
  - **Step Dependencies**: Step 5
  - **User Instructions**: Open browser and verify React terminal component renders correctly

## WebSocket Bridge Implementation

- [x] Step 7: Implement WebSocket to Docker Exec Bridge

  - **Task**: Create WebSocket server that bridges browser terminal input/output with docker exec commands inside the container.
  - **Description**: Core functionality that connects the browser terminal to the Docker container, enabling real-time command execution and output streaming.
  - **Files**:
    - `backend/src/websocket/terminalBridge.ts`: WebSocket handler with docker exec integration
    - `backend/src/websocket/messageHandler.ts`: Message parsing and routing logic
    - `backend/src/docker/execManager.ts`: Docker exec command management and streaming
  - **Step Dependencies**: Step 6
  - **User Instructions**: Test by typing commands in the browser terminal

- [x] Step 8: Implement Terminal Resize and Control Handling
  - **Task**: Add support for terminal resize events, Ctrl-C handling, and proper terminal session management with React integration.
  - **Description**: Ensures the terminal behaves like a native terminal with proper resize, control character handling, and session management, integrated with React component lifecycle.
  - **Files**:
    - `backend/src/websocket/terminalControl.ts`: Terminal control signal handling (resize, Ctrl-C)
    - `backend/src/websocket/sessionManager.ts`: Terminal session state management
    - `frontend/src/hooks/useTerminal.ts`: Update with resize event handling and control key support
    - `frontend/src/components/Terminal.tsx`: Add resize observer and control key handling
  - **Step Dependencies**: Step 7
  - **User Instructions**: Test terminal resizing and Ctrl-C interrupt functionality

## CLI Integration and Polish

- [x] Step 9: Implement Main CLI Command Interface

  - **Task**: Create the main CLI entry point that orchestrates image building, container running, web server starting, and browser launching.
  - **Description**: Ties together all components into a cohesive CLI tool that matches the PRD's user experience requirements.
  - **Files**:
    - `backend/src/cli/amplifyCommand.ts`: Main command implementation orchestrating all components
    - `backend/src/cli/browserLauncher.ts`: Auto-launch default browser functionality
    - `backend/src/utils/validation.ts`: Git repository and environment validation
  - **Step Dependencies**: Step 8
  - **User Instructions**: Run `npx amplify` from a git repository to test full workflow

- [x] Step 10: Implement Graceful Cleanup and Error Handling
  - **Task**: Add comprehensive error handling, graceful shutdown with container cleanup, and helpful error messages.
  - **Description**: Ensures robust operation with proper cleanup on exit and user-friendly error messages for common failure scenarios.
  - **Files**:
    - `backend/src/utils/errorHandler.ts`: Centralized error handling and user-friendly messages
    - `backend/src/cli/cleanup.ts`: Graceful shutdown handlers and container cleanup
    - `backend/src/utils/signals.ts`: Signal handling for proper cleanup on exit
  - **Step Dependencies**: Step 9
  - **User Instructions**: Test various failure scenarios and exit methods

## Summary

This implementation plan breaks down the Amplify POC into 12 manageable steps that can be executed sequentially. The approach follows the PRD's architecture closely:

**Key Implementation Strategy:**

1. **Modern Frontend Stack**: Vite + React + TypeScript + TailwindCSS for maintainable, scalable UI
2. **Foundation First**: Establish project structure and Docker base image before building functionality
3. **Layer by Layer**: Build from Docker management → Web server → React terminal → WebSocket bridge → CLI integration
4. **Testing Throughout**: Include comprehensive testing for both backend (Jest) and frontend (Vitest) at each milestone
5. **Progressive Enhancement**: Each step builds upon previous functionality while remaining atomic

**Critical Considerations:**

- Container lifecycle management with proper cleanup is essential for resource management
- WebSocket bridge must handle both data streaming and control signals reliably
- Error handling should provide clear, actionable feedback for common failure scenarios
- Security: Read-only mounting of host repository prevents accidental modifications
- Performance: Base image should be built once and reused across sessions

**Timeline Alignment**: This plan aligns with the 4-week timeline in the PRD, with foundational work in weeks 1-2, core functionality in week 3, and polish/testing in week 4.

The plan ensures all Definition of Done criteria are met:

1. `npx amplify` command functionality
2. Sub-3-second browser launch
3. Full amp CLI functionality in container
4. Proper container cleanup
5. Read-only host repository protection
