#!/bin/bash

# PDF RAG Project - Verification Script
# This script checks if your project is correctly set up

echo "🔍 PDF RAG Project - Setup Verification"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to check status
check_pass() {
    echo -e "${GREEN}✅ PASS${NC} - $1"
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC} - $1"
    ((WARNINGS++))
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC} - $1"
    ((ERRORS++))
}

# 1. Check if server/.env exists
echo "1. Checking Backend Configuration..."
if [ -f "server/.env" ]; then
    check_pass "server/.env file exists"
    
    # Check if API key is set
    if grep -q "OPENAI_API_KEY=" server/.env; then
        check_pass "OPENAI_API_KEY is defined"
        
        # Check if key looks valid
        if grep -q "OPENAI_API_KEY=sk-" server/.env; then
            check_pass "API key format looks correct (starts with sk-)"
        else
            check_warn "API key might be invalid (should start with sk-)"
        fi
    else
        check_fail "OPENAI_API_KEY not found in .env"
    fi
    
    # Check Redis URL
    if grep -q "REDIS_URL=" server/.env; then
        check_pass "REDIS_URL is defined"
    else
        check_warn "REDIS_URL not defined (will use default)"
    fi
else
    check_fail "server/.env file not found"
fi
echo ""

# 2. Check if dependencies are installed
echo "2. Checking Dependencies..."
if [ -d "server/node_modules" ]; then
    check_pass "Backend dependencies installed"
else
    check_fail "Backend dependencies not installed (run: cd server && pnpm install)"
fi

if [ -d "client/node_modules" ]; then
    check_pass "Frontend dependencies installed"
else
    check_fail "Frontend dependencies not installed (run: cd client && pnpm install)"
fi
echo ""

# 3. Check if favicon exists
echo "3. Checking Frontend Configuration..."
if [ -f "client/public/favicon.ico" ]; then
    check_pass "Favicon exists in public folder"
else
    check_warn "Favicon not found in public folder"
fi

if [ -f "client/app/icon.tsx" ]; then
    check_pass "Dynamic icon generator exists"
else
    check_warn "Dynamic icon generator not found"
fi
echo ""

# 4. Check if Docker is running
echo "4. Checking Docker Services..."
if command -v docker &> /dev/null; then
    check_pass "Docker is installed"
    
    # Check if Docker is running
    if docker info &> /dev/null; then
        check_pass "Docker is running"
        
        # Check for Qdrant
        if docker ps | grep -q "qdrant"; then
            check_pass "Qdrant container is running"
        else
            check_warn "Qdrant container not running (run: cd client && docker-compose up -d)"
        fi
        
        # Check for Redis/Valkey
        if docker ps | grep -q "valkey"; then
            check_pass "Redis/Valkey container is running"
        else
            check_warn "Redis/Valkey container not running (run: cd client && docker-compose up -d)"
        fi
    else
        check_warn "Docker is not running"
    fi
else
    check_warn "Docker is not installed"
fi
echo ""

# 5. Check if services are responding
echo "5. Checking Service Availability..."

# Check backend
if curl -s http://localhost:8000/health &> /dev/null; then
    HEALTH_RESPONSE=$(curl -s http://localhost:8000/health)
    if echo "$HEALTH_RESPONSE" | grep -q "Backend is running"; then
        check_pass "Backend is running and healthy (port 8000)"
    else
        check_warn "Backend responded but health check unexpected"
    fi
else
    check_warn "Backend not responding (run: cd server && pnpm run dev)"
fi

# Check frontend
if curl -s http://localhost:3000 &> /dev/null; then
    check_pass "Frontend is running (port 3000)"
else
    check_warn "Frontend not responding (run: cd client && pnpm run dev)"
fi

# Check Qdrant
if curl -s http://localhost:6333/ &> /dev/null; then
    check_pass "Qdrant is accessible (port 6333)"
else
    check_warn "Qdrant not responding"
fi
echo ""

# 6. Check important files exist
echo "6. Checking Project Files..."
FILES_TO_CHECK=(
    "server/index.js"
    "server/worker.js"
    "server/package.json"
    "client/app/layout.tsx"
    "client/app/page.tsx"
    "client/app/components/chat.tsx"
    "client/app/components/file-upload.tsx"
)

for file in "${FILES_TO_CHECK[@]}"; do
    if [ -f "$file" ]; then
        check_pass "$file exists"
    else
        check_fail "$file not found"
    fi
done
echo ""

# Summary
echo "========================================"
echo "📊 Verification Summary"
echo "========================================"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}🎉 Perfect! Everything is set up correctly!${NC}"
    echo ""
    echo "✅ Your project is ready to run!"
    echo ""
    echo "To start:"
    echo "  1. Backend:  cd server && pnpm run dev"
    echo "  2. Worker:   cd server && pnpm run dev:worker"
    echo "  3. Frontend: cd client && pnpm run dev"
    echo "  4. Open:     http://localhost:3000"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Setup is mostly complete with $WARNINGS warning(s)${NC}"
    echo ""
    echo "Your project should work, but check warnings above."
    echo "Some features might not work without optional services."
else
    echo -e "${RED}❌ Found $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix the errors above before running the project."
    echo ""
    echo "Common fixes:"
    echo "  • Create server/.env with OPENAI_API_KEY"
    echo "  • Run: cd server && pnpm install"
    echo "  • Run: cd client && pnpm install"
    echo "  • Run: cd client && docker-compose up -d"
fi

echo ""
echo "For detailed setup instructions, see: SETUP_GUIDE.md"
echo "For error handling help, see: ERROR_HANDLING_GUIDE.md"
echo ""
