# SpacetimeDB Compatibility Spike - Executive Summary

**Date:** 2026-02-26
**Status:** COMPLETE
**Time Spent:** ~30 minutes

## Question

Can SpacetimeDB 2.0.x TypeScript client connect to a 1.6.x server?

## Answer

**NO** - SpacetimeDB 2.0 clients are NOT compatible with 1.6.x servers.

## Recommendation

**Use `@clockworklabs/spacetimedb-sdk@^1.3.3` for all Sigil client packages.**

## Key Findings

1. **Protocol Incompatibility:** SpacetimeDB 2.0 introduces WebSocket protocol v2 with breaking changes
2. **Broken Package:** SDK 2.0.0 has broken npm dependencies (`spacetimedb@next` does not exist)
3. **Official Guidance:** SpacetimeDB documentation explicitly requires client SDK version to match server version
4. **BitCraft Server:** Locked to SpacetimeDB 1.6.0 in `Cargo.toml`

## Actions Taken

### 1. Spike Test Created
- Directory: `.spike-test-spacetimedb/` (removed after analysis)
- Test script: Connection test with error analysis
- Result: Could not install SDK 2.0.0 due to broken dependencies

### 2. Research Conducted
- Reviewed SpacetimeDB migration guide
- Confirmed WebSocket protocol v2 incompatibility
- Verified BitCraft server version (1.6.0)
- Checked npm package versions and dependencies

### 3. Documentation Updated
Updated 5 architecture files to correct SDK version:

| File | Changes |
|------|---------|
| `starter-template-technology-foundation.md` | SDK version table + version strategy section |
| `architecture-validation-results.md` | 4 references to SDK version |
| `core-architectural-decisions.md` | 3 references to protocol and SDK version |
| `project-structure-boundaries.md` | 3 references to WebSocket protocol |
| `spike-spacetimedb-compatibility-updates.md` | Summary of all changes |

### 4. Spike Report Created
- File: `spike-spacetimedb-compatibility.md`
- Comprehensive analysis with:
  - Test setup and findings
  - Protocol incompatibility details
  - SDK version comparison
  - Recommendation and upgrade path
  - References to official documentation

## Impact on Implementation

**Low Impact** - Architecture is sound, only SDK version changed:
- Use `@clockworklabs/spacetimedb-sdk@^1.3.3` instead of 2.0.x
- Use global reducer callbacks (1.x pattern) instead of event tables
- All architectural patterns remain valid
- No structural changes required

## Upgrade Path

**When can we use SDK 2.0?**

Two conditions must be met:
1. SpacetimeDB 2.0.x npm package is fixed (currently broken)
2. BitCraft server upgrades to SpacetimeDB 2.x

**Migration complexity:** High - expect breaking changes requiring client code refactoring per [official migration guide](https://spacetimedb.com/docs/upgrade/)

## References

- [Detailed Spike Report](spike-spacetimedb-compatibility.md)
- [Architecture Updates Summary](spike-spacetimedb-compatibility-updates.md)
- [SpacetimeDB Migration Guide](https://spacetimedb.com/docs/upgrade/)
- [SpacetimeDB 2.0 Release](https://github.com/clockworklabs/SpacetimeDB/releases/tag/v2.0.1)
- [SpacetimeDB Clients Documentation](https://spacetimedb.com/docs/clients/)

## Success Criteria Met

- [x] Clear answer: Does 2.0.x client work with 1.6.x server? **NO**
- [x] Documented spike report with recommendation
- [x] Architecture docs updated with correct SDK version
- [x] Upgrade path documented
