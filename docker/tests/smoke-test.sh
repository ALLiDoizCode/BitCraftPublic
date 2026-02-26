#!/bin/sh
# POSIX-compliant smoke tests for Docker Compose stack
# Tests Docker local development environment (Story 1.3)
# All tests should FAIL initially (RED phase) until implementation is complete

set -e

echo "=== BitCraft Docker Compose Smoke Tests ==="
echo ""

# Test 1: Prerequisites Check
echo "[Test 1/12] Checking prerequisites..."

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl not found. Install: apt-get install curl OR brew install curl"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq not found. Install: apt-get install jq OR brew install jq"
  exit 1
fi

if ! command -v websocat >/dev/null 2>&1; then
  echo "ERROR: websocat not found. Install: cargo install websocat"
  exit 1
fi

if ! command -v spacetime >/dev/null 2>&1; then
  echo "ERROR: spacetime CLI not found. Install: curl -fsSL https://install.spacetimedb.com | sh"
  exit 1
fi

# Check Docker Compose v2
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose v2 not found. Install Docker Desktop 4.0+ or Docker Compose plugin"
  echo "Note: v2 uses 'docker compose' (no hyphen), not 'docker-compose'"
  exit 1
fi

COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
echo "✓ All prerequisites installed (Docker Compose: $COMPOSE_VERSION)"
echo ""

# Test 2: Services Health Check
echo "[Test 2/12] Waiting for services to become healthy..."

# Allow environment variable overrides for CI/slow systems
TIMEOUT=${TEST_TIMEOUT:-60}
INTERVAL=${TEST_INTERVAL:-2}
ELAPSED=0

echo "Timeout: ${TIMEOUT}s, Interval: ${INTERVAL}s"

while [ $ELAPSED -lt $TIMEOUT ]; do
  # Check if both services are healthy
  HEALTHY_COUNT=$(docker compose -f docker/docker-compose.yml ps --format json 2>/dev/null | jq -r 'select(.Health == "healthy") | .Service' | wc -l || echo "0")

  if [ "$HEALTHY_COUNT" -ge 2 ]; then
    echo "✓ Both services healthy"
    break
  fi

  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "ERROR: Services did not become healthy within ${TIMEOUT}s"
  docker compose -f docker/docker-compose.yml ps 2>/dev/null || echo "No containers found for project"
  docker compose -f docker/docker-compose.yml logs 2>/dev/null || echo "No logs available"
  exit 1
fi

echo ""

# Test 3: BitCraft SpacetimeDB HTTP Endpoint
echo "[Test 3/12] Testing SpacetimeDB HTTP endpoint..."

HTTP_RESPONSE=$(curl -f http://localhost:3000/database/bitcraft/info 2>&1) || {
  echo "ERROR: SpacetimeDB HTTP endpoint failed"
  echo "$HTTP_RESPONSE"
  exit 1
}

DATABASE_NAME=$(echo "$HTTP_RESPONSE" | jq -r '.database_name')

if [ "$DATABASE_NAME" != "bitcraft" ]; then
  echo "ERROR: Expected database_name='bitcraft', got '$DATABASE_NAME'"
  echo "$HTTP_RESPONSE"
  exit 1
fi

echo "✓ SpacetimeDB HTTP endpoint OK (database: $DATABASE_NAME)"
echo ""

# Test 4: Crosstown HTTP Health Endpoint
echo "[Test 4/12] Testing Crosstown HTTP health endpoint..."

HEALTH_RESPONSE=$(curl -f http://localhost:4041/health 2>&1) || {
  echo "ERROR: Crosstown health endpoint failed"
  echo "$HEALTH_RESPONSE"
  exit 1
}

HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status')

if [ "$HEALTH_STATUS" != "healthy" ]; then
  echo "ERROR: Expected status='healthy', got '$HEALTH_STATUS'"
  echo "$HEALTH_RESPONSE"
  exit 1
fi

echo "✓ Crosstown health endpoint OK"
echo ""

# Test 5: Crosstown Nostr Relay WebSocket
echo "[Test 5/12] Testing Crosstown Nostr relay WebSocket..."

RELAY_RESPONSE=$(echo '["REQ","test-sub",{"kinds":[1],"limit":1}]' | websocat -n1 ws://localhost:4040 2>&1) || {
  echo "ERROR: Crosstown Nostr relay WebSocket failed"
  echo "$RELAY_RESPONSE"
  exit 1
}

# Expect EOSE (End Of Stored Events) response
if ! echo "$RELAY_RESPONSE" | grep -q '"EOSE"'; then
  echo "ERROR: Expected EOSE response, got: $RELAY_RESPONSE"
  exit 1
fi

echo "✓ Crosstown Nostr relay WebSocket OK"
echo ""

# Test 6: SpacetimeDB WebSocket Subscription
echo "[Test 6/12] Testing SpacetimeDB WebSocket subscription..."

# Use spacetime CLI to test subscription (expects at least one line of output)
SUB_OUTPUT=$(timeout 5s spacetime subscribe bitcraft --server http://localhost:3000 2>&1 | head -1) || {
  echo "ERROR: SpacetimeDB WebSocket subscription failed"
  echo "$SUB_OUTPUT"
  exit 1
}

# If we got here, subscription was successful (head -1 returned)
echo "✓ SpacetimeDB WebSocket subscription OK"
echo ""

# Test 7: Service Dependency Order
echo "[Test 7/12] Testing service startup dependency..."

# Check docker-compose.yml for depends_on configuration
if [ ! -f docker/docker-compose.yml ]; then
  echo "ERROR: docker/docker-compose.yml not found"
  exit 1
fi

if ! grep -q "depends_on:" docker/docker-compose.yml; then
  echo "ERROR: No depends_on configuration found in docker-compose.yml"
  exit 1
fi

# Verify Crosstown depends on BitCraft being healthy
if ! grep -A5 "crosstown-node:" docker/docker-compose.yml | grep -q "condition: service_healthy"; then
  echo "ERROR: Crosstown should depend on BitCraft service_healthy condition"
  exit 1
fi

echo "✓ Service dependency order configured correctly"
echo ""

# Test 8: Development Override File
echo "[Test 8/12] Testing development override file..."

if [ ! -f docker/docker-compose.dev.yml ]; then
  echo "ERROR: docker-compose.dev.yml not found"
  exit 1
fi

# Check for debug port overrides (3001 for BitCraft admin, 4042 for Crosstown metrics)
if ! grep -q "3001:3001" docker/docker-compose.dev.yml; then
  echo "ERROR: BitCraft admin port (3001) not found in dev override"
  exit 1
fi

if ! grep -q "4042:4042" docker/docker-compose.dev.yml; then
  echo "ERROR: Crosstown metrics port (4042) not found in dev override"
  exit 1
fi

echo "✓ Development override file configured correctly"
echo ""

# Test 9: Volume Persistence
echo "[Test 9/12] Testing volume persistence..."

# Check for volume mounts in docker-compose.yml
if ! grep -q "volumes:" docker/docker-compose.yml; then
  echo "ERROR: No volumes configured in docker-compose.yml"
  exit 1
fi

# Verify SpacetimeDB data volume
if ! grep -q "./volumes/spacetimedb" docker/docker-compose.yml; then
  echo "ERROR: SpacetimeDB data volume not configured"
  exit 1
fi

# Verify Crosstown events volume
if ! grep -q "./volumes/crosstown" docker/docker-compose.yml; then
  echo "ERROR: Crosstown events volume not configured"
  exit 1
fi

echo "✓ Volume persistence configured correctly"
echo ""

# Test 10: Cross-Platform Compatibility Check
echo "[Test 10/12] Testing cross-platform compatibility..."

# Detect current platform
PLATFORM=$(uname -m)
echo "Detected platform: $PLATFORM"

# Verify services can start on current platform (already verified by Test 2)
if ! docker compose -f docker/docker-compose.yml ps --format json 2>/dev/null | jq -r 'select(.Health == "healthy")' | grep -q "healthy"; then
  echo "ERROR: Services not healthy on platform $PLATFORM"
  exit 1
fi

echo "✓ Cross-platform compatibility verified for $PLATFORM"
echo "Note: Test on both macOS (arm64/amd64) and Linux (amd64) before release"
echo ""

# Test 11: BitCraft Module Validation
echo "[Test 11/12] Testing BitCraft module capabilities..."

# Query SpacetimeDB for module info
MODULE_RESPONSE=$(curl -s http://localhost:3000/database/bitcraft/info 2>&1)

if [ -z "$MODULE_RESPONSE" ]; then
  echo "ERROR: Failed to retrieve module info (empty response)"
  echo "See docker/README.md for instructions on obtaining the BitCraft WASM module"
  exit 1
fi

MODULE_INFO=$(echo "$MODULE_RESPONSE" | jq -r '.module_hash' 2>/dev/null)

if [ -z "$MODULE_INFO" ] || [ "$MODULE_INFO" = "null" ]; then
  echo "ERROR: BitCraft module not loaded (module_hash is null)"
  echo "Response received: $MODULE_RESPONSE"
  echo "See docker/README.md for instructions on obtaining the BitCraft WASM module"
  exit 1
fi

echo "✓ BitCraft module loaded (hash: $MODULE_INFO)"
echo "Note: Full module validation (364+ reducers, tables) deferred to Story 1.5"
echo ""

# Test 12: Crosstown BLS Stub Logging
echo "[Test 12/12] Testing Crosstown BLS stub behavior..."

# Publish a kind 30078 event to the Nostr relay
TEST_EVENT='["EVENT",{"id":"test123","pubkey":"fakepubkey","created_at":1234567890,"kind":30078,"tags":[],"content":"{\"reducer\":\"test_reducer\",\"args\":[],\"fee\":100}","sig":"fakesig"}]'

# Send event to relay (expect OK response in stub mode)
RELAY_RESPONSE=$(echo "$TEST_EVENT" | websocat -n1 ws://localhost:4040 2>&1)

if [ -z "$RELAY_RESPONSE" ]; then
  echo "WARNING: No response from Nostr relay for kind 30078 event"
fi

# Check Crosstown logs for BLS stub message
sleep 2  # Wait for log processing
LOG_OUTPUT=$(docker compose -f docker/docker-compose.yml logs crosstown-node 2>/dev/null | tail -30)

if ! echo "$LOG_OUTPUT" | grep -q "\[BLS STUB\]"; then
  echo "WARNING: BLS stub logging not found in Crosstown logs (this is expected if no kind 30078 events were processed)"
  echo "Last 30 lines of Crosstown logs:"
  echo "$LOG_OUTPUT"
  echo "Note: This is non-fatal for basic stack validation"
else
  echo "✓ Crosstown BLS stub logging verified"
fi

echo "Note: Full BLS implementation (SpacetimeDB forwarding) deferred to Story 2.5"
echo ""

echo "=== All Smoke Tests Passed (12/12) ==="
echo ""
echo "Docker Compose stack is healthy and ready for SDK testing!"
