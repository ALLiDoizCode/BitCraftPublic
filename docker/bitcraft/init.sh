#!/bin/sh
set -e

MODULE_PATH="/opt/bitcraft/bitcraft.wasm"
MIN_SIZE=102400  # 100KB in bytes

echo "SpacetimeDB BitCraft Server Initialization"
echo "==========================================="

# Validate module path (prevent path traversal)
if ! echo "$MODULE_PATH" | grep -q '^/opt/bitcraft/'; then
    echo "ERROR: Invalid module path (must be under /opt/bitcraft/)"
    exit 1
fi

# Check if module exists
if [ ! -f "$MODULE_PATH" ]; then
    echo "ERROR: BitCraft WASM module not found at $MODULE_PATH"
    echo "See docker/README.md for setup instructions."
    exit 1
fi

# Check module size (using GNU stat for Debian-based container)
MODULE_SIZE=$(stat -c%s "$MODULE_PATH" 2>/dev/null)
if [ -z "$MODULE_SIZE" ] || [ "$MODULE_SIZE" -lt "$MIN_SIZE" ]; then
    echo "ERROR: BitCraft WASM module is too small ($MODULE_SIZE bytes, expected >$MIN_SIZE bytes)"
    echo "This is likely a placeholder file. See docker/README.md for setup instructions."
    exit 1
fi

echo "Module found: $MODULE_PATH ($MODULE_SIZE bytes)"

# Start SpacetimeDB server in background
echo "Starting SpacetimeDB server..."
spacetime start --listen-addr "$SPACETIMEDB_BIND" &
SERVER_PID=$!

# Validate server PID
if [ -z "$SERVER_PID" ] || [ "$SERVER_PID" -le 0 ]; then
    echo "ERROR: Failed to start SpacetimeDB server (invalid PID)"
    exit 1
fi

# Wait for server to be ready (poll health endpoint)
echo "Waiting for SpacetimeDB to be ready..."
MAX_WAIT=30
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    # Check if server is accepting HTTP connections on port 3000
    if curl -s http://localhost:3000/ >/dev/null 2>&1; then
        echo "SpacetimeDB is ready"
        break
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "ERROR: SpacetimeDB failed to start within ${MAX_WAIT}s"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Configure spacetime CLI to use local server
spacetime server add localhost --url http://localhost:3000 || true
spacetime server set-default localhost

# Check if database exists, publish if not
if ! spacetime describe bitcraft --server localhost >/dev/null 2>&1; then
    echo "Publishing BitCraft module to database 'bitcraft'..."
    # Use printf to auto-respond to both prompts: N (no login) and y (confirm delete)
    # The publish command asks two questions:
    # 1. "Would you like to log in with spacetimedb.com?" - Answer: N
    # 2. "Are you sure you want to proceed? [deleting bitcraft]" - Answer: y
    if ! printf "N\ny\n" | spacetime publish bitcraft --server localhost --bin-path "$MODULE_PATH" --delete-data=always; then
        echo "ERROR: Failed to publish BitCraft module"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
    echo "BitCraft module published successfully"
else
    echo "BitCraft database already exists"
fi

# Keep server running
wait $SERVER_PID
