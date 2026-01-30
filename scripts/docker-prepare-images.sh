#!/bin/bash
# Script to prepare Docker images locally to avoid rate limiting during builds
# Also enables BuildKit for better caching and parallel builds
# Uses root .env for variables (e.g. NODE_VERSION) when present.

set +e  # Don't exit on error - we want to continue even if pulls fail

# Resolve project root (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Load root .env so NODE_VERSION, NGINX_VERSION, POSTGRES_VERSION can be overridden
ENV_FILE="${PROJECT_ROOT}/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

# Enable BuildKit for better caching and performance
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if image exists locally
image_exists() {
  docker image inspect "$1" >/dev/null 2>&1
}

# Function to pull image with error handling
pull_image() {
  local image=$1
  if image_exists "$image"; then
    echo -e "${GREEN}✓${NC} Image $image already exists locally"
    return 0
  fi

  echo -e "${YELLOW}→${NC} Pulling image $image..."
  pull_output=$(docker pull "$image" 2>&1)
  pull_exit=$?

  if [ $pull_exit -ne 0 ]; then
    if echo "$pull_output" | grep -q "rate limit\|429\|toomanyrequests"; then
      echo -e "${RED}✗${NC} Docker Hub rate limit reached for $image"
      echo -e "${YELLOW}⚠${NC}  Image not available locally. Build may fail."
      echo -e "${YELLOW}💡${NC}  Solutions:"
      echo -e "   1. Wait for rate limit to reset (usually 6 hours)"
      echo -e "   2. Authenticate with Docker Hub: docker login"
      echo -e "   3. Use a Docker registry mirror"
      return 1
    else
      echo -e "${RED}✗${NC} Failed to pull $image: $pull_output"
      return 1
    fi
  fi
  echo -e "${GREEN}✓${NC} Successfully pulled $image"
  return 0
}

# Function to validate that an image exists and is accessible
validate_image() {
  local image=$1
  if ! docker image inspect "$image" >/dev/null 2>&1; then
    echo -e "${RED}✗${NC} Error: Image $image validation failed - image not found"
    return 1
  fi
  echo -e "${GREEN}✓${NC} Image $image validated"
  return 0
}

# Get image versions from environment or use defaults
NODE_VERSION=${NODE_VERSION:-25.2.1}
NGINX_VERSION=${NGINX_VERSION:-alpine}
POSTGRES_VERSION=${POSTGRES_VERSION:-18-alpine}

# Images needed for the build
NODE_IMAGE="node:${NODE_VERSION}-alpine"
NGINX_IMAGE="nginx:${NGINX_VERSION}"
POSTGRES_IMAGE="postgres:${POSTGRES_VERSION}"

echo "Preparing Docker images for build..."
echo ""

# Track pull results
NODE_PULL_FAILED=0
NGINX_PULL_FAILED=0
POSTGRES_PULL_FAILED=0

# Pull images in parallel for faster preparation
pull_image "$NODE_IMAGE" &
NODE_PID=$!

pull_image "$NGINX_IMAGE" &
NGINX_PID=$!

pull_image "$POSTGRES_IMAGE" &
POSTGRES_PID=$!

# Wait for all pulls to complete with proper error handling
wait $NODE_PID || NODE_PULL_FAILED=1
wait $NGINX_PID || NGINX_PULL_FAILED=1
wait $POSTGRES_PID || POSTGRES_PULL_FAILED=1

echo ""
echo "Validating pulled images..."
echo ""

# Validate all images
VALIDATION_FAILED=0
if [ $NODE_PULL_FAILED -eq 0 ]; then
  validate_image "$NODE_IMAGE" || VALIDATION_FAILED=1
else
  echo -e "${YELLOW}⚠${NC}  Skipping validation for $NODE_IMAGE (pull failed)"
  VALIDATION_FAILED=1
fi

if [ $NGINX_PULL_FAILED -eq 0 ]; then
  validate_image "$NGINX_IMAGE" || VALIDATION_FAILED=1
else
  echo -e "${YELLOW}⚠${NC}  Skipping validation for $NGINX_IMAGE (pull failed)"
  VALIDATION_FAILED=1
fi

if [ $POSTGRES_PULL_FAILED -eq 0 ]; then
  validate_image "$POSTGRES_IMAGE" || VALIDATION_FAILED=1
else
  echo -e "${YELLOW}⚠${NC}  Skipping validation for $POSTGRES_IMAGE (pull failed)"
  VALIDATION_FAILED=1
fi

echo ""
if [ $VALIDATION_FAILED -eq 0 ]; then
  echo -e "${GREEN}✓${NC} Image preparation complete. All images validated."
  echo "BuildKit is enabled for optimized caching and parallel builds."
  exit 0
else
  echo -e "${YELLOW}⚠${NC}  Image preparation completed with warnings."
  echo "Some images may not be available. Build may fail or be slower."
  echo "BuildKit is enabled for optimized caching and parallel builds."
  exit 1
fi
