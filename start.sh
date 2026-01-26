#!/bin/bash

# PDF RAG System - Quick Start Script
# This script helps you start all services in the correct order

set -e  # Exit on error

echo "🚀 Starting PDF RAG System..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "📦 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Check if .env file exists in server
echo "🔐 Checking environment variables..."
if [ ! -f "server/.env" ]; then
    echo -e "${YELLOW}⚠️  server/.env not found!${NC}"
    echo "Creating from template..."
    cp server/.env.example server/.env
    echo -e "${YELLOW}⚠️  Please edit server/.env and add your OpenAI API key${NC}"
    echo ""
    read -p "Press enter to continue once you've added your API key..."
fi
echo -e "${GREEN}✅ Environment file exists${NC}"
echo ""

# Start Docker services
echo "🐳 Starting Docker services (Redis & Qdrant)..."
cd client
docker-compose up -d
cd ..

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if services are running
REDIS_RUNNING=$(docker ps --filter "ancestor=valkey/valkey" --format "{{.ID}}" | wc -l)
QDRANT_RUNNING=$(docker ps --filter "ancestor=qdrant/qdrant" --format "{{.ID}}" | wc -l)

if [ "$REDIS_RUNNING" -eq 0 ]; then
    echo -e "${RED}❌ Redis/Valkey is not running${NC}"
    exit 1
fi

if [ "$QDRANT_RUNNING" -eq 0 ]; then
    echo -e "${RED}❌ Qdrant is not running${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Redis/Valkey is running${NC}"
echo -e "${GREEN}✅ Qdrant is running${NC}"
echo ""

# Create Qdrant collection if it doesn't exist
echo "📊 Setting up Qdrant collection..."
COLLECTION_EXISTS=$(curl -s http://localhost:6333/collections/langchainjs-testing | grep -c '"status":"ok"' || echo "0")

if [ "$COLLECTION_EXISTS" -eq 0 ]; then
    echo "Creating collection..."
    curl -X PUT http://localhost:6333/collections/langchainjs-testing \
      -H 'Content-Type: application/json' \
      -d '{
        "vectors": {
          "size": 1536,
          "distance": "Cosine"
        }
      }' > /dev/null 2>&1
    echo -e "${GREEN}✅ Qdrant collection created${NC}"
else
    echo -e "${GREEN}✅ Qdrant collection already exists${NC}"
fi
echo ""

echo -e "${GREEN}✅ All external services are ready!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Now open 3 separate terminals and run:"
echo ""
echo -e "${YELLOW}Terminal 1 (Backend):${NC}"
echo "  cd server && pnpm run dev"
echo ""
echo -e "${YELLOW}Terminal 2 (Worker):${NC}"
echo "  cd server && pnpm run dev:worker"
echo ""
echo -e "${YELLOW}Terminal 3 (Frontend):${NC}"
echo "  cd client && pnpm run dev"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Once started, access the app at:"
echo "   http://localhost:3000"
echo ""
echo "🔍 API Health check:"
echo "   http://localhost:8000/health"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
