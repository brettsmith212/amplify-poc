# Amplify POC

> **Create an _ephemeral_ Docker container that mounts the current repo read-only, already has the `amp` CLI installed, and exposes a browser terminal that forwards commands to `amp` running inside the container.**

## Architecture

```
local shell           Amplify CLI (Node)           Container
┌──────────┐  build   ┌────────────────────┐ run   ┌──────────────┐
│  user    │ ───────▶ │  amplify (orch.)   │ ────▶ │ amplify-base │
└──────────┘          │  • builds image    │       │ • amp CLI    │
                      │  • runs container  │  WS   │ • /workspace │
┌─────────────────────┴────────────────────┴───────┴──────────────┐
│ Browser http://localhost:3000 ←→ WebSocket ←→ docker exec -it   │
│            (xterm.js)                                           │
└──────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
amplify-poc/
├── backend/              # Node.js CLI backend
│   ├── package.json      # Backend dependencies
│   ├── tsconfig.json     # Backend TypeScript config
│   └── src/              # Backend source code
└── frontend/             # React frontend
    ├── package.json      # Frontend dependencies
    ├── tsconfig.json     # Frontend TypeScript config
    └── src/              # React app source
```

## Development Setup

### Prerequisites

- Node.js 18+ 
- Docker
- Git repository (for mounting)

### Installation

1. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

### Development

**Backend Development:**
```bash
cd backend
npm run dev        # Start in development mode
npm run build      # Build TypeScript
npm run test       # Run tests
```

**Frontend Development:**
```bash
cd frontend
npm run dev        # Start Vite dev server
npm run build      # Build for production
npm run test       # Run tests
```

## Usage

⚠️ **Implementation in Progress**

Once complete, usage will be:

```bash
# From any git repository
npx amplify

# This will:
# 1. Build/check Docker base image
# 2. Start container with repo mounted read-only
# 3. Launch browser terminal at http://localhost:3000
# 4. Enable running amp commands in containerized environment
```

## Implementation Status

This project follows a detailed implementation plan in [`implementation.md`](./implementation.md).

**Current Status:** ✅ Step 1 Complete - Project structure initialized

**Next Steps:**
- Step 2: Create Docker base image with amp CLI
- Step 3: Implement Docker image management
- Step 4: Container lifecycle management
- ... (see implementation.md for full plan)

## Definition of Done

1. ✅ Run `npx amplify` from any git repo
2. ⏳ Browser appears in < 3 s
3. ⏳ `echo "create python script that adds two numbers" | amp` builds valid python script in docker container
4. ⏳ Exiting CLI removes container (`docker ps` is clean)
5. ⏳ Host repo never modified (mounted `:ro`)

## Contributing

See [`implementation.md`](./implementation.md) for the detailed step-by-step implementation plan.

Each step is designed to be atomic and implementable independently.
