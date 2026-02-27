# Architecture Document Updates - SpacetimeDB Compatibility Spike

**Date:** 2026-02-26
**Spike Report:** `spike-spacetimedb-compatibility.md`

## Summary

The compatibility spike revealed that SpacetimeDB 2.0 clients are NOT backwards compatible with 1.6.x servers. This contradicted assumptions in the architecture documents, which stated that SDK 2.0 was backwards compatible. All architecture documents have been updated to reflect the correct SDK version (1.3.3).

## Files Updated

### 1. `/Users/jonathangreen/Documents/BitCraftPublic/_bmad-output/planning-artifacts/architecture/starter-template-technology-foundation.md`

**Changes:**

- Updated dependency table: `@clockworklabs/spacetimedb-sdk` version from "2.0.1" to "^1.3.3"
- Removed incorrect "Backwards-compatible with 1.6.x modules" claim
- Added note about SDK 2.0+ incompatibility and broken npm dependencies
- Updated "SpacetimeDB Version Strategy" section with accurate compatibility information
- Added reference to spike report

### 2. `/Users/jonathangreen/Documents/BitCraftPublic/_bmad-output/planning-artifacts/architecture/architecture-validation-results.md`

**Changes:**

- Line 6: Changed "SpacetimeDB 2.0 TS SDK confirmed backwards-compatible" to "SpacetimeDB SDK 1.3.3 (1.x) required"
- Line 51: Updated NFR18-22 integration note from "SDK 2.0" to "SDK 1.3.3"
- Line 91: Updated technology stack reference from "2.0 TS SDK" to "SDK 1.3.3"
- Line 143: Updated implementation sequence from "SpacetimeDB 2.0 connection" to "SpacetimeDB 1.x connection"

### 3. `/Users/jonathangreen/Documents/BitCraftPublic/_bmad-output/planning-artifacts/architecture/core-architectural-decisions.md`

**Changes:**

- Line 27: Changed "SpacetimeDB 2.0 client SDKs targeting 1.6.x server modules (backwards compatible)" to "SpacetimeDB SDK 1.3.3 (1.x) required for compatibility"
- Line 68: Updated protocol description from "WebSocket v2 (SpacetimeDB 2.0 client SDK)" to "WebSocket (SpacetimeDB SDK 1.x compatible with 1.6.0 server)"
- Line 68-71: Updated callback pattern notes to reflect 1.x SDK patterns
- Line 258: Updated implementation sequence from "SpacetimeDB 2.0 client" to "SpacetimeDB 1.x client"

### 4. `/Users/jonathangreen/Documents/BitCraftPublic/_bmad-output/planning-artifacts/architecture/project-structure-boundaries.md`

**Changes:**

- Line 37: Updated connection.ts comment from "SpacetimeDB 2.0 WebSocket v2 connection manager" to "SpacetimeDB 1.x WebSocket connection manager"

## Impact Assessment

**Low Impact on Implementation:**

- The architecture was already designed to use SpacetimeDB SDK, just with incorrect version
- No structural changes required
- Implementation can proceed with SDK 1.3.3 using the same patterns

**Key Differences for Developers:**

- Use `@clockworklabs/spacetimedb-sdk@^1.3.3` instead of 2.0+
- Use global reducer callbacks (1.x pattern) instead of event tables + `_then()` callbacks (2.0 pattern)
- WebSocket protocol is 1.x, not v2
- Generated bindings use `spacetime generate` with 1.x SDK

## Next Steps

1. Update any package.json files to use `@clockworklabs/spacetimedb-sdk@^1.3.3`
2. Review SpacetimeDB 1.x SDK documentation for API patterns
3. When BitCraft server upgrades to SpacetimeDB 2.x, coordinate client SDK migration

## References

- [Spike Report](spike-spacetimedb-compatibility.md) - Detailed compatibility analysis
- [SpacetimeDB Migration Guide](https://spacetimedb.com/docs/upgrade/) - Protocol v2 breaking changes
- [SpacetimeDB Clients Documentation](https://spacetimedb.com/docs/clients/) - SDK requirements
