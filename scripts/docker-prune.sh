#!/bin/bash
# Docker prune script for My Money application
# Removes only UNUSED Docker resources (stopped containers, unused networks,
# unused images, unused volumes, build cache). Does not stop running containers
# or remove volumes in use.

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Docker Prune (Unused Resources Only) ===${NC}"
echo ""
echo "Removing only unused resources. Running containers and volumes in use are preserved."
echo ""

echo -e "${YELLOW}Pruning unused containers, networks, and images...${NC}"
docker system prune -af

echo ""
echo -e "${YELLOW}Pruning unused volumes...${NC}"
docker volume prune -f

echo ""
echo -e "${YELLOW}Pruning build cache...${NC}"
docker builder prune -af 2>/dev/null || docker builder prune -f

echo ""
echo -e "${GREEN}=== Prune Complete ===${NC}"
echo ""
echo -e "${YELLOW}Removed:${NC}"
echo "  ✓ Stopped containers"
echo "  ✓ Unused networks"
echo "  ✓ Unused images"
echo "  ✓ Unused volumes"
echo "  ✓ Build cache"
echo ""
echo -e "${YELLOW}Preserved:${NC}"
echo "  ✓ Running containers"
echo "  ✓ Volumes in use by a container"
echo "  ✓ Images used by a container"
echo ""
