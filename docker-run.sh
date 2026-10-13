#!/bin/bash
# ========================================================
# Script to build and run Campus Navigation System in Docker
# ========================================================

set -e

echo "🐳 Building and starting Campus Navigation Docker container..."
docker compose up --build -d

echo ""
echo "✅ Container is running successfully!"
echo "🌐 Local URL: http://localhost:3000"
echo "🩺 Health Check: http://localhost:3000/api/health"
echo ""
echo "Useful commands:"
echo "  View logs:    docker compose logs -f"
echo "  Stop service: docker compose down"
echo "  Restart:      docker compose restart"
