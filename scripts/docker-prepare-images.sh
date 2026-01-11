#!/bin/bash
# Script to prepare Docker images locally to avoid rate limiting during builds

set +e  # Don't exit on error - we want to continue even if pulls fail

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

# Get image versions from environment or use defaults
NODE_VERSION=${NODE_VERSION:-25.2.1}
NGINX_VERSION=${NGINX_VERSION:-alpine}

# Images needed for the build
NODE_IMAGE="node:${NODE_VERSION}-alpine"
NGINX_IMAGE="nginx:${NGINX_VERSION}"

echo "Preparing Docker images for build..."
echo ""

# Pull node image
pull_image "$NODE_IMAGE" || true

# Pull nginx image
pull_image "$NGINX_IMAGE" || true

echo ""
echo "Image preparation complete. Proceeding with build..."
