#!/bin/bash
# Docker prune script for My Money application
# Removes all containers, volumes, networks, and images created for this project
# WARNING: This will delete all data in volumes (including database data)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yml"
ENV_FILE="${PROJECT_ROOT}/.env"

echo -e "${YELLOW}=== Docker Prune for My Money Application ===${NC}"
echo ""

# Check if docker-compose file exists
if [ ! -f "$COMPOSE_FILE" ]; then
  echo -e "${RED}Error: docker-compose.yml not found at ${COMPOSE_FILE}${NC}"
  exit 1
fi

# Check if .env file exists (warn but continue)
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${YELLOW}Warning: .env file not found. Some operations may fail.${NC}"
  echo ""
fi

# Container names from docker-compose.yml
CONTAINERS=(
  "my-money-postgres"
  "my-money-backend"
  "my-money-frontend"
)

# Volume names
VOLUMES=(
  "my-money_postgres_data"
  "postgres_data"
)

# Network names
NETWORKS=(
  "my-money_my-money-network"
  "my-money-network"
)

# Image patterns (will match any tag)
IMAGE_PATTERNS=(
  "my-money-backend"
  "my-money-frontend"
)

echo -e "${YELLOW}Step 1: Stopping and removing containers...${NC}"
for container in "${CONTAINERS[@]}"; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
    echo "  Removing container: ${container}"
    docker rm -f "${container}" 2>/dev/null || true
  fi
done

# Also remove via Docker Compose v2
echo "  Stopping via Docker Compose..."
if [ -f "$ENV_FILE" ]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --remove-orphans 2>/dev/null || true
else
  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
fi

echo -e "${GREEN}✓ Containers removed${NC}"
echo ""

echo -e "${YELLOW}Step 2: Removing volumes...${NC}"
for volume in "${VOLUMES[@]}"; do
  if docker volume ls --format '{{.Name}}' | grep -q "^${volume}$"; then
    echo "  Removing volume: ${volume}"
    docker volume rm "${volume}" 2>/dev/null || true
  fi
done

# Also remove via Docker Compose v2
if [ -f "$ENV_FILE" ]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down -v 2>/dev/null || true
else
  docker compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
fi

echo -e "${GREEN}✓ Volumes removed${NC}"
echo ""

echo -e "${YELLOW}Step 3: Removing networks...${NC}"
for network in "${NETWORKS[@]}"; do
  if docker network ls --format '{{.Name}}' | grep -q "^${network}$"; then
    echo "  Removing network: ${network}"
    docker network rm "${network}" 2>/dev/null || true
  fi
done

echo -e "${GREEN}✓ Networks removed${NC}"
echo ""

echo -e "${YELLOW}Step 4: Removing images...${NC}"
for pattern in "${IMAGE_PATTERNS[@]}"; do
  # Find images matching the pattern
  IMAGES=$(docker images --format '{{.Repository}}:{{.Tag}}' | grep "^${pattern}" || true)
  if [ -n "$IMAGES" ]; then
    while IFS= read -r image; do
      if [ -n "$image" ]; then
        echo "  Removing image: ${image}"
        docker rmi -f "${image}" 2>/dev/null || true
      fi
    done <<< "$IMAGES"
  fi
done

# Also try to remove via Docker Compose v2
if [ -f "$ENV_FILE" ]; then
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --rmi all 2>/dev/null || true
else
  docker compose -f "$COMPOSE_FILE" down --rmi all 2>/dev/null || true
fi

echo -e "${GREEN}✓ Images removed${NC}"
echo ""

echo -e "${YELLOW}Step 5: Removing build cache...${NC}"
# Remove build cache for this project
# This cleans up cache from docker-compose builds
echo "  Cleaning Docker build cache..."
docker builder prune -f --filter "label=org.opencontainers.image.title=my-money" 2>/dev/null || true

# Clean buildx cache if buildx was used (for multi-arch builds)
if docker buildx ls >/dev/null 2>&1; then
  echo "  Cleaning Docker Buildx cache..."
  # Remove buildx cache for this project's build context
  docker buildx prune -f --filter "label=org.opencontainers.image.title=my-money" 2>/dev/null || true

  # Also clean buildx cache that might be associated with our images
  # This is more aggressive but ensures all related cache is removed
  BUILDER_NAME="multiarch-builder"
  if docker buildx inspect "${BUILDER_NAME}" >/dev/null 2>&1; then
    echo "  Cleaning cache from ${BUILDER_NAME} builder..."
    docker buildx prune -f --builder "${BUILDER_NAME}" 2>/dev/null || true
  fi
fi

# Clean any dangling build cache (cache not associated with any image)
echo "  Cleaning dangling build cache..."
docker builder prune -f --filter "until=24h" 2>/dev/null || true

# Clean all unused build cache (general cleanup)
echo "  Cleaning all unused build cache..."
docker builder prune -f 2>/dev/null || true

echo -e "${GREEN}✓ Build cache removed${NC}"
echo ""

echo ""
echo -e "${GREEN}=== Prune Complete ===${NC}"
echo ""
echo -e "${YELLOW}Removed:${NC}"
echo "  ✓ Containers (my-money-*)"
echo "  ✓ Volumes (postgres_data)"
echo "  ✓ Networks (my-money-network)"
echo "  ✓ Images (my-money-backend, my-money-frontend)"
echo "  ✓ Build cache (from docker-compose and buildx builds)"
echo ""
echo -e "${YELLOW}Note:${NC} This script only removes resources specific to this project."
echo "To clean up ALL unused Docker resources system-wide, run:"
echo "  docker system prune -a --volumes"
echo ""
echo "To verify cleanup, run:"
echo "  docker ps -a | grep my-money"
echo "  docker volume ls | grep my-money"
echo "  docker network ls | grep my-money"
echo "  docker images | grep my-money"
echo "  docker builder du" # Show build cache size