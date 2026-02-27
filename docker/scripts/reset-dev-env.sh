#!/bin/sh
set -e

echo "Resetting Docker development environment..."
echo "==========================================="
echo ""
echo "WARNING: This will destroy all volumes and rebuild containers!"
echo "This includes:"
echo "  - All SpacetimeDB game data (docker/volumes/spacetimedb/)"
echo "  - All Crosstown relay events (docker/volumes/crosstown/)"
echo ""
printf "Continue? [y/N] "
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""

cd "$(dirname "$0")/.."

echo "Stopping and removing containers with volumes..."
docker compose down -v

echo "Rebuilding and starting containers..."
docker compose up --build

echo ""
echo "Development environment reset complete."
