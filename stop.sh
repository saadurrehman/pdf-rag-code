#!/bin/bash

# PDF RAG System - Stop Script
# This script stops all running services

echo "🛑 Stopping PDF RAG System..."
echo ""

# Stop Docker services
echo "🐳 Stopping Docker services..."
cd client
docker-compose down
cd ..

echo "✅ Docker services stopped"
echo ""
echo "ℹ️  Note: Backend, Worker, and Frontend processes need to be stopped manually"
echo "   (Press Ctrl+C in their respective terminal windows)"
