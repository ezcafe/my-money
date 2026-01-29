#!/bin/bash
# Script to deploy My Money application with production overrides
# This script builds and starts the application using docker-compose.prod.yml
#
# Usage:
#   ./scripts/docker-prod-deploy.sh [--build] [--no-build]
#
# Options:
#   --build    Force rebuild images (default behavior)
#   --no-build Skip building, only start existing images
#   --help     Show this help message

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Change to project root
cd "$PROJECT_ROOT"

# Default behavior
BUILD=true

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --build)
      BUILD=true
      shift
      ;;
    --no-build)
      BUILD=false
      shift
      ;;
    --help)
      echo "Usage: $0 [--build] [--no-build]"
      echo ""
      echo "Deploy My Money application with production overrides."
      echo ""
      echo "Options:"
      echo "  --build     Force rebuild images (default)"
      echo "  --no-build  Skip building, only start existing images"
      echo "  --help      Show this help message"
      exit 0
      ;;
    *)
      echo -e "${RED}Error:${NC} Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo -e "${RED}Error:${NC} .env file not found in project root"
  echo "Please create .env file from .env.example:"
  echo "  cp .env.example .env"
  exit 1
fi

# Check if docker-compose files exist
if [ ! -f "docker/docker-compose.yml" ]; then
  echo -e "${RED}Error:${NC} docker/docker-compose.yml not found"
  exit 1
fi

if [ ! -f "docker/docker-compose.prod.yml" ]; then
  echo -e "${RED}Error:${NC} docker/docker-compose.prod.yml not found"
  exit 1
fi

# Enable BuildKit for better caching and performance
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}My Money - Production Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Build images if requested
if [ "$BUILD" = true ]; then
  echo -e "${YELLOW}→${NC} Preparing Docker images..."
  bash scripts/docker-prepare-images.sh

  echo ""
  echo -e "${YELLOW}→${NC} Building Docker images with production overrides..."
  docker compose \
    -f docker/docker-compose.yml \
    -f docker/docker-compose.prod.yml \
    --env-file .env \
    build \
    --parallel \
    --no-cache

  echo -e "${GREEN}✓${NC} Images built successfully"
  echo ""
fi

# Start services
echo -e "${YELLOW}→${NC} Starting services with production overrides..."
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.prod.yml \
  --env-file .env \
  up -d

echo ""
echo -e "${GREEN}✓${NC} Services started successfully"
echo ""

# Wait a moment for services to initialize
echo -e "${YELLOW}→${NC} Waiting for services to initialize..."
sleep 5

# Show service status
echo ""
echo -e "${BLUE}Service Status:${NC}"
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.prod.yml \
  ps

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:        docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml logs -f"
echo "  Stop services:    docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml down"
echo "  View status:     docker compose -f docker/docker-compose.yml -f docker/docker-compose.prod.yml ps"
echo ""
