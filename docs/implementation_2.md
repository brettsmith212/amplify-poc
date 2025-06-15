# Implementation Plan - Amplify Phase 2

## Project Foundation (Building on Phase 1)

- [x] ~~Step 1: Project Structure & Basic Configuration~~ (Already complete from Phase 1)

  - Phase 1 already established TypeScript monorepo with frontend (React+Vite+TailwindCSS) and backend (Node.js+Express)

- [x] ~~Step 2: Docker Base Image Setup~~ (Already complete from Phase 1)

  - Phase 1 already created `Dockerfile.base` with Ubuntu 24.04, amp CLI, and build script

- [x] ~~Step 3: Backend Server Setup~~ (Already complete from Phase 1)
  - Phase 1 already has Express server with WebSocket support, terminal bridge, and container management

## Phase 2 Extensions - Web-First Multi-Session Architecture

- [x] Step 1: Upgrade Backend for Multi-Session Support
  - **Task**: Transform the existing single-session CLI tool into a multi-session web service with proper session management
  - **Description**: Extend the existing backend to support multiple concurrent sessions, user isolation, and persistent session state management
  - **Files**:
    - `backend/src/app.ts`: Create Express app configuration for Phase 2 web service
    - `backend/src/server.ts`: New server entry point for web service mode
    - `backend/src/services/sessionStore.ts`: In-memory session storage with TTL
    - `backend/src/services/cleanup.ts`: TTL cleanup job implementation
    - `backend/src/models/Session.ts`: Session data model and interfaces
    - `backend/src/models/User.ts`: User data model for GitHub integration
    - `backend/src/config/webConfig.ts`: Web service configuration
  - **Step Dependencies**: None (builds on existing Phase 1 code)
  - **User Instructions**: None

## GitHub Integration

- [ ] Step 2: GitHub OAuth Implementation

  - **Task**: Implement GitHub OAuth flow with proper token storage and user authentication
  - **Description**: Set up complete GitHub OAuth integration including login, callback handling, and secure token storage in HTTP-only cookies
  - **Files**:
    - `backend/src/auth/github.ts`: GitHub OAuth strategy and token handling
    - `backend/src/routes/auth.ts`: Authentication routes (/auth/github, /auth/callback)
    - `backend/src/middleware/auth.ts`: Authentication middleware for protected routes
    - `backend/src/services/github.ts`: GitHub API client and token management
    - `backend/src/__tests__/auth.test.ts`: Authentication flow tests
  - **Step Dependencies**: Step 1
  - **User Instructions**: Create GitHub OAuth App and add CLIENT_ID/CLIENT_SECRET to .env

- [ ] Step 3: GitHub API Integration
  - **Task**: Implement GitHub API proxy endpoints for repositories and branches with proper authentication
  - **Description**: Create API endpoints that proxy GitHub requests to get user repositories and branches, with proper error handling and rate limiting
  - **Files**:
    - `backend/src/routes/github.ts`: GitHub API proxy routes (/repos, /branches)
    - `backend/src/services/githubApi.ts`: GitHub API service with rate limiting
    - `backend/src/middleware/rateLimit.ts`: Rate limiting middleware
    - `backend/src/__tests__/github.test.ts`: GitHub API integration tests
  - **Step Dependencies**: Step 2
  - **User Instructions**: None

## Session Management (Extending Phase 1)

- [x] ~~Docker Container Management~~ (Already exists from Phase 1)

  - Phase 1 already has Docker container lifecycle management in `backend/src/docker/`

- [x] ~~WebSocket Terminal Bridge~~ (Already exists from Phase 1)

  - Phase 1 already has WebSocket terminal bridge in `backend/src/websocket/`

- [ ] Step 4: Multi-Session API Endpoints
  - **Task**: Implement REST API endpoints for multi-session CRUD operations with user authentication
  - **Description**: Create session management endpoints that handle multiple concurrent sessions per user, with proper isolation and GitHub repo cloning
  - **Files**:
    - `backend/src/routes/sessions.ts`: Multi-session CRUD endpoints
    - `backend/src/controllers/sessionController.ts`: Session business logic with GitHub integration
    - `backend/src/services/gitClone.ts`: Git repository cloning service
    - `backend/src/__tests__/sessions.test.ts`: Session API tests
  - **Step Dependencies**: Step 3
  - **User Instructions**: None

## Frontend Transformation (Building on Phase 1 Terminal)

- [x] ~~React App & Terminal Setup~~ (Already exists from Phase 1)

  - Phase 1 already has React app with xterm.js terminal component and WebSocket integration

- [ ] Step 5: Add React Router and Multi-Page Navigation

  - **Task**: Transform the existing single-page terminal app into a multi-page application with routing
  - **Description**: Add React Router to support multiple pages (login, create session, dashboard, terminal, diff viewer) while preserving existing terminal functionality
  - **Files**:
    - `frontend/package.json`: Add react-router-dom dependency
    - `frontend/src/App.tsx`: Replace with router-based navigation
    - `frontend/src/components/Layout.tsx`: Main layout component
    - `frontend/src/pages/TerminalPage.tsx`: Move existing terminal UI to dedicated page
    - `frontend/src/contexts/AuthContext.tsx`: Authentication context and provider
    - `frontend/src/hooks/useAuth.ts`: Authentication hook
    - `frontend/src/utils/api.ts`: API client utility
  - **Step Dependencies**: Step 1
  - **User Instructions**: None

- [ ] Step 6: Authentication UI
  - **Task**: Implement login page and authentication flow in React
  - **Description**: Create the GitHub login page and handle the OAuth callback, with proper error handling and loading states
  - **Files**:
    - `frontend/src/pages/LoginPage.tsx`: GitHub login page component
    - `frontend/src/components/LoginButton.tsx`: Reusable login button component
    - `frontend/src/services/auth.ts`: Frontend authentication service
    - `frontend/src/__tests__/LoginPage.test.tsx`: Login page tests
  - **Step Dependencies**: Step 5, Step 2
  - **User Instructions**: None

## Session Creation & Management UI

- [ ] Step 7: Session Creation Form

  - **Task**: Implement the session creation form with repository/branch selection and prompt input
  - **Description**: Create a comprehensive form that allows users to select repositories, branches, and enter prompts with validation and auto-completion
  - **Files**:
    - `frontend/src/pages/CreateSessionPage.tsx`: Session creation form page
    - `frontend/src/components/RepoSelector.tsx`: Repository selection with autocomplete
    - `frontend/src/components/BranchSelector.tsx`: Branch selection component
    - `frontend/src/components/PromptEditor.tsx`: Prompt input with syntax highlighting
    - `frontend/src/hooks/useGitHub.ts`: GitHub API integration hook
    - `frontend/src/__tests__/CreateSessionPage.test.tsx`: Form validation tests
  - **Step Dependencies**: Step 6, Step 3
  - **User Instructions**: None

- [ ] Step 8: Session Dashboard
  - **Task**: Implement session dashboard with list, resume, and delete functionality
  - **Description**: Create a dashboard that displays all user sessions with their status, idle time, and management actions
  - **Files**:
    - `frontend/src/pages/SessionsPage.tsx`: Sessions dashboard page
    - `frontend/src/components/SessionCard.tsx`: Individual session display card
    - `frontend/src/components/SessionActions.tsx`: Session action buttons
    - `frontend/src/hooks/useSessions.ts`: Session management hook
    - `frontend/src/__tests__/SessionsPage.test.tsx`: Dashboard functionality tests
  - **Step Dependencies**: Step 7, Step 4
  - **User Instructions**: None

## Terminal Integration (Extending Phase 1)

- [x] ~~Terminal Component~~ (Already exists from Phase 1)

  - Phase 1 already has xterm.js terminal component with WebSocket connection

- [ ] Step 9: Multi-Session Terminal Support
  - **Task**: Enhance existing terminal component to support session-specific connections
  - **Description**: Modify the existing terminal component to connect to specific session containers and handle session-specific WebSocket connections
  - **Files**:
    - `frontend/src/pages/TerminalPage.tsx`: Update to use session ID from URL params
    - `frontend/src/hooks/useTerminal.ts`: Update to support session-specific WebSocket connections
    - `frontend/src/hooks/useWebSocket.ts`: Update to handle session-specific connection URLs
  - **Step Dependencies**: Step 8
  - **User Instructions**: None

## Diff Viewer & Git Operations

- [ ] Step 10: Monaco Diff Viewer

  - **Task**: Implement Monaco editor for displaying diffs and file changes
  - **Description**: Create a diff viewer using Monaco editor that shows changes made during coding sessions with syntax highlighting
  - **Files**:
    - `frontend/package.json`: Add Monaco editor dependencies
    - `frontend/src/pages/DiffPage.tsx`: Diff viewer page
    - `frontend/src/components/DiffViewer.tsx`: Monaco diff component
    - `frontend/src/components/FileTree.tsx`: File tree navigation
    - `frontend/src/hooks/useDiff.ts`: Diff data management hook
    - `frontend/src/__tests__/DiffViewer.test.tsx`: Diff viewer tests
  - **Step Dependencies**: Step 9
  - **User Instructions**: None

- [ ] Step 11: Git Operations UI & Backend
  - **Task**: Implement commit and push functionality from the diff viewer
  - **Description**: Add UI controls to allow users to commit changes and push to their repositories directly from the diff viewer
  - **Files**:
    - `frontend/src/components/CommitPanel.tsx`: Commit message and actions
    - `frontend/src/components/GitActions.tsx`: Git operation buttons
    - `backend/src/routes/git.ts`: Git operation endpoints
    - `backend/src/services/gitOperations.ts`: Git service for commits/pushes
    - `frontend/src/hooks/useGit.ts`: Git operations hook
    - `frontend/src/__tests__/GitActions.test.tsx`: Git operations tests
  - **Step Dependencies**: Step 10
  - **User Instructions**: None

## Polish & Testing

- [ ] Step 12: Error Handling & Loading States

  - **Task**: Implement comprehensive error handling and loading states throughout the application
  - **Description**: Add proper error boundaries, loading spinners, and user-friendly error messages for all async operations
  - **Files**:
    - `frontend/src/components/ErrorBoundary.tsx`: React error boundary
    - `frontend/src/components/LoadingSpinner.tsx`: Loading state component
    - `frontend/src/hooks/useError.ts`: Error handling hook
    - `backend/src/middleware/validation.ts`: Request validation middleware
    - `frontend/src/__tests__/ErrorHandling.test.tsx`: Error handling tests
  - **Step Dependencies**: Step 11
  - **User Instructions**: None

- [ ] Step 13: End-to-End Testing

  - **Task**: Implement comprehensive end-to-end tests covering the complete user workflow
  - **Description**: Create E2E tests that validate the entire user journey from login to session completion
  - **Files**:
    - `package.json`: Add Playwright to root package.json
    - `e2e/login.spec.ts`: Login flow E2E tests
    - `e2e/session-creation.spec.ts`: Session creation E2E tests
    - `e2e/terminal.spec.ts`: Terminal interaction E2E tests
    - `e2e/diff-commit.spec.ts`: Diff viewing and commit E2E tests
    - `playwright.config.ts`: Playwright configuration
  - **Step Dependencies**: Step 12
  - **User Instructions**: Install Playwright browsers with `npx playwright install`

- [ ] Step 14: Documentation & Setup Scripts
  - **Task**: Create comprehensive documentation and setup scripts for easy deployment
  - **Description**: Document the complete setup process, API endpoints, and create automated setup scripts
  - **Files**:
    - `README.md`: Update with Phase 2 setup and usage documentation
    - `docs/API.md`: API endpoint documentation
    - `docs/DEPLOYMENT.md`: Deployment instructions
    - `scripts/setup.sh`: Automated setup script
    - `scripts/dev.sh`: Development environment startup script
    - `docker-compose.yml`: Complete development environment
  - **Step Dependencies**: Step 13
  - **User Instructions**: None

## Summary

This implementation plan breaks down the Amplify Phase 2 development into 14 manageable steps that build upon the existing Phase 1 foundation. The approach prioritizes:

1. **Build on Existing Infrastructure**: Leveraging the complete terminal, Docker, and WebSocket infrastructure from Phase 1
2. **Authentication & Multi-User Support**: Adding GitHub OAuth and session isolation
3. **Web-First Architecture**: Transforming the single-session CLI into a multi-session web application
4. **Progressive Enhancement**: Adding new features while preserving existing functionality

**Key Phase 1 Assets Being Reused**:

- Complete Docker container management (`backend/src/docker/`)
- WebSocket terminal bridge (`backend/src/websocket/`)
- React terminal component with xterm.js (`frontend/src/components/Terminal.tsx`)
- Express server foundation (`backend/src/server/`)
- Build tooling and TypeScript configurations

**Phase 2 Additions**:

- GitHub OAuth integration and user authentication
- Multi-session architecture with proper isolation
- Repository cloning and branch selection
- Session dashboard and management UI
- Monaco diff viewer for code changes
- Git operations (commit/push) from the web interface

The implementation will result in a complete web-based launcher that meets all acceptance criteria: GitHub OAuth login, session creation with repo/branch selection, real-time terminal access, diff viewing, and comprehensive session management - all while building efficiently on the robust Phase 1 foundation.
