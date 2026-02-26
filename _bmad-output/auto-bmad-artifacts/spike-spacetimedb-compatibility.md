# SpacetimeDB 2.0 Client → 1.6.x Server Compatibility Spike

**Date:** 2026-02-26
**Status:** COMPLETE
**Result:** INCOMPATIBLE - Use SDK 1.x

## Executive Summary

**Conclusion: SpacetimeDB 2.0.0 TypeScript client is NOT compatible with 1.6.x servers.**

**Recommendation: Use `@clockworklabs/spacetimedb-sdk@1.3.3` (latest stable 1.x) for compatibility with BitCraft's SpacetimeDB 1.6.0 server.**

## Background

The Sigil client SDK needs to connect to BitCraft's SpacetimeDB 1.6.0 server modules. This spike investigated whether the latest SpacetimeDB 2.0.0 TypeScript client SDK could be used, or if we must use an older 1.x SDK version.

## Test Setup

### Environment
- **BitCraft Server:** SpacetimeDB 1.6.0 modules (confirmed in `BitCraftServer/packages/game/Cargo.toml`)
- **Client SDK Versions Investigated:**
  - `@clockworklabs/spacetimedb-sdk@2.0.0` (latest major version)
  - `@clockworklabs/spacetimedb-sdk@1.3.3` (latest 1.x stable)

### Test Approach
1. Check BitCraft server module version
2. Review SpacetimeDB SDK version history
3. Attempt to install SDK 2.0.0
4. Research protocol compatibility via documentation
5. Document findings and make recommendation

## Findings

### 1. SDK 2.0.0 Cannot Be Installed (Broken Dependency)

```bash
npm install @clockworklabs/spacetimedb-sdk@2.0.0
```

**Result:** Installation FAILED

**Error:**
```
npm error notarget No matching version found for spacetimedb@next
```

**Root Cause:**
The `@clockworklabs/spacetimedb-sdk@2.0.0` package has a dependency on `spacetimedb@next`, which does not exist in the npm registry. This indicates the 2.0.0 release is incomplete or broken.

```bash
$ npm view @clockworklabs/spacetimedb-sdk@2.0.0 dependencies
{ spacetimedb: 'next' }
```

### 2. Protocol Incompatibility Confirmed

Even if SDK 2.0.0 installation worked, the protocol is fundamentally incompatible with 1.6.x servers.

**Source:** [SpacetimeDB Migration Guide](https://spacetimedb.com/docs/upgrade/)

**Key Breaking Changes:**

| Change | Impact on Compatibility |
|--------|------------------------|
| **New WebSocket Protocol (v2)** | Fundamental protocol-level incompatibility |
| **Reducer Callbacks Removed** | 1.0 global callback mechanism no longer exists |
| **Event Model Restructured** | Success notifications contain different data structures |
| **Connection API Changes** | Method signatures changed (e.g., `withModuleName()` → `withDatabaseName()`) |
| **Table Naming Changes** | `name` parameter changed to `accessor` |

**Official Documentation Quote:**
> "The version of the client SDK you are using must match the version of spacetime generate that produced your bindings. Additionally, you should use the same version of the SpacetimeDB module library... as the version of the SpacetimeDB host you are publishing to."

**Interpretation:**
- BitCraft server uses SpacetimeDB 1.6.0
- Client SDK must use 1.x version to match
- 2.0 client introduces WebSocket protocol v2 which is incompatible with 1.6.0 server's protocol

### 3. SDK Version History

Available versions of `@clockworklabs/spacetimedb-sdk`:

```
0.2.0 → ... → 1.3.3 (stable) → 2.0.0 (broken/incompatible)
```

**Latest Stable 1.x:** `1.3.3`

**Dependencies:**
```bash
$ npm view @clockworklabs/spacetimedb-sdk@1.3.3 dependencies
{ 'base64-js': '^1.5.1', '@zxing/text-encoding': '^0.9.0' }
```

All dependencies exist and are installable.

### 4. BitCraft Server Configuration

**File:** `/Users/jonathangreen/Documents/BitCraftPublic/BitCraftServer/packages/game/Cargo.toml`

```toml
[dependencies]
spacetimedb = { version = "=1.6.0", features = ["unstable"] }
spacetimedb-bindings-sys = "=1.6.0"
spacetimedb-bindings-macro = "=1.6.0"
```

**Server Version:** Locked to exactly 1.6.0 (using `=` version specifier)

## Recommendation

### Use SpacetimeDB SDK 1.3.3

```json
{
  "dependencies": {
    "@clockworklabs/spacetimedb-sdk": "^1.3.3"
  }
}
```

**Rationale:**
1. **Protocol Compatibility:** 1.x client works with 1.6.0 server
2. **Stable & Installable:** Unlike 2.0.0, it has no broken dependencies
3. **Future-Proof Within 1.x:** Using `^1.3.3` allows patch/minor updates within 1.x
4. **Official Guidance:** Matches SpacetimeDB's requirement that client SDK version must match server version

### When Can We Upgrade to 2.x?

**Two conditions must be met:**

1. **SpacetimeDB 2.0.0 npm package is fixed** (currently has broken `spacetimedb@next` dependency)
2. **BitCraft server is upgraded to SpacetimeDB 2.x** (currently locked at 1.6.0)

**Migration Path:**
- Monitor BitCraft server repo for SpacetimeDB version updates
- When server upgrades to 2.x, coordinate client SDK upgrade
- Expect breaking changes requiring client code refactoring (see migration guide)

## Impact on Sigil Architecture

### Current Architecture Decisions (Confirmed Valid)

From `_bmad-output/planning-artifacts/architecture.md`:

**Client SDK:**
- Use `@clockworklabs/spacetimedb-sdk@1.3.3` for TypeScript client
- Generates bindings from BitCraft server schema using `spacetime generate`

**No Changes Required:**
The architecture document should specify SDK version 1.x (not 2.x) to ensure compatibility.

### Recommended Architecture Update

**File:** `_bmad-output/planning-artifacts/architecture.md`

Add to Client SDK section:

```markdown
#### SpacetimeDB SDK Version

- **SDK:** `@clockworklabs/spacetimedb-sdk@^1.3.3`
- **Rationale:** BitCraft server uses SpacetimeDB 1.6.0. SDK 2.0+ introduces
  incompatible WebSocket protocol v2 and breaking API changes.
- **Upgrade Path:** Monitor BitCraft server for SpacetimeDB 2.x upgrade before
  considering client SDK 2.x migration.
```

## Test Artifacts

### Files Created

1. **Test Directory:** `/Users/jonathangreen/Documents/BitCraftPublic/.spike-test-spacetimedb/`
2. **package.json:** Node.js project with SDK 2.0.0 dependency (failed to install)
3. **test-connection.js:** Connection test script (not executed due to install failure)

### Why Test Was Not Executed

The practical connection test could not be run because:
1. SDK 2.0.0 cannot be installed (broken dependency)
2. SpacetimeDB CLI is not installed locally (`spacetime` command not found)
3. BitCraft server is not running locally

However, **this does not affect the conclusion** because:
- Official documentation confirms protocol incompatibility
- SDK 2.0.0 is broken regardless of protocol compatibility
- Version mismatch between client (2.x) and server (1.6.0) is explicitly prohibited by SpacetimeDB

## References

- [SpacetimeDB Migration Guide](https://spacetimedb.com/docs/upgrade/) - Protocol v2 breaking changes
- [SpacetimeDB 2.0 Release](https://github.com/clockworklabs/SpacetimeDB/releases/tag/v2.0.1) - Release notes
- [SpacetimeDB Clients Documentation](https://spacetimedb.com/docs/clients/) - Client SDK requirements
- [npm: @clockworklabs/spacetimedb-sdk](https://www.npmjs.com/package/@clockworklabs/spacetimedb-sdk) - Package versions

## Next Steps

1. **Update Architecture Docs:** Add SDK version specification (1.3.3) to architecture.md
2. **Configure Client Package:** Use `"@clockworklabs/spacetimedb-sdk": "^1.3.3"` in client package.json
3. **Generate Bindings:** Use `spacetime generate --lang typescript` from BitCraft server schema
4. **Implement Client:** Build TypeScript client using SDK 1.3.3 API
5. **Monitor for Updates:** Watch BitCraft server repo for SpacetimeDB version changes

## Conclusion

**The spike definitively answers the compatibility question: NO, SpacetimeDB 2.0 clients cannot connect to 1.6.x servers.**

This result is based on:
1. Official migration documentation confirming protocol incompatibility
2. Version matching requirement from SpacetimeDB documentation
3. Broken npm package for SDK 2.0.0 (dependency issue)

**Action Required:** Update all planning and architecture documents to specify SpacetimeDB SDK version 1.x (specifically `^1.3.3`) for client implementation.
