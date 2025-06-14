#!/bin/bash

# Build script for amplify-base Docker image
# This creates the foundational image with amp CLI that will be reused across all sessions

set -e

IMAGE_NAME="amplify-base"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🐳 Building amplify-base Docker image..."
echo "📂 Project root: $PROJECT_ROOT"
echo ""

# Build the Docker image
cd "$PROJECT_ROOT"
docker build -t "$IMAGE_NAME" -f Dockerfile.base .

# Verify the image was built
if docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
    echo "✅ Successfully built $IMAGE_NAME image"
    
    # Show image details
    echo ""
    echo "📊 Image details:"
    docker image ls "$IMAGE_NAME" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    echo ""
    echo "🧪 Testing amp CLI in container..."
    
    # Test that amp CLI is available and working
    if docker run --rm "$IMAGE_NAME" amp --version >/dev/null 2>&1; then
        echo "✅ amp CLI is working in container"
        
        # Show version
        echo "📋 amp version:"
        docker run --rm "$IMAGE_NAME" amp --version
    else
        echo "❌ amp CLI test failed"
        exit 1
    fi
else
    echo "❌ Failed to build $IMAGE_NAME image"
    exit 1
fi

echo ""
echo "🎉 amplify-base image is ready for use!"
echo "💡 Next step: Run the Amplify CLI to create containers from this base image"
