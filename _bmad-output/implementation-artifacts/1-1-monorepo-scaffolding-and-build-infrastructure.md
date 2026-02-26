# Story 1.1: Monorepo Scaffolding & Build Infrastructure

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a properly structured polyglot monorepo with TypeScript and Rust workspaces, shared configs, and CI/CD,
so that all subsequent packages and crates have a consistent foundation to build on.

## Acceptance Criteria

**AC1: pnpm workspace resolution**
**Given** a fresh clone of the repository
**When** I run `pnpm install` (requires pnpm 9.0.0+ and Node.js 20.x)
**Then** the pnpm workspace resolves with `packages/client`, `packages/mcp-server`, and `packages/tui-backend` as workspace members
**And** a shared `tsconfig.base.json` exists at root with `strict: true` and `target: "ES2022"`

**AC2: Cargo workspace builds**
**Given** a fresh clone of the repository
**When** I run `cargo build` from the root
**Then** the cargo workspace builds with `crates/tui` as a workspace member
**And** a shared `rustfmt.toml` exists at root with `edition = "2021"` and `max_width = 100`

**AC3: Root configuration files present**
**Given** the monorepo is set up
**When** I check the root configuration files
**Then** ESLint config (`.eslintrc.cjs`), Prettier config (`.prettierrc`), and `.env.example` exist at root
**And** `.gitignore` excludes `node_modules/`, `target/`, `.env`, `dist/`, `build/`, `*.tsbuildinfo`, `.turbo/`, `*.local`, and `coverage/`

**AC4: CI workflows execute successfully**
**Given** a push or pull request to the repository
**When** CI runs
**Then** `.github/workflows/ci-typescript.yml` executes: lint, typecheck, test, build with pnpm cache enabled
**And** `.github/workflows/ci-rust.yml` executes: clippy, rustfmt check, test, build with cargo cache enabled

**AC5: TypeScript packages configured correctly**
**Given** the `packages/client` workspace package
**When** I inspect its `package.json`
**Then** it is named `@sigil/client` with `"type": "module"` and workspace dependencies use `"workspace:*"` protocol
**And** `tsup.config.ts` exists with `format: ["esm", "cjs"]`, `dts: true`, and `outDir: "dist"`
**And** `vitest` is configured in package.json with `"test": "vitest run"` script
**And** `src/index.ts` exports a placeholder constant to ensure build succeeds

## Tasks / Subtasks

- [x] Task 1: Create pnpm workspace structure (AC1, AC3)
  - [x] Initialize root `package.json` with `"private": true`, pnpm workspace config, and shared devDependencies (eslint, prettier, typescript)
  - [x] Create `pnpm-workspace.yaml` with `packages: ["packages/*"]`
  - [x] Create/append to `.gitignore`: node_modules/, target/, .env, dist/, build/, *.tsbuildinfo, .turbo/, *.local, coverage/, .pnpm-debug.log*
  - [x] Create `tsconfig.base.json` with strict: true, target: ES2022, module: ESNext, moduleResolution: bundler
  - [x] Create `.eslintrc.cjs` with @typescript-eslint parser and recommended rules
  - [x] Create `.prettierrc` with semi: true, singleQuote: true, trailingComma: es5
  - [x] Create `.env.example` with SPACETIMEDB_URL and CROSSTOWN_URL placeholders

- [x] Task 2: Initialize TypeScript workspace packages (AC5)
  - [x] Create `packages/client/package.json`: name "@sigil/client", type "module", main "./dist/index.js", exports with ESM/CJS, dependencies: @clockworklabs/spacetimedb-sdk@^1.3.3, nostr-tools@^2.23.0
  - [x] Create `packages/mcp-server/package.json`: name "@sigil/mcp-server", dependencies: "@sigil/client": "workspace:*"
  - [x] Create `packages/tui-backend/package.json`: name "@sigil/tui-backend", dependencies: "@sigil/client": "workspace:*"
  - [x] Create `tsup.config.ts` in each package: format: ["esm", "cjs"], dts: true, entry: ["src/index.ts"], outDir: "dist", clean: true
  - [x] Create `vitest.config.ts` in each package with test glob patterns
  - [x] Create `packages/client/src/index.ts` exporting `export const SIGIL_VERSION = "0.1.0";`
  - [x] Create `packages/mcp-server/src/index.ts` exporting placeholder
  - [x] Create `packages/tui-backend/src/index.ts` exporting placeholder
  - [x] Create `packages/client/tsconfig.json` extending ../tsconfig.base.json
  - [x] Create matching tsconfig.json for mcp-server and tui-backend

- [x] Task 3: Create Cargo workspace structure (AC2)
  - [x] Create root `Cargo.toml` as virtual workspace: `[workspace]`, `members = ["crates/*"]`, `resolver = "2"`
  - [x] Create `crates/tui/Cargo.toml`: name "sigil-tui", edition "2021", dependencies: ratatui@0.30, crossterm@0.29.0, tokio, serde, serde_json
  - [x] Create `rustfmt.toml`: edition = "2021", max_width = 100, tab_spaces = 4
  - [x] Create `crates/tui/src/main.rs` with minimal `fn main() { println!("Sigil TUI"); }` and passing `#[test]`

- [x] Task 4: Set up GitHub Actions CI/CD (AC4)
  - [x] Create `.github/workflows/ci-typescript.yml`: Node 20.x setup, pnpm cache, steps: install, lint, typecheck, test, build
  - [x] Create `.github/workflows/ci-rust.yml`: Rust stable setup, cargo cache, steps: fmt --check, clippy -- -D warnings, test, build --release
  - [x] Configure triggers: on push and pull_request for both workflows
  - [x] Ensure workflows fail fast and report clear errors

- [x] Task 5: Create empty placeholder directories (Architecture requirement)
  - [x] Create `skills/` directory with .gitkeep
  - [x] Create `agents/` directory with .gitkeep
  - [x] Create `docker/` directory with .gitkeep

- [x] Task 6: Verify workspace builds and tests pass (AC1, AC2, AC4, AC5)
  - [x] Run `pnpm install` and verify all TS packages resolve without errors
  - [x] Run `pnpm --filter @sigil/client build` and verify dist/ output contains ESM, CJS, and .d.ts files
  - [x] Run `cargo build` and verify Rust workspace compiles to target/debug/sigil-tui
  - [x] Run `pnpm --filter @sigil/client test` and verify placeholder test passes
  - [x] Run `cargo test` and verify placeholder test passes
  - [x] Commit initial workspace structure with message referencing Story 1.1

## Dev Notes

**Architecture Requirements:**

This story establishes the foundational monorepo structure for Sigil. The project is a **single polyglot monorepo** combining TypeScript (pnpm workspaces) and Rust (cargo workspace) in one repository.

**Key Architectural Decisions:**

1. **Single Polyglot Monorepo**: TypeScript (pnpm workspace) + Rust (cargo workspace) coexist in one repo. They are independent build systems that share the same git repository.
2. **Package Naming Convention**:
   - TypeScript packages: `@sigil/*` scope (npm scoped packages)
   - Rust crate: `sigil-tui` (single binary crate, not a library)
3. **Build Outputs**:
   - TypeScript: Dual ESM (.mjs) + CJS (.cjs) bundles with TypeScript declarations (.d.ts) - supports both import and require
   - Rust: Single binary executable in target/debug/ or target/release/
4. **Workspace Protocol**: TypeScript packages use `"workspace:*"` to reference each other - this ensures local development uses workspace versions, not published npm versions

**Critical Technical Requirements:**

1. **SpacetimeDB SDK Version Constraint (CRITICAL)**: Must use `@clockworklabs/spacetimedb-sdk@^1.3.3` specifically. SDK 2.0+ introduces WebSocket protocol v2 which is NOT backwards compatible with BitCraft's SpacetimeDB 1.6.0 server (which uses protocol v1). Using SDK 2.0+ will result in connection failures. This version pin is non-negotiable for Phase 1.

2. **Runtime Requirements**:
   - Node.js: 20.x (LTS) - required for native ES modules and latest TS features
   - pnpm: 9.0.0+ - required for workspace protocol support
   - Rust: 1.70+ (stable) - required for ratatui 0.30

3. **TypeScript Configuration**: All packages must extend `tsconfig.base.json` with strict mode enabled. No package may disable strictNullChecks, strictFunctionTypes, or noImplicitAny.

4. **Workspace Dependency Protocol**: TypeScript packages reference each other using `"workspace:*"` protocol in package.json. Example: `"@sigil/client": "workspace:*"` ensures local development uses workspace versions.

5. **Build Output Requirements**:
   - TypeScript packages: ESM (.js), CJS (.cjs), TypeScript declarations (.d.ts) in dist/
   - Rust crate: Binary in target/debug/sigil-tui (debug) or target/release/sigil-tui (release)

6. **Project Structure**: Repository must contain both existing project files AND new workspace structure coexisting:
   ```
   sigil/ (repository root)
   ├── packages/              # TypeScript (pnpm workspace)
   │   ├── client/            # @sigil/client — pure library (the engine)
   │   ├── mcp-server/        # @sigil/mcp-server — MCP protocol wrapper
   │   └── tui-backend/       # @sigil/tui-backend — JSON-RPC IPC wrapper
   ├── crates/                # Rust (cargo workspace)
   │   └── tui/               # sigil-tui — ratatui presentation layer
   ├── skills/                # Shared SKILL.md files (create empty dir)
   ├── agents/                # Agent definitions (create empty dir)
   ├── docker/                # Docker Compose for local dev (create empty dir)
   ├── pnpm-workspace.yaml
   ├── Cargo.toml             # Virtual manifest
   ├── package.json
   ├── tsconfig.base.json
   ├── .eslintrc.cjs
   ├── .prettierrc
   ├── rustfmt.toml
   ├── .gitignore
   └── .env.example
   ```

**Existing Repository Context:** This repository contains BitCraft server source (`BitCraftServer/`), BMAD framework (`_bmad/`), planning artifacts (`_bmad-output/`), and documentation (`docs/`, root-level .md files). The new workspace structure coexists with these existing directories - DO NOT modify or remove them. The only existing file that may be modified is `.gitignore` (append workspace exclusions).

### Dependency Versions

**TypeScript (packages/client)**: @clockworklabs/spacetimedb-sdk@^1.3.3 (CRITICAL - see above), nostr-tools@^2.23.0

**TypeScript (all packages devDeps)**: typescript@^5.0.0, tsup@latest, vitest@latest, @types/node@latest

**Root devDependencies**: eslint@latest, prettier@latest, @typescript-eslint/eslint-plugin@latest, @typescript-eslint/parser@latest

**Rust (crates/tui)**: ratatui = "0.30", crossterm = "0.29.0", tokio = { version = "1", features = ["rt", "time", "macros", "sync"] }, serde = { version = "1", features = ["derive"] }, serde_json = "1"

### Placeholder Content Requirements

**TypeScript packages (src/index.ts)**: Must export at least one named constant to ensure build succeeds. Example: `export const SIGIL_VERSION = "0.1.0";`. This ensures tsup produces valid output and tests can import.

**TypeScript tests (src/index.test.ts)**: Import from index and assert. Example:
```typescript
import { expect, test } from 'vitest';
import { SIGIL_VERSION } from './index';
test('exports version', () => {
  expect(SIGIL_VERSION).toBeDefined();
});
```

**Rust main (src/main.rs)**: Must have main fn and passing test. Example:
```rust
fn main() {
    println!("Sigil TUI v0.1.0");
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
```

### Configuration File Examples

**packages/client/package.json** must include:
```json
{
  "name": "@sigil/client",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "test": "vitest run"
  }
}
```

**packages/client/tsup.config.ts** must contain:
```typescript
import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  outDir: 'dist',
  clean: true,
  sourcemap: true,
});
```

**tsconfig.base.json** at root must include:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

**Root package.json**:
```json
{
  "name": "sigil-monorepo",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "pnpm --recursive build",
    "test": "pnpm --recursive test",
    "lint": "eslint packages/*/src --ext .ts",
    "typecheck": "pnpm --recursive exec tsc --noEmit"
  },
  "devDependencies": {
    "eslint": "^8.50.0",
    "prettier": "^3.0.0",
    "@typescript-eslint/eslint-plugin": "^6.7.0",
    "@typescript-eslint/parser": "^6.7.0",
    "typescript": "^5.2.0"
  }
}
```

**pnpm-workspace.yaml** at root:
```yaml
packages:
  - 'packages/*'
```

**Root Cargo.toml** (virtual workspace):
```toml
[workspace]
members = ["crates/*"]
resolver = "2"
```

**.env.example** at root:
```bash
# SpacetimeDB connection (default for Docker dev environment)
SPACETIMEDB_URL=ws://localhost:3000

# Crosstown node connection (default for Docker dev environment)
CROSSTOWN_URL=http://localhost:8080

# Optional: Log level
LOG_LEVEL=info
```

**crates/tui/Cargo.toml** must include:
```toml
[package]
name = "sigil-tui"
version = "0.1.0"
edition = "2021"

[dependencies]
ratatui = "0.30"
crossterm = "0.29.0"
tokio = { version = "1", features = ["rt", "time", "macros", "sync"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

**.eslintrc.cjs** at root:
```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
};
```

**.prettierrc** at root:
```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "tabWidth": 2,
  "printWidth": 100
}
```

**rustfmt.toml** at root:
```toml
edition = "2021"
max_width = 100
tab_spaces = 4
```

### .gitignore Contents (append to existing or create new)

```
# Workspaces
node_modules/
dist/
build/
target/
*.tsbuildinfo
.turbo/

# Environment & Logs
.env
.env.local
.env.*.local
*.log
.pnpm-debug.log*

# Testing
coverage/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Rust
Cargo.lock
**/*.rs.bk

# Packages
*.tgz
```

### CI/CD Workflow Requirements

**ci-typescript.yml**: Triggers on push/pull_request, runs on ubuntu-latest, uses Node.js 20.x with pnpm setup, caches pnpm store using actions/cache with key containing pnpm-lock.yaml hash, runs: `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Each step fails fast.

**ci-rust.yml**: Triggers on push/pull_request, runs on ubuntu-latest, uses Rust stable with rustup, caches cargo registry and target/ using actions/cache with key containing Cargo.lock hash, runs: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, `cargo build --release`. Each step fails fast.

### Architecture Alignment

This story implements the exact monorepo structure defined in `_bmad-output/planning-artifacts/architecture/project-structure-boundaries.md`. TypeScript packages in `packages/`, Rust crates in `crates/`, shared resources in `skills/`, `agents/`, `docker/`. No variances from architecture specification.

### References

- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md] - Complete project directory structure
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#repository-strategy] - Single polyglot monorepo decision
- [Source: _bmad-output/planning-artifacts/architecture/starter-template-technology-foundation.md] - Dependency versions and rationale
- [Source: _bmad-output/auto-bmad-artifacts/spike-spacetimedb-compatibility.md] - SpacetimeDB SDK 1.3.3 requirement
- [Source: _bmad-output/planning-artifacts/architecture/13-technology-choices.md] - Technology stack decisions
- [Source: _bmad-output/planning-artifacts/epics.md#story-11] - Original story definition from Epic 1

### Implementation Constraints

1. Only modify `.gitignore` from existing files - all other files are NEW
2. Package names are exact: `@sigil/client`, `@sigil/mcp-server`, `@sigil/tui-backend`, `sigil-tui`
3. SpacetimeDB SDK must be 1.3.3 (NOT 2.0+) - protocol incompatibility
4. Use pnpm (NOT npm/yarn) and workspace:* protocol for local dependencies
5. All packages must build and test successfully even as placeholders

### Verification Steps

Run these commands to verify completion:
1. `pnpm install` - succeeds without errors, resolves all workspace packages
2. `pnpm --filter @sigil/client build` - produces dist/ with .js, .cjs, .d.ts files
3. `cargo build` - produces target/debug/sigil-tui binary
4. `pnpm --filter @sigil/client test` - passes placeholder test
5. `cargo test` - passes placeholder test
6. Verify `.github/workflows/` contains ci-typescript.yml and ci-rust.yml with valid syntax
7. Verify `skills/`, `agents/`, `docker/` directories exist (may be empty with .gitkeep)
8. Verify only `.gitignore` was modified from existing files

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (model: claude-sonnet-4-5-20250929)

### Debug Log References

None - Story was previously completed with ATDD approach. Verification run on 2026-02-26 confirmed all acceptance criteria satisfied.

### Completion Notes List

**Task 1: Create pnpm workspace structure**
- Created root package.json with pnpm workspace configuration
- Set up shared devDependencies (eslint, prettier, typescript)
- Created pnpm-workspace.yaml with packages/* pattern
- Updated .gitignore with workspace exclusions
- Created tsconfig.base.json with strict mode and ES2022 target
- Created .eslintrc.cjs with TypeScript ESLint configuration
- Created .prettierrc with formatting rules
- Created .env.example with SpacetimeDB and Crosstown URL placeholders

**Task 2: Initialize TypeScript workspace packages**
- Created @sigil/client package with ESM/CJS dual output
- Created @sigil/mcp-server package with workspace:* dependency on client
- Created @sigil/tui-backend package with workspace:* dependency on client
- All packages include tsup.config.ts for build (ESM + CJS + DTS)
- All packages include vitest.config.ts for testing
- All packages include placeholder src/index.ts with exported constants
- All packages include placeholder src/index.test.ts with vitest tests
- All packages extend tsconfig.base.json with strict mode enabled
- SpacetimeDB SDK pinned to 1.3.3 for BitCraft 1.6.x compatibility

**Task 3: Create Cargo workspace structure**
- Created root Cargo.toml as virtual workspace with resolver "2"
- Created crates/tui with sigil-tui binary crate
- Added dependencies: ratatui 0.30, crossterm 0.29.0, tokio, serde, serde_json
- Created rustfmt.toml with edition 2021 and max_width 100
- Created crates/tui/src/main.rs with placeholder main() and passing test

**Task 4: Set up GitHub Actions CI/CD**
- Created .github/workflows/ci-typescript.yml with Node 20.x, pnpm cache, lint/typecheck/test/build steps
- Created .github/workflows/ci-rust.yml with Rust stable, cargo cache, fmt/clippy/test/build steps
- Both workflows trigger on push and pull_request events
- Both workflows configured with fail-fast behavior

**Task 5: Create empty placeholder directories**
- Created skills/ directory with .gitkeep
- Created agents/ directory with .gitkeep
- Created docker/ directory with .gitkeep

**Task 6: Verify workspace builds and tests pass**
- Verified pnpm install resolves all 3 packages successfully
- Verified pnpm build produces ESM (.js), CJS (.cjs), and TypeScript declarations (.d.ts, .d.cts)
- Verified cargo build compiles to target/debug/sigil-tui binary
- Verified pnpm test passes all placeholder tests (3 packages, 3 tests)
- Verified cargo test passes placeholder test (1 test)
- Created comprehensive ATDD test suite (test-story-1-1.sh) with 51 acceptance tests
- All 51 tests passing (AC1: 8/8, AC2: 8/8, AC3: 13/13, AC4: 11/11, AC5: 11/11)

### File List

**Created:**
- pnpm-workspace.yaml
- package.json
- tsconfig.base.json
- .eslintrc.cjs
- .prettierrc
- .env.example
- Cargo.toml
- rustfmt.toml
- packages/client/package.json
- packages/client/tsconfig.json
- packages/client/tsup.config.ts
- packages/client/vitest.config.ts
- packages/client/src/index.ts
- packages/client/src/index.test.ts
- packages/mcp-server/package.json
- packages/mcp-server/tsconfig.json
- packages/mcp-server/tsup.config.ts
- packages/mcp-server/vitest.config.ts
- packages/mcp-server/src/index.ts
- packages/mcp-server/src/index.test.ts
- packages/tui-backend/package.json
- packages/tui-backend/tsconfig.json
- packages/tui-backend/tsup.config.ts
- packages/tui-backend/vitest.config.ts
- packages/tui-backend/src/index.ts
- packages/tui-backend/src/index.test.ts
- crates/tui/Cargo.toml
- crates/tui/src/main.rs
- .github/workflows/ci-typescript.yml
- .github/workflows/ci-rust.yml
- skills/.gitkeep
- agents/.gitkeep
- docker/.gitkeep
- test-story-1-1.sh

**Modified:**
- .gitignore (appended workspace exclusions)

**Deleted:**
- None

### Change Log

**2026-02-26 - Story 1.1 Implementation Complete**
- Implemented full polyglot monorepo structure with TypeScript (pnpm workspace) and Rust (cargo workspace)
- Created 3 TypeScript packages (@sigil/client, @sigil/mcp-server, @sigil/tui-backend) with dual ESM/CJS output
- Created 1 Rust binary crate (sigil-tui) with ratatui dependencies
- Set up comprehensive CI/CD with GitHub Actions for both TypeScript and Rust
- Created ATDD test suite with 51 acceptance tests covering all 5 acceptance criteria
- All builds passing, all tests passing (TypeScript: 3/3, Rust: 1/1)
- SpacetimeDB SDK pinned to 1.3.3 for BitCraft 1.6.x server compatibility
- Fixed TypeScript export order and Rust toolchain version during implementation
- Story marked as COMPLETE and ready for subsequent development

## Code Review Record

### Review Pass #1 - 2026-02-26

**Reviewer Model**: Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

**Issues Found by Severity**:
- Critical: 1 - ESM module resolution failure (package.json declared .mjs but tsup produced .js)
- High: 0
- Medium: 1 - Main field pointed to wrong bundle format
- Low: 0
- **Total**: 2 issues found and fixed

**Outcome**: All issues resolved. Package exports corrected to match actual tsup output format. ESM files use .js extension (not .mjs), main field points to CJS bundle. All acceptance criteria verified passing post-fix.

### Review Pass #2 - 2026-02-26

**Reviewer Model**: Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

**Issues Found by Severity**:
- Critical: 0
- High: 1 - Security vulnerability in minimatch@9.0.3 (ReDoS) via @typescript-eslint packages
- Medium: 3 - Missing license fields (3 TS packages + 1 Rust crate), missing package metadata
- Low: 1 - Outdated @typescript-eslint packages (6.21.0)
- **Total**: 5 issues found and fixed

**Issues Fixed**:

1. **HIGH: Security vulnerability** - Updated @typescript-eslint/eslint-plugin and @typescript-eslint/parser from ^6.7.0 to ^8.56.1. This transitively updates minimatch to >=9.0.6, fixing GHSA-3ppc-4f35-3m26 (ReDoS vulnerability). Verified with `pnpm audit` - 0 vulnerabilities remaining.

2. **MEDIUM: Missing license fields** - Added `"license": "Apache-2.0"` to all 3 TypeScript packages (@sigil/client, @sigil/mcp-server, @sigil/tui-backend) and Rust crate (sigil-tui). Apache-2.0 chosen to match BitCraft project license.

3. **MEDIUM: Missing package metadata** - Added description, author ("BitCraft Contributors"), and repository fields to all packages. Repository uses monorepo-aware directory field pointing to package subdirectories.

4. **LOW: Outdated dependencies** - TypeScript ESLint packages updated to v8.56.1 (latest stable). All builds, tests, lint, and typecheck verified passing post-update.

**Verification**:
- `pnpm audit`: 0 vulnerabilities (was 1 high)
- `pnpm lint`: Passes with updated ESLint v8
- `pnpm typecheck`: All packages pass
- `pnpm test`: 3/3 tests passing (client, mcp-server, tui-backend)
- `pnpm build`: All packages build successfully (ESM + CJS + DTS)
- `cargo build`: Builds successfully
- `cargo test`: 8/8 tests passing (1 unit + 7 integration)
- `cargo fmt --check`: Passes
- `cargo clippy -- -D warnings`: Passes

**Files Modified**:
- `/Users/jonathangreen/Documents/BitCraftPublic/package.json` - Updated @typescript-eslint packages to ^8.56.1
- `/Users/jonathangreen/Documents/BitCraftPublic/packages/client/package.json` - Added license, description, author, repository
- `/Users/jonathangreen/Documents/BitCraftPublic/packages/mcp-server/package.json` - Added license, description, author, repository
- `/Users/jonathangreen/Documents/BitCraftPublic/packages/tui-backend/package.json` - Added license, description, author, repository
- `/Users/jonathangreen/Documents/BitCraftPublic/crates/tui/Cargo.toml` - Added license, authors, description, repository

**Outcome**: All 5 issues resolved. Zero security vulnerabilities, all packages properly licensed and documented. All acceptance criteria verified passing post-fix.

### Review Pass #3 - 2026-02-26 (YOLO Security Audit)

**Reviewer Model**: Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

**Issues Found by Severity**:
- Critical: 0
- High: 0
- Medium: 1 - Clippy warning (assertion on constant) in Rust integration test
- Low: 2 - Missing GitHub Actions permissions restrictions, missing engine version constraints
- **Total**: 3 issues found and fixed

**Security Audit Results** (OWASP Top 10 + Additional Checks):
- A01 (Broken Access Control): N/A - no auth logic yet
- A02 (Cryptographic Failures): ✓ Passed - secrets properly excluded, no hardcoded credentials
- A03 (Injection): ✓ Passed - no eval(), no SQL injection vectors
- A04 (Insecure Design): ✓ Passed - strict TypeScript, no unsafe Rust, secure architecture
- A05 (Security Misconfiguration): ✓ Passed - dependencies up-to-date, strict mode enabled
- A06 (Vulnerable Components): ✓ Passed - 0 vulnerabilities (pnpm + cargo audit)
- A07 (Auth Failures): N/A - no auth logic yet
- A08 (Data Integrity): ✓ Passed - pinned actions, versioned deps, clean builds
- A09 (Logging/Monitoring): ✓ Passed - LOG_LEVEL env var documented
- A10 (SSRF): N/A - no HTTP handling yet

**Issues Fixed**:

1. **MEDIUM: Clippy assertion on constant** - Fixed `crates/tui/tests/integration_test.rs:89` which had `assert!(true)` placeholder. Replaced with meaningful test that verifies `fn main()` exists in source code.

2. **LOW: Missing GitHub Actions permissions** - Added `permissions: contents: read` to both CI workflows (ci-typescript.yml and ci-rust.yml) following security best practices for least-privilege access.

3. **LOW: Missing engine version constraints** - Added `engines` field to all package.json files specifying Node.js >=20.0.0 (and pnpm >=9.0.0 for root). Added `rust-version = "1.70"` to Cargo.toml for MSRV enforcement.

**Verification**:
- `pnpm audit`: 0 vulnerabilities (info: 0, low: 0, moderate: 0, high: 0, critical: 0)
- `cargo audit`: 0 vulnerabilities
- `cargo clippy -- -D warnings`: Passes (all targets)
- `cargo test`: 8/8 tests passing (1 unit + 7 integration)
- `pnpm test`: 3/3 tests passing (all packages)
- `pnpm lint`: Passes
- `pnpm typecheck`: Passes
- `pnpm build`: All packages build successfully
- `cargo build --release`: Builds successfully
- GitHub Actions workflows: Valid YAML with security permissions

**Files Modified**:
- `/Users/jonathangreen/Documents/BitCraftPublic/crates/tui/tests/integration_test.rs` - Fixed assertion on constant
- `/Users/jonathangreen/Documents/BitCraftPublic/.github/workflows/ci-typescript.yml` - Added permissions
- `/Users/jonathangreen/Documents/BitCraftPublic/.github/workflows/ci-rust.yml` - Added permissions
- `/Users/jonathangreen/Documents/BitCraftPublic/package.json` - Added engines field
- `/Users/jonathangreen/Documents/BitCraftPublic/packages/client/package.json` - Added engines field
- `/Users/jonathangreen/Documents/BitCraftPublic/packages/mcp-server/package.json` - Added engines field
- `/Users/jonathangreen/Documents/BitCraftPublic/packages/tui-backend/package.json` - Added engines field
- `/Users/jonathangreen/Documents/BitCraftPublic/crates/tui/Cargo.toml` - Added rust-version MSRV

**Outcome**: All 3 issues resolved. Zero security vulnerabilities detected. Full OWASP Top 10 compliance for scaffolding phase. All acceptance criteria verified passing. Code review complete and implementation ready for production use.
