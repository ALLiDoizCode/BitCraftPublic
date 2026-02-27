# Code Review Checklist

**Date:** 2026-02-27
**Status:** Active
**Owner:** Charlie (Senior Dev)
**Relates To:** PREP-7 & ACTION-2 from Epic 1 Retrospective

---

## Overview

This checklist ensures consistent, security-focused code reviews across all stories. It extracts common review issues from Epic 1 (82 total issues, including 3 high-severity security issues) and provides a reusable framework for Epic 2 and beyond.

**Key Principles:**
1. **Security First** - OWASP Top 10 compliance required (AGREEMENT-2)
2. **Language-Specific Safety** - TypeScript and Rust best practices
3. **Test Traceability** - Verify AC → Test mapping (AGREEMENT-1)
4. **Pair Review on New Tech** - Nostr, ILP, BLS require pair review (AGREEMENT-3)

---

## OWASP Top 10 Security Checklist

### A01:2021 – Broken Access Control
- [ ] **Authentication checks** - Verify user identity before sensitive operations
- [ ] **Authorization checks** - Verify user has permission for requested action
- [ ] **Rate limiting** - Prevent brute-force attacks (H-003 from Epic 1)
- [ ] **CORS configuration** - Restrict cross-origin requests (M-001 from Epic 1)
- [ ] **Docker port restrictions** - No privileged ports < 1024 (H-002 from Epic 1)

**Epic 1 Example:**
```rust
// H-002: Port validation added in Story 1.3
if http_port < 1024 || nostr_port < 1024 {
    tracing::error!("Port numbers must be >= 1024 for unprivileged users");
    std::process::exit(1);
}
```

---

### A02:2021 – Cryptographic Failures
- [ ] **Private key protection** - Nostr private keys never exposed in logs or API responses
- [ ] **Encryption at rest** - Sensitive data encrypted in files (e.g., keypair.json)
- [ ] **TLS/SSL** - Use `wss://` for production WebSocket connections, not `ws://`
- [ ] **Key storage** - Nostr keypairs stored securely (not in code, not in environment variables)

**NFR Compliance:**
- NFR9: Private key never leaves client (validated in Story 1.2)
- NFR10: End-to-end signed ILP packets (Epic 2 Stories 2.3-2.5)

---

### A03:2021 – Injection
- [ ] **Path traversal prevention** - Validate file paths before use (H-001 from Epic 1)
- [ ] **Command injection prevention** - No shell execution with user-supplied input
- [ ] **SQL injection prevention** - Use parameterized queries (not applicable to SpacetimeDB)
- [ ] **Input validation** - Validate all external input (WebSocket messages, file paths, environment variables)
- [ ] **Table name allowlist** - Alphanumeric + underscores only (implemented in `SubscriptionManager`)

**Epic 1 Example:**
```bash
# H-001: Path validation added in Story 1.3
if ! echo "$MODULE_PATH" | grep -q '^/opt/bitcraft/'; then
    echo "ERROR: Invalid module path (must be under /opt/bitcraft/)"
    exit 1
fi
```

**Epic 1 Example (TypeScript):**
```typescript
// Subscription manager (Story 1.4)
const tableNameRegex = /^[a-zA-Z0-9_]+$/;
if (!tableNameRegex.test(tableName)) {
  throw new TypeError('Table name must contain only alphanumeric characters and underscores');
}
```

---

### A04:2021 – Insecure Design
- [ ] **Threat modeling** - Consider attack vectors for new features
- [ ] **Secure defaults** - Default configuration is secure (e.g., autoReconnect: true, maxRetries: 10)
- [ ] **Error handling** - Fail securely (no sensitive data in error messages)
- [ ] **Dependency review** - No known vulnerabilities in npm/cargo dependencies

**Epic 1 Example:**
```typescript
// ReconnectionManager defaults (Story 1.6)
const DEFAULT_OPTIONS: Required<ReconnectionOptions> = {
  autoReconnect: true,
  maxReconnectAttempts: 10,
  initialDelay: 1000,
  maxDelay: 30000, // Capped to prevent excessive backoff
  jitterPercent: 10,
};
```

---

### A05:2021 – Security Misconfiguration
- [ ] **Security headers** - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection (M-002 from Epic 1)
- [ ] **CORS restrictions** - Allow only trusted origins (M-001 from Epic 1)
- [ ] **Docker security** - No root user, read-only filesystems where possible
- [ ] **Environment variables** - Secrets in `.env` files, not in code (NFR13)
- [ ] **Rate limiting** - Prevent DoS attacks (H-003 from Epic 1)

**Epic 1 Example:**
```rust
// H-003: Rate limiting added in Story 1.3
let mut rate_limiter = RateLimiter::new(100, 60); // 100 events per 60 seconds

if !rate_limiter.check_and_record() {
    tracing::warn!("Rate limit exceeded for connection");
    let error_response = serde_json::json!(["NOTICE", "Rate limit exceeded..."]);
    let _ = tx.send(warp::ws::Message::text(error_response.to_string())).await;
    continue;
}
```

---

### A06:2021 – Vulnerable and Outdated Components
- [ ] **Dependency versions** - Pin specific versions (no `latest` tags)
- [ ] **Security audits** - Run `pnpm audit` and `cargo audit` before merging
- [ ] **SpacetimeDB SDK compatibility** - SDK 2.0 compatible with 1.6.x servers (validated in Story 1.4)
- [ ] **Docker image tags** - Pin specific versions (no `latest`)

**Epic 1 Example:**
```yaml
# docker-compose.yml (Story 1.3)
services:
  bitcraft-server:
    image: clockworklabs/spacetimedb:1.6.0  # Pinned version, not 'latest'
```

---

### A07:2021 – Identification and Authentication Failures
- [ ] **Nostr keypair validation** - Verify nsec/npub format before use
- [ ] **Signature verification** - Verify Nostr signatures on signed events (Epic 2 Story 2.3)
- [ ] **Identity propagation** - Nostr public key propagated from ILP packet to SpacetimeDB (Epic 2 Story 2.5)
- [ ] **No weak authentication** - No passwords, no OAuth (Nostr-only identity)

**NFR Compliance:**
- NFR9: Private key never exposed (Story 1.2)
- NFR10: Signed ILP packets (Epic 2)

---

### A08:2021 – Software and Data Integrity Failures
- [ ] **ILP packet integrity** - Verify packet signatures (Epic 2 Story 2.3)
- [ ] **Nostr event verification** - Verify event signatures (Epic 2 Story 2.1)
- [ ] **Immutable snapshots** - Static data cache immutable after load (Story 1.5)
- [ ] **State consistency** - Subscription recovery preserves consistency (Story 1.6)

---

### A09:2021 – Security Logging and Monitoring Failures
- [ ] **Log sanitization** - No sensitive data in logs (private keys, passwords) (M-004 from Epic 1)
- [ ] **Error event emission** - Emit errors as events, not console.error (Story 1.6 pattern)
- [ ] **Audit trail** - Log critical operations (reconnection, subscription recovery)
- [ ] **Metrics tracking** - ReconnectionMetrics, SubscriptionMetrics (Story 1.6)

**Epic 1 Example:**
```typescript
// Story 1.6: Emit events instead of console logging
this.emit('reconnectionError', {
  attemptNumber: this.attemptNumber,
  error: error instanceof Error ? error : new Error(String(error)),
});
```

---

### A10:2021 – Server-Side Request Forgery (SSRF)
- [ ] **URL validation** - Validate SpacetimeDB host to prevent SSRF (Story 1.4)
- [ ] **Internal network protection** - Block connections to internal IPs in production
- [ ] **Allowlist approach** - Use allowlists, not denylists, for hosts

**Epic 1 Example:**
```typescript
// Story 1.4: Host validation in SpacetimeDBConnection
const internalNetworkRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|169\.254\.)/;
if (internalNetworkRegex.test(this.options.host) && this.options.host !== '127.0.0.1') {
  if (process.env.NODE_ENV === 'production') {
    throw new TypeError('Invalid connection options: connections to internal networks are not allowed in production');
  }
}
```

---

## TypeScript Safety Checklist

### Type Safety
- [ ] **No `any` types** - Use `unknown` or specific types
- [ ] **Type exports** - Export types from `index.ts` for public API
- [ ] **Strict null checks** - Handle `null` and `undefined` explicitly
- [ ] **Optional chaining** - Use `?.` for safe property access

**Example (Epic 1):**
```typescript
// Good: Use unknown, not any
function processEvent(event: unknown): void {
  if (!event || typeof event !== 'object') {
    return; // Type guard
  }
  const typedEvent = event as { state?: string; error?: Error };
  // ...
}
```

---

### Error Handling
- [ ] **Try/catch blocks** - Wrap async operations in try/catch
- [ ] **Promise rejection handling** - Handle `.catch()` on all promises
- [ ] **Error types** - Use typed errors, not generic `Error`
- [ ] **Error events** - Emit error events, don't throw in event handlers

**Example (Epic 1):**
```typescript
// Story 1.6: Error handling with event emission
try {
  await this.connection.connect();
  await this.handleReconnectSuccess();
  return;
} catch (error) {
  this.emit('reconnectionError', {
    attemptNumber: this.attemptNumber,
    error: error instanceof Error ? error : new Error(String(error)),
  });
}
```

---

### Async/Await Patterns
- [ ] **No blocking operations** - Use async/await, not synchronous file I/O
- [ ] **Timeouts** - Add timeouts to prevent hanging (Story 1.6 pattern)
- [ ] **Race conditions** - Prevent concurrent access to shared state
- [ ] **Cleanup** - Cancel timers and listeners in cleanup methods

**Example (Epic 1):**
```typescript
// Story 1.6: Timeout pattern
await Promise.race([
  this.connection.connect(),
  this.timeout(10000), // 10 second timeout
]);
```

---

## Rust Safety Checklist

### Memory Safety
- [ ] **No `unsafe` blocks** - Unless justified and documented
- [ ] **No raw pointers** - Use references and smart pointers
- [ ] **Lifetime annotations** - Explicit lifetimes where needed
- [ ] **Ownership rules** - Single owner, borrowing rules enforced

**Example (Epic 1):**
```rust
// Story 1.3: Safe string handling
let http_port: u16 = env::var("CROSSTOWN_HTTP_PORT")
    .unwrap_or_else(|_| "4041".to_string())
    .parse()
    .unwrap_or_else(|e| {
        tracing::error!("Invalid CROSSTOWN_HTTP_PORT: {}. Using default 4041.", e);
        4041
    });
```

---

### Error Handling
- [ ] **Result<T, E> propagation** - Use `?` operator for error propagation
- [ ] **No `.unwrap()` in production** - Use `.unwrap_or_else()` or `.expect()` with messages
- [ ] **Error types** - Use custom error types, not `Box<dyn Error>`
- [ ] **Logging errors** - Use `tracing::error!` for error logging

---

### Async Patterns (Tokio)
- [ ] **No blocking in async** - Use `tokio::fs`, not `std::fs` in async functions
- [ ] **Spawn long-running tasks** - Use `tokio::spawn()` for background tasks
- [ ] **Shutdown handling** - Gracefully cancel tasks on shutdown
- [ ] **Select! usage** - Use `tokio::select!` for multiplexing

---

## Testing Checklist

### Test Coverage
- [ ] **AC → Test mapping** - Document which tests validate each acceptance criterion
- [ ] **Edge cases** - Test boundary conditions, empty inputs, null values
- [ ] **Error paths** - Test failure scenarios, not just happy paths
- [ ] **Integration tests** - Use `describe.skipIf(!DOCKER_AVAILABLE)` pattern (ACTION-1)

**Epic 1 Standard:**
- 937 tests (810 unit, 127 integration)
- 100% pass rate
- Comprehensive traceability reports

---

### Test-Driven Development (AGREEMENT-1)
- [ ] **TDD for complex features** - Write tests BEFORE implementation if >3 acceptance criteria
- [ ] **Test-first mindset** - Design APIs to be testable
- [ ] **Mocking strategy** - Mock external dependencies (WebSocket, file system)
- [ ] **Test names** - Descriptive names (what is tested, expected outcome)

**Example (Epic 1):**
```typescript
// Story 1.6: Descriptive test name
it('should restore all subscriptions with original filters after reconnection', async () => {
  // Test implementation...
});
```

---

### Test Organization
- [ ] **Unit tests** - Fast, no Docker required (`*.test.ts`)
- [ ] **Integration tests** - Require Docker stack (`*.integration.test.ts`)
- [ ] **Test traceability** - Link tests to acceptance criteria in reports
- [ ] **Health checks** - Wait for Docker services before integration tests

---

## Code Organization & Style

### File Structure
- [ ] **Co-located tests** - Tests next to implementation (`__tests__/` folder)
- [ ] **Index exports** - Public API exported from `index.ts`
- [ ] **Type separation** - Types in separate files when shared
- [ ] **Documentation** - JSDoc comments for public APIs

---

### Naming Conventions
- [ ] **TypeScript files** - `kebab-case.ts`
- [ ] **TypeScript functions/variables** - `camelCase`
- [ ] **TypeScript types/interfaces** - `PascalCase`
- [ ] **TypeScript constants** - `SCREAMING_SNAKE_CASE`
- [ ] **Rust files** - `snake_case.rs`
- [ ] **Rust functions/variables** - `snake_case`
- [ ] **Rust types/structs** - `PascalCase`
- [ ] **Rust constants** - `SCREAMING_SNAKE_CASE`

---

### Documentation
- [ ] **Inline comments** - Explain "why", not "what"
- [ ] **JSDoc comments** - For all public TypeScript APIs
- [ ] **Rust doc comments** - `///` for public Rust APIs
- [ ] **README files** - Setup instructions for packages

---

## Epic 2 Specific Considerations

### ILP Packet Handling (Stories 2.2-2.3)
- [ ] **ILP packet validation** - Verify packet structure before parsing
- [ ] **Signature verification** - Verify Nostr signatures on ILP packets
- [ ] **Amount validation** - Verify payment amounts are positive integers
- [ ] **Overflow protection** - Check for integer overflow in payment calculations

---

### Crosstown Relay Integration (Story 2.1)
- [ ] **Event type validation** - Verify kind numbers match specification
- [ ] **Filter validation** - Validate subscription filter syntax
- [ ] **Reconnection handling** - Restore Crosstown subscriptions after disconnect
- [ ] **Error event handling** - Handle Nostr ERROR events gracefully

---

### BLS Handler (Story 2.4)
- [ ] **Reducer argument validation** - Validate arguments before calling SpacetimeDB reducers
- [ ] **Kind 30078 validation** - Verify event structure matches BLS specification
- [ ] **Callback error handling** - Handle reducer execution failures
- [ ] **Identity propagation** - Verify Nostr public key extracted from ILP packet

---

## Review Process

### Before Submitting PR
- [ ] Run `pnpm test` - All tests pass
- [ ] Run `pnpm audit` - No high/critical vulnerabilities
- [ ] Run `cargo audit` - No high/critical vulnerabilities (if Rust changes)
- [ ] Run `pnpm lint` - No linting errors
- [ ] Run Docker stack - Integration tests pass
- [ ] Self-review with this checklist

---

### During Code Review
- [ ] **Security review** - Check OWASP Top 10 compliance
- [ ] **Language safety** - Check TypeScript/Rust safety patterns
- [ ] **Test coverage** - Verify AC → Test traceability
- [ ] **Documentation** - Verify README and inline docs
- [ ] **Pair review** - For Nostr, ILP, BLS features (AGREEMENT-3)

---

### Pair Review Scenarios (AGREEMENT-3)
Mandatory pair review for:
- [ ] **Nostr protocol** - Event signing, relay subscriptions
- [ ] **ILP protocol** - Packet construction, payment flows
- [ ] **BLS handler** - Identity propagation, reducer calls
- [ ] **New architecture** - First implementation of new patterns

**Epic 1 Example:**
- Story 1.2 (Nostr Identity) - Charlie + Elena pair review
- Story 2.4 (BLS Handler) - Charlie + Elena pair spike (PREP-5)

---

### After PR Approval
- [ ] **Merge to main** - Squash commits if many small changes
- [ ] **Update sprint-status.yaml** - Mark story as complete
- [ ] **Create story report** - Document lessons learned
- [ ] **Update technical debt** - Capture any deferred work

---

## References

### Epic 1 Security Findings
- **H-001:** Path traversal in Docker volumes (Story 1.3)
- **H-002:** Unvalidated port ranges in Docker config (Story 1.3)
- **H-003:** Nostr relay DoS risk - unbounded subscriptions (Story 1.3)
- **M-001:** Overly permissive CORS (Story 1.3)
- **M-002:** Missing security headers (Story 1.3)
- **M-004:** Log injection risk (Story 1.3)

### Team Agreements from Retrospective
- **AGREEMENT-1:** Test-First for Complex Features (>3 ACs)
- **AGREEMENT-2:** Security Review on Every Story (OWASP Top 10)
- **AGREEMENT-3:** Pair on Unfamiliar Technologies (Nostr, ILP, BLS)
- **AGREEMENT-4:** Technical Debt Tracking (GitHub issues)
- **AGREEMENT-5:** Integration Test Documentation (Docker setup)

### External Resources
- **OWASP Top 10 2021:** https://owasp.org/Top10/
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/handbook/intro.html
- **Rust Security Guidelines:** https://anssi-fr.github.io/rust-guide/
- **SpacetimeDB Security:** https://docs.spacetimedb.com/security

---

**Document Status:** ACTIVE - Use for all Epic 2+ code reviews
**Last Updated:** 2026-02-27 by Charlie (Senior Dev)
**Next Review:** After Epic 2 Story 2.1 (validate checklist effectiveness)
**Training:** Dana (QA) trained on checklist usage (pending)
