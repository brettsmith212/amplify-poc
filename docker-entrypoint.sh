#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Amplify Container Starting${NC}"
echo "================================="

# Check if this is a session with repository
if [ -n "$REPOSITORY_URL" ]; then
    echo -e "${YELLOW}📦 Session Details:${NC}"
    echo "Repository: $REPOSITORY_URL"
    echo "Branch: ${REPOSITORY_BRANCH:-main}"
    echo "Session ID: ${SESSION_ID:-unknown}"
    echo ""
    
    # Extract repo name for directory
    REPO_NAME=$(basename "$REPOSITORY_URL" .git)
    WORKSPACE_DIR="/workspace/$REPO_NAME"
    
    echo -e "${BLUE}📥 Cloning repository...${NC}"
    
    # Clone the repository
    if git clone --depth 1 --branch "${REPOSITORY_BRANCH:-main}" "$REPOSITORY_URL" "$WORKSPACE_DIR"; then
        echo -e "${GREEN}✅ Repository cloned successfully${NC}"
        
        # Change to the repository directory
        cd "$WORKSPACE_DIR"
        echo -e "${BLUE}📁 Working directory: $(pwd)${NC}"
        
        # Show repository info
        echo -e "${YELLOW}📋 Repository Info:${NC}"
        echo "Current branch: $(git branch --show-current)"
        echo "Latest commit: $(git log -1 --pretty=format:'%h - %s (%an, %ar)')"
        echo ""
        
        echo -e "${BLUE}🛠️  You're now in an interactive shell in your repository.${NC}"
        echo -e "${BLUE}   You can run amp commands, explore your code, or make changes.${NC}"
        echo ""
        echo -e "${YELLOW}Useful commands:${NC}"
        echo "  amp \"your prompt\"   - Run amp with a prompt"
        echo "  git status           - Check git status"
        echo "  ls -la              - List files"
        echo ""
        
    else
        echo -e "${RED}❌ Failed to clone repository${NC}"
        echo -e "${YELLOW}📁 Starting in default workspace directory${NC}"
        cd /workspace
    fi
    
else
    echo -e "${YELLOW}📁 No repository configured - starting in default workspace${NC}"
    cd /workspace
fi

# Update the shell prompt to show we're in amplify
export PS1="\[\033[1;32m\][amplify]\[\033[0m\] \[\033[1;34m\]\w\[\033[0m\] $ "

# Start an interactive bash shell
echo -e "${GREEN}🎯 Ready for development!${NC}"
exec bash
