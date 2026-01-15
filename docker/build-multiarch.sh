#!/bin/bash
# Multi-architecture Docker build script
# Builds Docker images for both AMD64 and ARM64 architectures
# Requires Docker Buildx to be installed and configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOCKERFILE_BACKEND="${SCRIPT_DIR}/Dockerfile.backend"
DOCKERFILE_FRONTEND="${SCRIPT_DIR}/Dockerfile.frontend"

# Build arguments with defaults
BUILD_DATE="${BUILD_DATE:-$(date -u +'%Y-%m-%dT%H:%M:%SZ')}"
VCS_REF="${VCS_REF:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"
VERSION="${VERSION:-1.0.0}"
NODE_VERSION="${NODE_VERSION:-25.2.1}"
NGINX_VERSION="${NGINX_VERSION:-alpine}"

# Platforms to build for
PLATFORMS="linux/amd64,linux/arm64"

# Image names
BACKEND_IMAGE="${BACKEND_IMAGE:-my-money-backend}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-my-money-frontend}"
IMAGE_TAG="${IMAGE_TAG:-${VERSION}}"

# Buildx builder name
BUILDER_NAME="multiarch-builder"

echo -e "${GREEN}=== Multi-Architecture Docker Build Script ===${NC}"
echo ""

# Check if buildx is available
if ! docker buildx version > /dev/null 2>&1; then
  echo -e "${RED}Error: Docker Buildx is not installed or not available${NC}"
  echo "Please install Docker Buildx: https://docs.docker.com/buildx/working-with-buildx/"
  exit 1
fi

# Create or use existing buildx builder
echo -e "${YELLOW}Setting up buildx builder...${NC}"
if ! docker buildx inspect "${BUILDER_NAME}" > /dev/null 2>&1; then
  echo "Creating new buildx builder: ${BUILDER_NAME}"
  docker buildx create --name "${BUILDER_NAME}" --use --bootstrap
else
  echo "Using existing buildx builder: ${BUILDER_NAME}"
  docker buildx use "${BUILDER_NAME}"
fi

# Function to build an image
build_image() {
  local dockerfile=$1
  local image_name=$2
  local context=$3
  local build_args=$4

  echo ""
  echo -e "${GREEN}Building ${image_name} for platforms: ${PLATFORMS}${NC}"
  echo "Dockerfile: ${dockerfile}"
  echo "Context: ${context}"
  echo ""

  docker buildx build \
    --platform "${PLATFORMS}" \
    --file "${dockerfile}" \
    --tag "${image_name}:${IMAGE_TAG}" \
    --tag "${image_name}:latest" \
    ${build_args} \
    --push \
    "${context}"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully built and pushed ${image_name}${NC}"
  else
    echo -e "${RED}✗ Failed to build ${image_name}${NC}"
    return 1
  fi
}

# Parse command line arguments
BUILD_BACKEND=true
BUILD_FRONTEND=true
PUSH_IMAGES=false
LOAD_LOCAL=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --backend-only)
      BUILD_FRONTEND=false
      shift
      ;;
    --frontend-only)
      BUILD_BACKEND=false
      shift
      ;;
    --push)
      PUSH_IMAGES=true
      shift
      ;;
    --load)
      LOAD_LOCAL=true
      PLATFORMS="linux/amd64"  # Can only load single platform
      shift
      ;;
    --tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --platforms)
      PLATFORMS="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --backend-only      Build only the backend image"
      echo "  --frontend-only      Build only the frontend image"
      echo "  --push               Push images to registry (requires login)"
      echo "  --load               Load image into local Docker (single platform only)"
      echo "  --tag TAG            Tag to use for images (default: ${VERSION})"
      echo "  --platforms PLATFORMS  Comma-separated list of platforms (default: ${PLATFORMS})"
      echo "  --help               Show this help message"
      echo ""
      echo "Environment variables:"
      echo "  BUILD_DATE          Build date (default: current UTC time)"
      echo "  VCS_REF             Git commit hash (default: current HEAD)"
      echo "  VERSION              Version tag (default: 1.0.0)"
      echo "  NODE_VERSION         Node.js version (default: 25.2.1)"
      echo "  NGINX_VERSION        Nginx version (default: alpine)"
      echo "  BACKEND_IMAGE        Backend image name (default: my-money-backend)"
      echo "  FRONTEND_IMAGE       Frontend image name (default: my-money-frontend)"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Prepare build arguments
BACKEND_BUILD_ARGS="--build-arg BUILD_DATE=${BUILD_DATE} --build-arg VCS_REF=${VCS_REF} --build-arg VERSION=${VERSION} --build-arg NODE_VERSION=${NODE_VERSION}"
FRONTEND_BUILD_ARGS="--build-arg BUILD_DATE=${BUILD_DATE} --build-arg VCS_REF=${VCS_REF} --build-arg VERSION=${VERSION} --build-arg NODE_VERSION=${NODE_VERSION} --build-arg NGINX_VERSION=${NGINX_VERSION}"

# Determine build output
BUILD_OUTPUT=""
if [ "$PUSH_IMAGES" = true ]; then
  BUILD_OUTPUT="--push"
  echo -e "${YELLOW}Images will be pushed to registry${NC}"
elif [ "$LOAD_LOCAL" = true ]; then
  BUILD_OUTPUT="--load"
  echo -e "${YELLOW}Images will be loaded into local Docker${NC}"
  if [ "$PLATFORMS" != "linux/amd64" ]; then
    echo -e "${YELLOW}Warning: --load only works with single platform. Using linux/amd64${NC}"
    PLATFORMS="linux/amd64"
  fi
else
  BUILD_OUTPUT="--load"
  echo -e "${YELLOW}Building for local use (use --push to push to registry)${NC}"
  if [ "$PLATFORMS" != "linux/amd64" ]; then
    echo -e "${YELLOW}Warning: --load only works with single platform. Using linux/amd64${NC}"
    PLATFORMS="linux/amd64"
  fi
fi

# Build backend
if [ "$BUILD_BACKEND" = true ]; then
  docker buildx build \
    --platform "${PLATFORMS}" \
    --file "${DOCKERFILE_BACKEND}" \
    --tag "${BACKEND_IMAGE}:${IMAGE_TAG}" \
    --tag "${BACKEND_IMAGE}:latest" \
    ${BACKEND_BUILD_ARGS} \
    ${BUILD_OUTPUT} \
    "${PROJECT_ROOT}"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully built ${BACKEND_IMAGE}${NC}"
  else
    echo -e "${RED}✗ Failed to build ${BACKEND_IMAGE}${NC}"
    exit 1
  fi
fi

# Build frontend
if [ "$BUILD_FRONTEND" = true ]; then
  docker buildx build \
    --platform "${PLATFORMS}" \
    --file "${DOCKERFILE_FRONTEND}" \
    --tag "${FRONTEND_IMAGE}:${IMAGE_TAG}" \
    --tag "${FRONTEND_IMAGE}:latest" \
    ${FRONTEND_BUILD_ARGS} \
    ${BUILD_OUTPUT} \
    "${PROJECT_ROOT}"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Successfully built ${FRONTEND_IMAGE}${NC}"
  else
    echo -e "${RED}✗ Failed to build ${FRONTEND_IMAGE}${NC}"
    exit 1
  fi
fi

echo ""
echo -e "${GREEN}=== Build Complete ===${NC}"
echo "Backend image: ${BACKEND_IMAGE}:${IMAGE_TAG}"
echo "Frontend image: ${FRONTEND_IMAGE}:${IMAGE_TAG}"
echo "Platforms: ${PLATFORMS}"
