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

**Quick Setup (Recommended):**
```bash
make deps          # Install all dependencies
make build-install # Build and install amplify globally
```

**Manual Setup:**
1. **Install dependencies:**
   ```bash
   cd backend && npm install
   cd frontend && npm install
   ```

2. **Build and install:**
   ```bash
   make build         # Build frontend and backend
   make install       # Install amplify globally
   ```

### Development

**Quick Build & Install:**
```bash
make build         # Build frontend and backend
make install       # Install amplify globally
# OR
make build-install # Build and install in one command
```

**Other Make targets:**
```bash
make deps          # Install dependencies
make dev           # Start development server
make clean         # Clean build artifacts
make docker-build  # Build Docker base image
make help          # Show all available targets
```

**Manual Development:**
```bash
cd backend
npm run dev        # Start in development mode
npm run build      # Build TypeScript
npm run test       # Run tests
```

```bash
cd frontend
npm run dev        # Start Vite dev server
npm run build      # Build for production
npm run test       # Run tests
```

## Usage

✅ **Ready to Use!**

From any git repository, run:

```bash
amplify
# OR
npx amplify
```

**What happens:**
1. ✅ Validates environment and git repository
2. ✅ Builds/checks Docker base image with amp CLI
3. ✅ Starts ephemeral container with repo mounted read-only
4. ✅ Launches browser terminal at http://localhost:3000
5. ✅ Enables running amp commands in containerized environment
6. ✅ Automatically cleans up container on exit

**Example workflow:**
```bash
cd my-project/
amplify                           # Launches browser terminal
# In browser terminal:
echo "create python script that adds two numbers" | amp
# Ctrl+C to exit and cleanup
```

## Implementation Status

🎉 **Complete!** All 12 steps from [`implementation.md`](./implementation.md) have been implemented.

**Key Features Implemented:**
- ✅ Docker base image with amp CLI
- ✅ Container lifecycle management  
- ✅ WebSocket terminal bridge
- ✅ React frontend with xterm.js
- ✅ Express web server with Vite integration
- ✅ CLI orchestration with browser auto-launch
- ✅ Error handling and graceful cleanup
- ✅ Cross-platform support (Linux, macOS, Windows)

## Definition of Done

1. ✅ Run `amplify` from any git repo
2. ✅ Browser appears in < 3 s
3. ✅ `echo "create python script that adds two numbers" | amp` builds valid python script in docker container
4. ✅ Exiting CLI removes container (`docker ps` is clean)
5. ✅ Host repo never modified (mounted `:ro`)

**All requirements met!** 🚀

## Contributing

See [`implementation.md`](./implementation.md) for the detailed step-by-step implementation plan.

Each step is designed to be atomic and implementable independently.
