.PHONY: build clean dev test help

# Default target
all: build

# Build frontend and backend
build:
	@echo "🔨 Building frontend..."
	cd frontend && npm run build
	@echo "🔨 Building backend..."
	cd backend && npm run build
	@echo "✅ Build complete"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf frontend/dist
	rm -rf backend/dist
	@echo "✅ Clean complete"

# Development mode (start backend and frontend dev servers)
dev:
	@echo "🚀 Starting development servers..."
	@echo "Backend: http://localhost:3000"
	@echo "Frontend: http://localhost:5173"
	@trap 'kill $$(jobs -p) 2>/dev/null; exit' INT TERM; \
	cd backend && npm run dev & \
	BACKEND_PID=$$!; \
	cd frontend && npm run dev & \
	FRONTEND_PID=$$!; \
	wait $$BACKEND_PID $$FRONTEND_PID

# Install dependencies for both frontend and backend
deps:
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install
	@echo "📦 Installing backend dependencies..."
	cd backend && npm install
	@echo "✅ Dependencies installed"

# Run tests
test:
	@echo "🧪 Running frontend tests..."
	cd frontend && npm test
	@echo "🧪 Running backend tests..."
	cd backend && npm test

# Build Docker base image
docker-build:
	@echo "🐳 Building Docker base image..."
	./scripts/build-base-image.sh
	@echo "✅ Docker base image built"

# Help target
help:
	@echo "Available targets:"
	@echo "  build         - Build frontend and backend"
	@echo "  clean         - Clean build artifacts"
	@echo "  dev           - Start development servers"
	@echo "  deps          - Install dependencies"
	@echo "  test          - Run tests"
	@echo "  docker-build  - Build Docker base image"
	@echo "  help          - Show this help message"
