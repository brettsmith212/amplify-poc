.PHONY: build install clean dev test help

# Default target
all: build install

# Build frontend and backend, then install globally
build:
	@echo "🔨 Building frontend..."
	cd frontend && npm run build
	@echo "🔨 Building backend..."
	cd backend && npm run build
	@echo "✅ Build complete"

# Install amplify globally
install:
	@echo "📦 Installing amplify globally..."
	cd backend && npm install -g .
	@echo "✅ Amplify installed globally"
	@echo "🚀 You can now run 'amplify' from any directory"

# Build and install in one command
build-install: build install

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	rm -rf frontend/dist
	rm -rf backend/dist
	@echo "✅ Clean complete"

# Development mode (start backend dev server)
dev:
	@echo "🚀 Starting development server..."
	cd backend && npm run dev

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
	@echo "  install       - Install amplify globally"
	@echo "  build-install - Build and install in one command"
	@echo "  clean         - Clean build artifacts"
	@echo "  dev           - Start development server"
	@echo "  deps          - Install dependencies"
	@echo "  test          - Run tests"
	@echo "  docker-build  - Build Docker base image"
	@echo "  help          - Show this help message"
