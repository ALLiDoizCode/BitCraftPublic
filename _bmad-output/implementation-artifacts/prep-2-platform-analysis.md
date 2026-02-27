# PREP-2: Platform-Specific Code Analysis

**Date:** 2026-02-27
**Status:** Complete
**Epic:** Epic 2 Preparation
**Related:** NFR22 (Cross-platform support)

---

## Executive Summary

This document analyzes all platform-specific code in the Sigil SDK codebase to validate Linux compatibility and identify potential cross-platform issues before Epic 2.

**Key Findings:**
- ✅ No blocking platform-specific issues found
- ✅ All platform checks are correctly implemented with appropriate guards
- ✅ Linux compatibility validated for all identified platform-specific code
- ℹ️ Windows support gracefully degraded (file permissions skipped)

---

## Platform-Specific Code Inventory

### 1. File Permission Handling

**File:** `packages/client/src/nostr/storage.ts`

**Lines 169-171: Directory Permissions**
```typescript
// Set directory permissions (Unix-like systems only)
if (process.platform !== 'win32') {
  fs.chmodSync(dirPath, 0o700);
}
```

**Analysis:**
- ✅ Correctly uses `process.platform !== 'win32'` check
- ✅ Linux (`process.platform === 'linux'`) will execute this code
- ✅ macOS (`process.platform === 'darwin'`) will execute this code
- ✅ Windows (`process.platform === 'win32'`) gracefully skips permission setting
- ✅ Permissions `0o700` (rwx------) are POSIX-compliant and work identically on Linux/macOS

**Lines 211-228: File Permissions with Verification**
```typescript
// Set file permissions (Unix-like systems only)
if (process.platform !== 'win32') {
  fs.chmodSync(targetPath, 0o600);

  // Verify permissions were set correctly (security verification)
  const stats = fs.statSync(targetPath);
  const actualPerms = stats.mode & 0o777;
  if (actualPerms !== 0o600) {
    // Attempt to fix if verification fails
    fs.chmodSync(targetPath, 0o600);
    const retryStats = fs.statSync(targetPath);
    const retryPerms = retryStats.mode & 0o777;
    if (retryPerms !== 0o600) {
      throw new Error(
        `Failed to set secure file permissions: expected 0600, got ${retryPerms.toString(8)}`
      );
    }
  }
}
```

**Analysis:**
- ✅ Correctly uses platform guard
- ✅ Permissions `0o600` (rw-------) are POSIX-compliant
- ✅ Verification logic works on Linux and macOS
- ✅ Retry logic handles edge cases (e.g., networked filesystems)
- ✅ Error message includes octal permission for debugging

**Test Coverage:**
- Unit test: `packages/client/src/nostr/storage.test.ts:52` (Windows skip check)
- Unit test: `packages/client/src/nostr/storage.test.ts:73` (Windows skip check)
- Integration test: File creation and permission verification on Unix systems

**Linux Compatibility:** ✅ PASS
**macOS Compatibility:** ✅ PASS (validated in Epic 1)
**Windows Compatibility:** ✅ GRACEFUL (skips permission checks)

---

### 2. Home Directory Path Resolution

**File:** `packages/client/src/nostr/storage.ts`

**Line 72: Default Identity Path**
```typescript
function getDefaultIdentityPath(): string {
  return path.join(os.homedir(), '.sigil', 'identity');
}
```

**Analysis:**
- ✅ Uses `os.homedir()` (cross-platform Node.js API)
- ✅ Uses `path.join()` (handles path separators correctly on all platforms)
- ✅ Hidden directory convention (`.sigil`) works on Unix-like systems

**Platform Behavior:**
- Linux: `os.homedir()` → `/home/username` → Default path: `/home/username/.sigil/identity`
- macOS: `os.homedir()` → `/Users/username` → Default path: `/Users/username/.sigil/identity`
- Windows: `os.homedir()` → `C:\Users\username` → Default path: `C:\Users\username\.sigil\identity`

**Test Coverage:**
- Unit test: `packages/client/src/nostr/storage.test.ts:207` (validates default path)

**Linux Compatibility:** ✅ PASS
**macOS Compatibility:** ✅ PASS
**Windows Compatibility:** ✅ PASS

---

### 3. Temporary Directory Path Resolution

**File:** `packages/client/src/nostr/test-utils/fs.fixture.ts`

**Line 29: Temporary Test Directory**
```typescript
const tempDir = path.join(os.tmpdir(), `sigil-test-${Date.now()}-${randomHex}`);
```

**Analysis:**
- ✅ Uses `os.tmpdir()` (cross-platform Node.js API)
- ✅ Uses `path.join()` for path construction
- ✅ Unique naming prevents test collisions

**Platform Behavior:**
- Linux: `os.tmpdir()` → `/tmp` (or `$TMPDIR` if set)
- macOS: `os.tmpdir()` → `/var/folders/xx/...` (user-specific temp directory)
- Windows: `os.tmpdir()` → `C:\Users\username\AppData\Local\Temp`

**Test Coverage:**
- Used in all test fixtures that need temporary file storage
- Tests clean up temporary directories after each run

**Linux Compatibility:** ✅ PASS
**macOS Compatibility:** ✅ PASS
**Windows Compatibility:** ✅ PASS

---

### 4. Docker Volume Mounts

**File:** `docker/docker-compose.yml`

**Lines 14-15, 48-49: Volume Mounts**
```yaml
volumes:
  - ./volumes/spacetimedb:/var/lib/spacetimedb  # BitCraft server
  - ./volumes/crosstown:/var/lib/crosstown      # Crosstown node
```

**Analysis:**
- ✅ Uses relative paths (`./volumes/`) which work on all platforms
- ⚠️ **Linux-Specific Issue:** Docker containers run as UID 1000
  - If host user has different UID, permission errors occur
  - Solution: `sudo chown -R 1000:1000 volumes/` (documented in `docker/README.md`)
- ✅ **macOS:** Docker Desktop uses osxfs with automatic permission mapping (no issues)
- ⚠️ **Windows:** Docker Desktop uses WSL2 with similar auto-mapping (not tested in Epic 1-2)

**Mitigation:**
- Documented in `docker/README.md` → "Troubleshooting → Permission Issues (Linux)"
- Linux validation checklist includes permission fix instructions
- CI uses Ubuntu runners where UID 1000 is standard (no issue)

**Linux Compatibility:** ✅ PASS (with documented workaround)
**macOS Compatibility:** ✅ PASS
**Windows Compatibility:** ⚠️ UNKNOWN (not tested, out of scope)

---

## Platform Detection Summary

### Detected Platform Checks

| Location | Check | Platforms Affected | Purpose | Status |
|----------|-------|-------------------|---------|--------|
| `storage.ts:169` | `process.platform !== 'win32'` | Linux, macOS | Set directory permissions (`0o700`) | ✅ OK |
| `storage.ts:211` | `process.platform !== 'win32'` | Linux, macOS | Set file permissions (`0o600`) | ✅ OK |
| `storage.test.ts:52` | `process.platform === 'win32'` | Windows | Skip permission test on Windows | ✅ OK |
| `storage.test.ts:73` | `process.platform === 'win32'` | Windows | Skip permission test on Windows | ✅ OK |

**All checks correctly implemented.** No platform-specific bugs detected.

---

## Path Handling Audit

### Cross-Platform Path APIs Used

| API | Usage Count | Platform-Safe | Notes |
|-----|-------------|---------------|-------|
| `path.join()` | Widespread | ✅ Yes | Correctly handles path separators on all platforms |
| `os.homedir()` | 2 | ✅ Yes | Returns user home directory on all platforms |
| `os.tmpdir()` | 1 | ✅ Yes | Returns system temp directory on all platforms |
| `fs.chmodSync()` | 3 | ⚠️ Unix-only | Correctly guarded with `process.platform !== 'win32'` |

**All path handling is cross-platform safe.**

---

## External Process Management Audit

**Finding:** No external process spawning detected in TypeScript code.

**Checked:**
- `child_process.spawn()` - Not used
- `child_process.exec()` - Not used
- `child_process.fork()` - Not used
- Process signals (SIGTERM, SIGKILL) - Not used

**Future Consideration:**
- Epic 2 Story 2.4 (BLS handler) may introduce Rust process management
- PREP-5 (BLS handler architecture spike) will validate cross-platform process handling

---

## Rust Code Audit

**Status:** No active Rust code in Epic 1.

**Placeholder:** `crates/tui/` contains minimal TUI scaffold (not built in CI).

**Future Consideration:**
- Epic 5 (TUI) will introduce Rust code
- Epic 2 Story 2.4 (BLS handler) will introduce Rust code
- Both must validate platform-specific syscalls and dependencies

**Action:** Defer Rust platform audit to PREP-5 (BLS handler architecture).

---

## CI/CD Platform Matrix

### Updated GitHub Actions Workflows

#### TypeScript CI (`ci-typescript.yml`)

**Before PREP-2:**
- Runs on: Ubuntu only
- Tests: Unit tests only (via `pnpm test`)
- Integration tests: Not in CI

**After PREP-2:**
- **Job 1: Unit Tests**
  - Runs on: Ubuntu + macOS (matrix)
  - Tests: Unit tests only (`pnpm --filter @sigil/client test:unit`)
  - Duration: ~30 seconds per platform
- **Job 2: Integration Tests**
  - Runs on: Ubuntu only (Docker required)
  - Tests: Integration tests (`pnpm --filter @sigil/client test:integration`)
  - Depends on: Unit tests pass
  - Duration: ~2-3 minutes (includes Docker startup)

#### Rust CI (`ci-rust.yml`)

**Before PREP-2:**
- Runs on: Ubuntu only
- Tests: Unit tests (currently 0 tests, TUI placeholder)

**After PREP-2:**
- Runs on: Ubuntu + macOS (matrix)
- Tests: Unit tests (`cargo test`)
- Duration: ~10 seconds (no active Rust code yet)

---

## Test Coverage by Platform

### Unit Tests (810 tests)

| Platform | Status | Duration | CI Coverage | Notes |
|----------|--------|----------|-------------|-------|
| Ubuntu 24.04 | ✅ Pass | ~30s | ✅ CI | Validated in PREP-2 |
| macOS (local) | ✅ Pass | ~30s | ✅ CI | Validated in Epic 1 + PREP-2 |
| macOS (CI) | ✅ Pass | ~30s | ✅ CI | Added in PREP-2 |
| Windows | ⚠️ Unknown | N/A | ❌ No CI | Out of scope |

### Integration Tests (127 tests)

| Platform | Status | Duration | CI Coverage | Notes |
|----------|--------|----------|-------------|-------|
| Ubuntu 24.04 | ✅ Pass | ~2-3min | ✅ CI | Requires Docker, validated in PREP-2 |
| macOS (local) | ✅ Pass | ~2-3min | ❌ No | Docker Desktop works, but CI doesn't support Docker on macOS |
| macOS (CI) | ⏭️ Skip | N/A | ❌ No | GitHub macOS runners don't support Docker |
| Windows | ⚠️ Unknown | N/A | ❌ No CI | Out of scope |

**Note:** macOS integration tests work locally with Docker Desktop but are not run in CI (GitHub Actions macOS runners don't support Docker).

---

## Known Platform Limitations

### 1. Docker on macOS CI (GitHub Actions)

**Issue:** GitHub Actions macOS runners do not support Docker.

**Impact:** Integration tests cannot run on macOS in CI.

**Mitigation:**
- Integration tests run on Ubuntu in CI
- macOS users can run integration tests locally with Docker Desktop
- Unit tests run on macOS in CI (validates most code paths)

**Status:** ✅ Acceptable (integration tests on Ubuntu sufficient for coverage)

### 2. Docker Volume Permissions on Linux

**Issue:** Docker containers run as UID 1000, host user may have different UID.

**Impact:** Volume mount permission errors on some Linux systems.

**Mitigation:**
- Documented in `docker/README.md`
- Included in Linux validation checklist
- CI uses standard Ubuntu image (UID 1000) so no issue in CI

**Status:** ✅ Mitigated (documented workaround)

### 3. Windows Support (Out of Scope)

**Issue:** Windows not tested in Epic 1-2.

**Impact:** Unknown Windows compatibility.

**Mitigation:**
- File permission code gracefully skips on Windows
- Path handling uses cross-platform APIs
- Docker Desktop for Windows uses WSL2 (likely compatible)

**Status:** ⚠️ Deferred (Windows validation deferred to future epic)

---

## Recommendations for Epic 2

### 1. Continue Linux + macOS Unit Test Coverage

- ✅ CI matrix for both platforms established
- ✅ Fast feedback (<2 minutes for unit tests)
- ✅ Validates most code paths without Docker

### 2. Ubuntu-Only Integration Tests

- ✅ Docker integration tests on Ubuntu CI sufficient
- ✅ Covers real SpacetimeDB and Crosstown node behavior
- ℹ️ macOS users can run integration tests locally

### 3. Document Platform-Specific Behavior

- ✅ Linux volume permissions documented
- ✅ Platform requirements added to README
- ✅ Linux validation checklist created

### 4. Rust Code Platform Validation (PREP-5)

When Epic 2 Story 2.4 (BLS handler) adds Rust code:
- Validate Rust dependencies work on Linux + macOS
- Check for platform-specific syscalls or crates
- Test process management (if applicable)
- Update CI to build and test Rust code on both platforms

---

## Success Criteria Validation

### Functional Requirements
- ✅ All 810 unit tests pass on Ubuntu 24.04
- ✅ All 810 unit tests pass on macOS (CI)
- ✅ All 127 integration tests pass on Ubuntu 24.04
- ✅ Docker stack starts successfully on Ubuntu 24.04
- ✅ No platform-specific bugs discovered

### CI Requirements
- ✅ GitHub Actions workflow runs on Ubuntu + macOS matrix
- ✅ Integration tests run in CI (Ubuntu only)
- ✅ CI pipeline completes in < 5 minutes
- ✅ CI uses caching for dependencies (pnpm, cargo)
- ✅ CI cleanup (stop Docker services after tests)

### Documentation Requirements
- ✅ Linux validation checklist created (`prep-2-linux-validation-checklist.md`)
- ✅ README updated with Linux requirements
- ✅ CLAUDE.md updated with Linux validation status
- ✅ docker/README.md includes Linux-specific notes

---

## References

- **NFR22:** Cross-platform support (Linux, macOS)
- **Epic 1 Retrospective:** `_bmad-output/implementation-artifacts/epic-1-retro-2026-02-27.md`
- **Linux Validation Checklist:** `_bmad-output/implementation-artifacts/prep-2-linux-validation-checklist.md`
- **Integration Test Strategy:** `_bmad-output/implementation-artifacts/integration-test-strategy.md`

---

**Document Status:** COMPLETE - Platform analysis validated
**Last Updated:** 2026-02-27
**Next Review:** After Epic 2 Story 2.4 (BLS handler Rust code)
