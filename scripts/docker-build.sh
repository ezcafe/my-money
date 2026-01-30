#!/bin/bash
# Docker build script: uses root .env for Compose variable substitution.
# Run from project root (or any directory); always loads .env from repo root.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# Change to project root so compose paths and .env are correct
cd "$PROJECT_ROOT"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at project root (${ENV_FILE})"
  echo "Create it with: cp .env.example .env"
  exit 1
fi

# Prepare base images, then build with root .env
bash scripts/docker-prepare-images.sh

export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Default: build with --no-cache; use DOCKER_BUILD_PULL=1 for --pull=always
if [ "${DOCKER_BUILD_PULL:-0}" = "1" ]; then
  docker compose -f docker/docker-compose.yml --env-file "$ENV_FILE" build \
    --pull=always --parallel --no-cache
else
  docker compose -f docker/docker-compose.yml --env-file "$ENV_FILE" build \
    --parallel --no-cache
fi
