# Story 3.2: Game Action Handler (kind 30078) - Test Architecture Trace Report

**Generated:** 2026-03-13
**Story Status:** done
**Total Tests:** 124 passing (unit, @sigil/bitcraft-bls package), 35 skipped (integration, require Docker)
**Test Framework:** Vitest
**Coverage Tool:** Vitest coverage (v8)

---

## Executive Summary

This report provides comprehensive test architecture tracing for Story 3.2, mapping all 5 acceptance criteria to their implementing tests. The analysis validates coverage across 8 test files (6 unit, 2 integration) spanning the content parser, SpacetimeDB HTTP caller, game action handler dispatch, identity prepend, error mapping, and AC coverage gap-fill tests.

**Key Findings:**

- All 5 acceptance criteria have test coverage
- 52 unit tests across 6 test files directly attributable to Story 3.2
- 20 integration tests across 2 test files (skipped without Docker)
- FR19, FR47 traceability verified
- NFR8, NFR27 traceability verified
- OWASP A02, A03, A04, A05, A07, A09 security coverage validated
- No gaps found: every AC sub-clause has at least one dedicated test

**Uncovered ACs:** None -- all 5 ACs have dedicated test coverage. All sub-clauses within each AC are traced to specific test assertions.

---

## Test File Inventory

| #   | File                               | Test Count    | ACs Covered      | Type        |
| --- | ---------------------------------- | ------------- | ---------------- | ----------- |
| 1   | `content-parser.test.ts`           | 17            | AC1, AC3         | Unit        |
| 2   | `spacetimedb-caller.test.ts`       | 12            | AC2, AC4         | Unit        |
| 3   | `handler-dispatch.test.ts`         | 10            | AC1, AC2, AC3, AC4, AC5 | Unit |
| 4   | `identity-prepend.test.ts`         | 6             | AC2              | Unit        |
| 5   | `error-mapping.test.ts`            | 5             | AC3, AC4, AC5    | Unit        |
| 6   | `ac-coverage-gaps-3-2.test.ts`     | 7             | AC1, AC2, AC3, AC4, AC5 | Unit |
| 7   | `handler-e2e-integration.test.ts`  | 12 (skipped)  | AC1, AC2, AC3, AC4, AC5 | Integration |
| 8   | `handler-error-integration.test.ts`| 8 (skipped)   | AC3, AC4, AC5    | Integration |

**Total:** 57 unit tests + 20 integration tests = 77 tests directly related to Story 3.2.

---

## Acceptance Criteria Analysis

### AC1: Event decoding and content parsing

**Full Text:**
> Given a kind 30078 Nostr event arrives via ILP routing,
> When the BLS handler processes it,
> Then the handler calls `ctx.decode()` to get the full `NostrEvent`,
> And parses `event.content` as JSON to extract `{ reducer, args }`,
> And the SDK has already validated the Nostr signature via `createVerificationPipeline`.

**Status:** FULLY COVERED
**Test Count:** 21 tests (17 content-parser + 2 handler-dispatch + 2 ac-coverage-gaps)

#### Sub-clause Coverage

**THEN: Handler calls `ctx.decode()` to get full NostrEvent**

| Test | File | Assertion |
| ---- | ---- | --------- |
| calls ctx.decode() to get the full NostrEvent | handler-dispatch.test.ts:47-68 | `expect(decodeFn).toHaveBeenCalledOnce()` |

**AND: Parses `event.content` as JSON to extract `{ reducer, args }`**

| Test | File | Assertion |
| ---- | ---- | --------- |
| parses valid JSON with reducer and args | content-parser.test.ts:19-29 | `expect(result.reducer).toBe('player_move')`, `expect(result.args).toEqual([100, 200, true])` |
| parses content with empty args array | content-parser.test.ts:31-41 | `expect(result.reducer).toBe('get_status')`, `expect(result.args).toEqual([])` |
| parses event.content to extract reducer and args | handler-dispatch.test.ts:70-93 | `expect(result.accepted).toBe(true)` (indirectly confirms successful parse) |

**AND: SDK has already validated Nostr signature via `createVerificationPipeline`**

This sub-clause is validated architecturally: the handler trusts `ctx.pubkey` as pre-verified by the SDK pipeline. The handler does NOT re-verify signatures -- this is an explicit anti-pattern documented in the story. Verified by code inspection: `handler.ts` never imports or calls any signature verification functions.

**Source Verification:**

- `handler.ts` line 62: `const event = ctx.decode();` -- handler calls ctx.decode()
- `handler.ts` line 66: `const { reducer, args } = parseEventContent(event.content);` -- parses content
- `content-parser.ts` lines 60-118: `parseEventContent()` implementation
- No signature verification code in `handler.ts` -- SDK responsibility

**Handler Registration:**

| Test | File | Assertion |
| ---- | ---- | --------- |
| handler registration logs [BLS] Handler registered for kind 30078 | ac-coverage-gaps-3-2.test.ts:239-255 | `expect(node.hasHandler(30078)).toBe(true)` |
| handler is registered for exactly kind 30078 (not other kinds) | ac-coverage-gaps-3-2.test.ts:257-274 | `expect(node.hasHandler(30078)).toBe(true)`, `expect(node.hasHandler(1)).toBe(false)`, etc. |

---

### AC2: SpacetimeDB reducer call with identity propagation

**Full Text:**
> Given a valid game action event with parseable content,
> When the handler calls SpacetimeDB,
> Then the reducer is called via SpacetimeDB HTTP API (`POST /database/bitcraft/call/{reducer}`),
> And the Nostr public key (`ctx.pubkey`) is prepended as the first argument: `[pubkey, ...args]` (64-char hex, NOT npub format),
> And the handler returns `ctx.accept({ eventId: event.id })` on success.

**Status:** FULLY COVERED
**Test Count:** 23 tests (12 spacetimedb-caller + 6 identity-prepend + 3 handler-dispatch + 2 ac-coverage-gaps)

#### Sub-clause Coverage

**THEN: Reducer is called via SpacetimeDB HTTP API (`POST /database/bitcraft/call/{reducer}`)**

| Test | File | Assertion |
| ---- | ---- | --------- |
| returns success for 200 OK response | spacetimedb-caller.test.ts:41-51 | `expect(result.success).toBe(true)`, `expect(result.statusCode).toBe(200)` |
| constructs correct URL: {url}/database/{database}/call/{reducer} | spacetimedb-caller.test.ts:186-198 | `expect(fetchSpy).toHaveBeenCalledWith('http://localhost:3000/database/bitcraft/call/player_move', ...)` |
| includes Authorization header with Bearer token | spacetimedb-caller.test.ts:200-210 | `expect(callArgs.headers['Authorization']).toBe('Bearer test-token')` |
| includes Content-Type application/json header | spacetimedb-caller.test.ts:212-220 | `expect(callArgs.headers['Content-Type']).toBe('application/json')` |
| sends JSON-serialized args as request body | spacetimedb-caller.test.ts:222-234 | `expect(callArgs.body).toBe(JSON.stringify(['pubkey123', 100, 200, true]))` |

**AND: Nostr public key prepended as first argument: `[pubkey, ...args]` (64-char hex, NOT npub)**

| Test | File | Assertion |
| ---- | ---- | --------- |
| pubkey is prepended as first element (not appended) | identity-prepend.test.ts:45-73 | `expect(callArgs[0]).toBe(pubkey)`, `expect(callArgs).toEqual([pubkey, 100, 200, true])` |
| original args array is preserved unchanged | identity-prepend.test.ts:75-101 | `expect(callArgs).toEqual([pubkey, { x: 100, z: 200 }, 'run'])` |
| pubkey is 64-char hex string format (not npub) | identity-prepend.test.ts:103-131 | `expect(firstArg).toMatch(/^[0-9a-f]{64}$/)`, `expect(firstArg).not.toMatch(/^npub1/)` |
| empty args array results in [pubkey] only | identity-prepend.test.ts:133-158 | `expect(callArgs).toEqual([pubkey])` |
| multi-element args produce [pubkey, arg1, arg2, arg3] | identity-prepend.test.ts:160-185 | `expect(callArgs).toEqual([pubkey, 'arg1', 'arg2', 'arg3'])` |
| nested object args are preserved | identity-prepend.test.ts:187-213 | `expect(callArgs).toEqual([pubkey, { x: 100, z: 200 }, [1, 2, 3], 'simple'])` |
| prepends ctx.pubkey to args as first element | handler-dispatch.test.ts:97-126 | `expect(callReducer).toHaveBeenCalledWith(expect.any(Object), 'player_move', [pubkey, 100, 200])` |

**AND: Handler returns `ctx.accept({ eventId: event.id })` on success**

| Test | File | Assertion |
| ---- | ---- | --------- |
| returns ctx.accept({ eventId: event.id }) on success | handler-dispatch.test.ts:128-153 | `expect(result.accepted).toBe(true)`, `expect(acceptFn).toHaveBeenCalledWith({ eventId })` |

**Source Verification:**

- `handler.ts` line 70: `const argsWithIdentity: unknown[] = [ctx.pubkey, ...args];` -- pubkey prepend
- `handler.ts` line 73: `await callReducer(callerConfig, reducer, argsWithIdentity);` -- SpacetimeDB call
- `handler.ts` line 81: `return ctx.accept({ eventId: event.id });` -- success return
- `spacetimedb-caller.ts` line 79: URL construction `${config.url}/database/${config.database}/call/${reducer}`

---

### AC3: Invalid content handling

**Full Text:**
> Given an event with invalid or missing content JSON,
> When the handler attempts to parse it,
> Then the handler returns `ctx.reject('F06', 'Invalid event content: missing reducer or args')`,
> And no SpacetimeDB call is made.

**Status:** FULLY COVERED
**Test Count:** 22 tests (17 content-parser + 1 handler-dispatch + 2 error-mapping + 2 ac-coverage-gaps)

#### Sub-clause Coverage

**THEN: Handler returns `ctx.reject('F06', 'Invalid event content: missing reducer or args')`**

| Test | File | Assertion |
| ---- | ---- | --------- |
| returns ctx.reject("F06", ...) for invalid content | handler-dispatch.test.ts:157-187 | `expect(result.accepted).toBe(false)`, `expect(rejectFn).toHaveBeenCalledWith('F06', expect.stringContaining('Invalid event content'))` |
| invalid JSON content maps to F06 ILP error code | error-mapping.test.ts:46-69 | `expect(rejectFn).toHaveBeenCalledWith('F06', expect.any(String))` |
| missing reducer/args maps to F06 ILP error code | error-mapping.test.ts:71-97 | `expect(rejectFn).toHaveBeenCalledWith('F06', expect.stringContaining('missing reducer or args'))` |

**AND: No SpacetimeDB call is made**

| Test | File | Assertion |
| ---- | ---- | --------- |
| callReducer is NOT called when content parsing fails (invalid JSON) | ac-coverage-gaps-3-2.test.ts:56-78 | `expect(callReducer).not.toHaveBeenCalled()` |
| callReducer is NOT called when reducer field is missing | ac-coverage-gaps-3-2.test.ts:80-102 | `expect(callReducer).not.toHaveBeenCalled()` |

**Content Validation Tests (content-parser.test.ts):**

| Validation Case | Test | Assertion |
| --------------- | ---- | --------- |
| Malformed JSON | throws ContentParseError for malformed JSON | `expect(() => parseEventContent(content)).toThrow(ContentParseError)` |
| Missing reducer field | throws ContentParseError when reducer field is missing | `.toThrow(/missing reducer or args/)` |
| Non-string reducer (number) | throws ContentParseError when reducer is non-string (number) | `.toThrow(/reducer must be a string/)` |
| Null reducer | throws ContentParseError when reducer is null | `.toThrow(/reducer must be a string/)` |
| Object reducer | throws ContentParseError when reducer is an object | `.toThrow(/reducer must be a string/)` |
| Empty string reducer | throws ContentParseError when reducer is empty string | `.toThrow(/reducer must not be empty/)` |
| Path traversal (../etc/passwd) | throws ContentParseError for reducer with path traversal chars | `.toThrow(/invalid characters/)` |
| SQL injection (test; DROP TABLE) | throws ContentParseError for reducer with SQL injection | `.toThrow(/invalid characters/)` |
| Command injection (test && rm -rf /) | throws ContentParseError for reducer with command injection | `.toThrow(/invalid characters/)` |
| Reducer > 64 chars | throws ContentParseError for reducer name exceeding 64 chars | `.toThrow(/invalid characters/)` |
| Missing args field | throws ContentParseError when args field is missing | `.toThrow(/missing reducer or args/)` |
| Non-array args (object) | throws ContentParseError when args is not an array (object) | `.toThrow(/args must be an array/)` |
| Non-array args (string) | throws ContentParseError when args is a string | `.toThrow(/args must be an array/)` |
| Non-array args (number) | throws ContentParseError when args is a number | `.toThrow(/args must be an array/)` |
| Content > 1MB | throws ContentParseError for content exceeding 1MB | `.toThrow(/exceeds maximum size/)` |

**Source Verification:**

- `handler.ts` lines 88-93: ContentParseError -> `ctx.reject('F06', err.message)`
- `content-parser.ts` lines 60-118: All validation rules in `parseEventContent()`

---

### AC4: SpacetimeDB error handling

**Full Text:**
> Given an event referencing a non-existent reducer,
> When the SpacetimeDB HTTP API returns a 404 or error,
> Then the handler returns `ctx.reject('T00', 'Unknown reducer: {name}')`,
> And the error is logged with event ID, pubkey, and reducer name.

**Status:** FULLY COVERED
**Test Count:** 13 tests (4 spacetimedb-caller HTTP errors + 4 handler-dispatch + 2 error-mapping + 1 ac-coverage-gaps + 2 spacetimedb-caller timeout/network)

#### Sub-clause Coverage

**THEN: Handler returns `ctx.reject('T00', 'Unknown reducer: {name}')` (for 404)**

| Test | File | Assertion |
| ---- | ---- | --------- |
| throws ReducerCallError with UNKNOWN_REDUCER code on 404 | spacetimedb-caller.test.ts:55-69 | `expect((err).code).toBe('UNKNOWN_REDUCER')`, `expect((err).statusCode).toBe(404)` |
| returns ctx.reject("T00", "Unknown reducer: {name}") on 404 | handler-dispatch.test.ts:190-224 | `expect(rejectFn).toHaveBeenCalledWith('T00', expect.stringContaining('Unknown reducer: nonexistent_reducer'))` |
| SpacetimeDB 404 maps to T00 ILP error code | error-mapping.test.ts:99-128 | `expect(rejectFn).toHaveBeenCalledWith('T00', expect.stringContaining('Unknown reducer'))` |

**THEN: Handler returns `ctx.reject('T00', ...)` for 400/500 errors**

| Test | File | Assertion |
| ---- | ---- | --------- |
| throws ReducerCallError with REDUCER_FAILED code on 400 | spacetimedb-caller.test.ts:71-85 | `expect((err).code).toBe('REDUCER_FAILED')`, `expect((err).statusCode).toBe(400)` |
| throws ReducerCallError with REDUCER_FAILED code on 500 | spacetimedb-caller.test.ts:87-101 | `expect((err).code).toBe('REDUCER_FAILED')`, `expect((err).statusCode).toBe(500)` |
| returns ctx.reject("T00", "Reducer {name} failed: ...") on 400/500 | handler-dispatch.test.ts:226-260 | `expect(rejectFn).toHaveBeenCalledWith('T00', expect.stringContaining('Reducer player_move failed'))` |
| SpacetimeDB 400/500 maps to T00 ILP error code | error-mapping.test.ts:130-159 | `expect(rejectFn).toHaveBeenCalledWith('T00', expect.stringContaining('failed'))` |

**THEN: Timeout handling**

| Test | File | Assertion |
| ---- | ---- | --------- |
| throws ReducerCallError with timeout message | spacetimedb-caller.test.ts:105-133 | `expect((err).code).toBe('REDUCER_FAILED')`, `expect((err).message).toContain('timed out')` |
| cancels fetch via AbortController on timeout | spacetimedb-caller.test.ts:135-164 | `expect(abortSignal?.aborted).toBe(true)` |
| returns ctx.reject("T00", "Reducer {name} timed out") on timeout | handler-dispatch.test.ts:262-296 | `expect(rejectFn).toHaveBeenCalledWith('T00', expect.stringContaining('Reducer slow_reducer timed out'))` |

**THEN: Unexpected error handling**

| Test | File | Assertion |
| ---- | ---- | --------- |
| throws ReducerCallError on network failure | spacetimedb-caller.test.ts:168-182 | `expect((err).code).toBe('REDUCER_FAILED')`, `expect((err).message).toContain('ECONNREFUSED')` |
| returns ctx.reject("T00", "Internal error: ...") on unexpected error | handler-dispatch.test.ts:298-327 | `expect(rejectFn).toHaveBeenCalledWith('T00', expect.stringContaining('Internal error'))` |

**AND: Error is logged with event ID, pubkey, and reducer name**

| Test | File | Assertion |
| ---- | ---- | --------- |
| T00 error log includes eventId, truncated pubkey, reducer name, and error reason | ac-coverage-gaps-3-2.test.ts:149-195 | `expect(errorLog).toContain(eventId)`, `.toContain('32e18276...e245')`, `.toContain('nonexistent_reducer')`, `.toContain('T00')`, `.toMatch(/duration: \d+ms/)` |

**Source Verification:**

- `handler.ts` lines 96-113: ReducerCallError handling with T00 rejection
- `spacetimedb-caller.ts` lines 110-144: HTTP error mapping (404->UNKNOWN_REDUCER, 400/500->REDUCER_FAILED, timeout->REDUCER_FAILED)

---

### AC5: Zero silent failures

**Full Text:**
> Given any handler execution,
> When it succeeds or fails,
> Then zero silent failures -- every outcome is explicit,
> And all errors include: event ID, pubkey (truncated), reducer name, error reason.

**Status:** FULLY COVERED
**Test Count:** 11 tests (1 error-mapping + 5 ac-coverage-gaps + 5 handler-dispatch implicit)

#### Sub-clause Coverage

**THEN: Zero silent failures -- every outcome is explicit (accept or reject)**

The handler implementation in `handler.ts` uses a try/catch structure that guarantees every execution path returns either `ctx.accept()` or `ctx.reject()`:

- Lines 81: `return ctx.accept({ eventId: event.id });` -- success path
- Lines 92: `return ctx.reject('F06', err.message);` -- ContentParseError path
- Lines 112: `return ctx.reject('T00', message);` -- ReducerCallError path
- Lines 121: `return ctx.reject('T00', message);` -- unexpected error path

All 10 handler-dispatch tests verify this implicitly: every test checks that the result has `accepted` as `true` or `false`.

Additionally, integration tests explicitly test this:

| Test | File | Assertion |
| ---- | ---- | --------- |
| no silent failures: every dispatch results in accept or reject | handler-error-integration.test.ts:200-239 | `expect(result).toHaveProperty('accepted')` for all 4 events (mixed valid/invalid) |

**AND: All errors include event ID, pubkey (truncated), reducer name, error reason**

| Test | File | Assertion |
| ---- | ---- | --------- |
| all errors include event ID, truncated pubkey, reducer name, and error reason | error-mapping.test.ts:161-199 | `expect(errorLog).toContain(eventId)`, `.toContain(pubkey.slice(0, 8))`, `.toContain(pubkey.slice(-4))`, `.toContain('reducer: unknown')`, `.toContain('F06')` |
| T00 error log includes eventId, truncated pubkey, reducer name, and error reason | ac-coverage-gaps-3-2.test.ts:149-195 | Full log format validation with T00 error code |
| success log includes [BLS] Action succeeded, eventId, truncated pubkey, reducer, duration | ac-coverage-gaps-3-2.test.ts:110-143 | `expect(successLog).toContain('eventId: ${eventId}')`, `.toContain('pubkey: 32e18276...e245')`, `.toContain('reducer: player_move')`, `.toMatch(/duration: \d+ms/)` |
| pubkey is truncated as first 8 + "..." + last 4 hex chars | ac-coverage-gaps-3-2.test.ts:202-232 | `expect(log).toContain('32e18276...e245')` |

**Log Format Verification:**

Success log format: `[BLS] Action succeeded | eventId: {id} | pubkey: {truncated} | reducer: {name} | duration: {ms}ms`
Error log format: `[BLS] Action failed | eventId: {id} | pubkey: {truncated} | reducer: {name} | error: {code}: {message} | duration: {ms}ms`

**Source Verification:**

- `handler.ts` lines 77-79: Success log with all required fields
- `handler.ts` lines 89-91: F06 error log with all required fields
- `handler.ts` lines 109-111: T00 error log with all required fields
- `handler.ts` lines 118-120: Unexpected error log with all required fields
- `handler.ts` lines 36-39: `truncatePubkey()` -- first 8 + "..." + last 4

---

## Integration Test Coverage

### handler-e2e-integration.test.ts (12 tests, skipped without Docker)

| Test | ACs Covered | Description |
| ---- | ----------- | ----------- |
| full handler flow: mock packet -> decode -> parse -> SpacetimeDB call -> accept | AC1, AC2 | End-to-end happy path |
| handler registered on node kind 30078 | AC1 | Handler registration verification |
| valid game action processed end-to-end | AC1, AC2 | AcceptResponse with eventId in metadata |
| identity correctly propagated to SpacetimeDB reducer | AC2 | Pubkey prepend validated end-to-end |
| multiple sequential actions from same identity | AC2, AC5 | No state leakage between calls |
| multiple concurrent actions processed without data loss | AC2, AC5 | Concurrent dispatch safety |
| handler logs include eventId, pubkey, reducer, duration | AC5 | Success log format in integration context |
| ctx.accept() returns AcceptResponse with eventId in metadata | AC2 | Metadata structure validation |
| SpacetimeDB reducer receives args with pubkey prepended | AC2 | Identity propagation end-to-end |
| handler dispatched via node.dispatch() | AC1, AC2 | Node dispatch mechanism |
| handler works with various reducer names | AC1 | Multiple reducer name acceptance |
| handler works with various arg types | AC1, AC2 | Various JSON types preserved |

### handler-error-integration.test.ts (8 tests, skipped without Docker)

| Test | ACs Covered | Description |
| ---- | ----------- | ----------- |
| invalid JSON content rejected with F06 | AC3 | End-to-end invalid content rejection |
| missing reducer field rejected with F06 | AC3 | Missing field detection |
| missing args field rejected with F06 | AC3 | Missing field detection |
| unknown reducer name returns T00 from SpacetimeDB | AC4 | 404 -> T00 mapping end-to-end |
| SpacetimeDB returns 400 (bad args) -> T00 reject | AC4 | 400 -> T00 mapping end-to-end |
| SpacetimeDB returns 500 (internal error) -> T00 reject | AC4 | 500 -> T00 mapping end-to-end |
| no silent failures: every dispatch results in accept or reject | AC5 | Zero silent failures validation |
| error logs contain event ID, pubkey (truncated), reducer name, error reason | AC5 | Error log format validation |

---

## FR/NFR Traceability Matrix

### Functional Requirements

| FR   | Description                               | AC(s)    | Test Coverage |
| ---- | ----------------------------------------- | -------- | ------------- |
| FR19 | BLS handler validates and calls reducer   | AC2, AC3 | handler-dispatch.test.ts (pubkey prepend, accept/reject), identity-prepend.test.ts (6 prepend variants), spacetimedb-caller.test.ts (HTTP call construction), content-parser.test.ts (17 validation cases), error-mapping.test.ts (F06 mapping) |
| FR47 | BLS game action handler mapping           | AC1, AC4 | handler-dispatch.test.ts (ctx.decode() invocation, event content parsing), ac-coverage-gaps-3-2.test.ts (handler registration on kind 30078), spacetimedb-caller.test.ts (404/400/500 error codes), error-mapping.test.ts (T00 mapping) |

### Non-Functional Requirements

| NFR   | Description                                      | AC(s) | Test Coverage |
| ----- | ------------------------------------------------ | ----- | ------------- |
| NFR8  | All ILP packets signed with user's Nostr key     | AC1   | Architectural: SDK verifies Nostr signature via `createVerificationPipeline` before handler invocation; handler trusts `ctx.pubkey`. Not re-verified in handler by design. |
| NFR27 | Zero silent failures                             | AC5   | error-mapping.test.ts (F06/T00 context in logs), ac-coverage-gaps-3-2.test.ts (success log, error log, pubkey truncation, duration), handler-error-integration.test.ts (every dispatch results in accept/reject) |

---

## OWASP Security Coverage

| OWASP | Control                       | Test Coverage |
| ----- | ----------------------------- | ------------- |
| A02   | Cryptographic Failures        | spacetimedb-caller.test.ts:238-256 -- "never includes token value in error messages or logs": secret token `super-secret-token-value` verified NOT present in error message after 500 failure |
| A03   | Injection                     | content-parser.test.ts:148-176 -- 3 injection tests: path traversal (`../etc/passwd`), SQL injection (`test; DROP TABLE`), command injection (`test && rm -rf /`). Reducer name validated via `/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/`. Content size limit 1MB. |
| A04   | Insecure Design               | handler-error-integration.test.ts:200-239 -- every dispatch results in accept or reject (no silent failures). All handler-dispatch tests verify explicit accept/reject outcomes. |
| A05   | Security Misconfiguration     | spacetimedb-caller.test.ts:105-164 -- 30s AbortController timeout, `clearTimeout` on success (verified via abort signal). Prevents hanging connections. |
| A07   | Identification/Authentication | identity-prepend.test.ts:103-131 -- pubkey format verified as 64-char hex (not npub). Handler trusts SDK-verified `ctx.pubkey`. |
| A09   | Security Logging              | ac-coverage-gaps-3-2.test.ts:110-143 -- success log format validation. ac-coverage-gaps-3-2.test.ts:149-195 -- error log format validation. error-mapping.test.ts:161-199 -- error context includes eventId, truncated pubkey, reducer, error reason. spacetimedb-caller.test.ts:238-256 -- token never in error messages. |

---

## Test Quality Assessment

### Strengths

1. **Comprehensive content validation** -- 17 tests in `content-parser.test.ts` covering every validation rule individually: malformed JSON, missing fields, wrong types (number, null, object for reducer; string, number, object for args), empty strings, injection vectors (path traversal, SQL, command), size limits, and the happy path. This is exhaustive.

2. **Identity prepend isolation** -- 6 dedicated tests in `identity-prepend.test.ts` verify the pubkey prepend behavior in isolation: correct position (first, not last), format (64-char hex, not npub), empty args, multi-element args, nested objects. This separates the identity propagation concern from the rest of the handler logic.

3. **Error mapping coverage** -- Error code mapping (F06 and T00) is tested at three levels: (a) the spacetimedb-caller module (HTTP status -> ReducerCallError), (b) the handler module (ReducerCallError/ContentParseError -> ctx.reject), and (c) the error-mapping test file (complete F06/T00 mapping matrix). This layered testing ensures error codes are correct even if internal error handling changes.

4. **Coverage gap-fill tests** -- The `ac-coverage-gaps-3-2.test.ts` file addresses specific gaps identified during test architecture review: no SpacetimeDB call on invalid content, success log format, error log format, pubkey truncation format, and handler registration. This demonstrates intentional gap-filling.

5. **Integration tests present** -- 20 integration tests cover the full handler flow end-to-end, including concurrent dispatches, mixed valid/invalid events, and various reducer names and arg types. Properly skipped without Docker.

### Observations

1. **Mock complexity in handler-dispatch tests** -- The `vi.mock('../spacetimedb-caller.js')` pattern requires a re-implementation of `ReducerCallError` class in the mock factory. This is necessary because `instanceof` checks in the handler need a matching class, but it adds maintenance burden if the error class signature changes.

2. **Integration tests validate same behavior as unit tests** -- Several integration tests (e.g., invalid JSON -> F06, missing reducer -> F06) duplicate unit test coverage. This is intentional (defense in depth) but means integration test failures would be caught by unit tests first.

3. **Timeout test timing sensitivity** -- The `spacetimedb-caller.test.ts` timeout tests use `timeoutMs: 100` and `timeoutMs: 50` respectively. These are fast enough to not cause test flakiness on CI, but the pattern is inherently timing-dependent.

---

## Summary Statistics

| Metric                            | Value                         |
| --------------------------------- | ----------------------------- |
| Total ACs                         | 5                             |
| ACs Fully Covered                 | 5                             |
| ACs Partially Covered             | 0                             |
| ACs Uncovered                     | 0                             |
| Unit Test Files                   | 6                             |
| Integration Test Files            | 2                             |
| Total Tests (Story 3.2 specific)  | 77 (57 unit + 20 integration) |
| Total Tests (package)             | 124 passing, 35 skipped       |
| Content Validation Tests          | 17                            |
| HTTP Caller Tests                 | 12                            |
| Handler Dispatch Tests            | 10                            |
| Identity Prepend Tests            | 6                             |
| Error Mapping Tests               | 5                             |
| AC Gap-Fill Tests                 | 7                             |
| Integration Happy Path Tests      | 12                            |
| Integration Error Path Tests      | 8                             |
| OWASP A03 Injection Tests         | 3 (+ 2 size limit)           |
| OWASP A02 Token Security Tests    | 1                             |
| FR Coverage                       | FR19, FR47                    |
| NFR Coverage                      | NFR8, NFR27                   |

---

**Report Generated By:** Claude Opus 4.6 (claude-opus-4-6)
**Analysis Method:** /bmad-tea-testarch-trace (manual traceability analysis with source verification)
**Source Files Analyzed:** 8 test files, 3 source files, 1 index.ts, 1 handler-context.factory.ts
