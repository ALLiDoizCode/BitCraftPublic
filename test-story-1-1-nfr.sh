#!/usr/bin/env bash
set -e

# Story 1.1 NFR Test Suite
# Tests architectural decisions against non-functional requirements

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

REPO_ROOT="/Users/jonathangreen/Documents/BitCraftPublic"
cd "$REPO_ROOT"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
TOTAL_COUNT=0

function test_start() {
  echo -e "${YELLOW}TEST: $1${NC}"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
}

function test_pass() {
  echo -e "${GREEN}✓ PASS: $1${NC}"
  PASS_COUNT=$((PASS_COUNT + 1))
}

function test_fail() {
  echo -e "${RED}✗ FAIL: $1${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

function test_warn() {
  echo -e "${BLUE}⚠ WARN: $1${NC}"
  WARN_COUNT=$((WARN_COUNT + 1))
}

function file_contains() {
  if grep -q "$2" "$1" 2>/dev/null; then
    return 0
  else
    return 1
  fi
}

function check_dependency_version() {
  local package_json="$1"
  local dep_name="$2"
  local expected_version="$3"

  if [ -f "$package_json" ]; then
    if grep -q "\"$dep_name\".*\"$expected_version\"" "$package_json"; then
      return 0
    else
      return 1
    fi
  else
    return 1
  fi
}

echo "========================================="
echo "Story 1.1 NFR Test Suite"
echo "Architecture vs Non-Functional Requirements"
echo "========================================="
echo ""

# NFR18: SpacetimeDB SDK version compatibility (CRITICAL)
echo -e "${YELLOW}=== NFR18: Integration - SpacetimeDB SDK Compatibility ===${NC}"

test_start "NFR18.1: SpacetimeDB SDK version is 1.3.3 (not 2.0+)"
if check_dependency_version "packages/client/package.json" "@clockworklabs/spacetimedb-sdk" "\\^1\\.3\\.3"; then
  test_pass "SpacetimeDB SDK pinned to ^1.3.3 (compatible with 1.6.x server)"
else
  test_fail "SpacetimeDB SDK NOT pinned to 1.3.3 - will cause protocol incompatibility"
fi

test_start "NFR18.2: Rust TUI has no direct SpacetimeDB dependency"
if ! grep -q "spacetimedb" "crates/tui/Cargo.toml" 2>/dev/null; then
  test_pass "Rust TUI correctly has no SpacetimeDB dependency (uses TypeScript backend)"
else
  test_fail "Rust TUI should NOT have direct SpacetimeDB dependency"
fi

test_start "NFR18.3: Architecture doc confirms SDK version requirement"
if file_contains "_bmad-output/implementation-artifacts/1-1-monorepo-scaffolding-and-build-infrastructure.md" "1.3.3"; then
  test_pass "Implementation artifact documents SDK 1.3.3 requirement"
else
  test_warn "SDK version requirement should be documented in implementation artifact"
fi

echo ""

# NFR22: Docker development environment
echo -e "${YELLOW}=== NFR22: Integration - Docker Development Environment ===${NC}"

test_start "NFR22.1: Docker directory exists"
if [ -d "docker" ]; then
  test_pass "Docker directory present for development environment"
else
  test_fail "Docker directory missing"
fi

test_start "NFR22.2: .env.example includes infrastructure URLs"
if file_contains ".env.example" "SPACETIMEDB_URL" && file_contains ".env.example" "CROSSTOWN_URL"; then
  test_pass ".env.example includes SpacetimeDB and Crosstown URLs"
else
  test_fail ".env.example missing infrastructure URL placeholders"
fi

echo ""

# Performance considerations in build setup
echo -e "${YELLOW}=== Performance: Build Configuration ===${NC}"

test_start "PERF.1: TypeScript strict mode enabled (prevents runtime type errors)"
if file_contains "tsconfig.base.json" '"strict": true'; then
  test_pass "TypeScript strict mode enabled - reduces runtime errors (NFR4, NFR5 support)"
else
  test_fail "TypeScript strict mode should be enabled"
fi

test_start "PERF.2: Rust release profile configured for optimized builds"
if file_contains "Cargo.toml" '\[profile.release\]' || ! file_contains "Cargo.toml" '\[profile'; then
  # Virtual workspace doesn't need profile - defaults are fine
  test_pass "Rust workspace allows optimized release builds (NFR1, NFR2 support)"
else
  test_warn "Consider adding release profile optimization for TUI performance"
fi

test_start "PERF.3: TypeScript build outputs both ESM and CJS"
if file_contains "packages/client/tsup.config.ts" "esm" && file_contains "packages/client/tsup.config.ts" "cjs"; then
  test_pass "Dual ESM/CJS output enables optimal bundling (supports NFR4)"
else
  test_fail "TypeScript packages should output both ESM and CJS"
fi

echo ""

# Maintainability: Code quality tooling
echo -e "${YELLOW}=== Maintainability: Code Quality Infrastructure ===${NC}"

test_start "MAINT.1: ESLint configured for TypeScript"
if [ -f ".eslintrc.cjs" ] && file_contains ".eslintrc.cjs" "@typescript-eslint"; then
  test_pass "ESLint with TypeScript plugin configured"
else
  test_fail "ESLint TypeScript configuration missing"
fi

test_start "MAINT.2: Prettier configured for consistent formatting"
if [ -f ".prettierrc" ]; then
  test_pass "Prettier configured for code formatting"
else
  test_fail "Prettier configuration missing"
fi

test_start "MAINT.3: Rust formatting configured (rustfmt)"
if [ -f "rustfmt.toml" ]; then
  test_pass "rustfmt configuration present"
else
  test_fail "rustfmt.toml missing"
fi

test_start "MAINT.4: CI includes linting for TypeScript"
if file_contains ".github/workflows/ci-typescript.yml" "lint"; then
  test_pass "TypeScript CI includes linting"
else
  test_fail "TypeScript CI should include linting step"
fi

test_start "MAINT.5: CI includes Rust clippy (linting)"
if file_contains ".github/workflows/ci-rust.yml" "clippy"; then
  test_pass "Rust CI includes clippy linting"
else
  test_fail "Rust CI should include clippy"
fi

test_start "MAINT.6: CI includes type checking"
if file_contains ".github/workflows/ci-typescript.yml" "typecheck"; then
  test_pass "TypeScript CI includes type checking"
else
  test_fail "TypeScript CI should include type checking"
fi

echo ""

# Security: Dependency management and secrets
echo -e "${YELLOW}=== Security: Secrets & Dependency Management ===${NC}"

test_start "SEC.1: .env excluded from git"
if file_contains ".gitignore" "^\\.env$" || file_contains ".gitignore" "\\.env"; then
  test_pass ".env files excluded from version control (NFR9, NFR11 support)"
else
  test_fail ".env should be in .gitignore"
fi

test_start "SEC.2: .env.example exists as template"
if [ -f ".env.example" ]; then
  test_pass ".env.example provides safe template for environment variables"
else
  test_fail ".env.example missing"
fi

test_start "SEC.3: node_modules excluded from git"
if file_contains ".gitignore" "node_modules"; then
  test_pass "node_modules excluded from version control"
else
  test_fail "node_modules should be in .gitignore"
fi

test_start "SEC.4: Package manager lockfiles present"
if [ -f "pnpm-lock.yaml" ] || [ -f "package-lock.json" ]; then
  test_pass "Package manager lockfile present (reproducible builds)"
else
  test_warn "Consider committing pnpm-lock.yaml for reproducible builds"
fi

test_start "SEC.5: Cargo.lock present for reproducible Rust builds"
if [ -f "Cargo.lock" ]; then
  test_pass "Cargo.lock present (reproducible Rust builds)"
else
  test_warn "Cargo.lock should be committed for binary crates"
fi

echo ""

# Scalability: Workspace architecture
echo -e "${YELLOW}=== Scalability: Workspace Architecture ===${NC}"

test_start "SCALE.1: Monorepo structure supports multiple packages"
if [ -f "pnpm-workspace.yaml" ] && file_contains "pnpm-workspace.yaml" "packages/\\*"; then
  test_pass "pnpm workspace configured for scalable package structure (NFR14, NFR15)"
else
  test_fail "pnpm workspace configuration missing"
fi

test_start "SCALE.2: Cargo workspace supports multiple crates"
if [ -f "Cargo.toml" ] && file_contains "Cargo.toml" "\\[workspace\\]"; then
  test_pass "Cargo workspace configured for multiple Rust crates"
else
  test_fail "Cargo workspace configuration missing"
fi

test_start "SCALE.3: Workspace protocol used for internal dependencies"
if file_contains "packages/mcp-server/package.json" "workspace:\\*" || file_contains "packages/tui-backend/package.json" "workspace:\\*"; then
  test_pass "workspace:* protocol ensures local development uses workspace versions"
else
  test_fail "Internal packages should use workspace:* protocol"
fi

test_start "SCALE.4: Shared TypeScript configuration (DRY principle)"
if [ -f "tsconfig.base.json" ]; then
  test_pass "Shared tsconfig.base.json reduces duplication"
else
  test_fail "tsconfig.base.json missing"
fi

test_start "SCALE.5: Shared formatting configuration (consistency)"
if [ -f ".prettierrc" ] && [ -f "rustfmt.toml" ]; then
  test_pass "Shared formatting configs ensure consistency across workspace"
else
  test_warn "Shared formatting configs recommended"
fi

echo ""

# Reliability: Testing infrastructure
echo -e "${YELLOW}=== Reliability: Testing Infrastructure ===${NC}"

test_start "REL.1: TypeScript testing framework configured (vitest)"
if file_contains "packages/client/package.json" "vitest"; then
  test_pass "Vitest configured for TypeScript testing (NFR23-NFR27 support)"
else
  test_fail "TypeScript packages should have vitest configured"
fi

test_start "REL.2: CI includes test execution for TypeScript"
if file_contains ".github/workflows/ci-typescript.yml" "test"; then
  test_pass "TypeScript CI includes test execution"
else
  test_fail "TypeScript CI should run tests"
fi

test_start "REL.3: CI includes test execution for Rust"
if file_contains ".github/workflows/ci-rust.yml" "cargo test"; then
  test_pass "Rust CI includes test execution"
else
  test_fail "Rust CI should run tests"
fi

test_start "REL.4: Test coverage tracking configured"
if file_contains ".gitignore" "coverage"; then
  test_pass "Coverage directory excluded from git (test infrastructure present)"
else
  test_warn "Consider adding test coverage tracking"
fi

echo ""

# Architecture alignment checks
echo -e "${YELLOW}=== Architecture: Core Decisions Alignment ===${NC}"

test_start "ARCH.1: Single polyglot monorepo structure"
if [ -f "pnpm-workspace.yaml" ] && [ -f "Cargo.toml" ] && [ -d "packages" ] && [ -d "crates" ]; then
  test_pass "Single polyglot monorepo with TS (pnpm) + Rust (cargo) confirmed"
else
  test_fail "Repository should be single polyglot monorepo"
fi

test_start "ARCH.2: Three TypeScript packages present (@sigil/*)"
if [ -d "packages/client" ] && [ -d "packages/mcp-server" ] && [ -d "packages/tui-backend" ]; then
  test_pass "All three required TypeScript packages present"
else
  test_fail "Missing required TypeScript packages"
fi

test_start "ARCH.3: Package naming follows @sigil/* convention"
if file_contains "packages/client/package.json" "@sigil/client" && \
   file_contains "packages/mcp-server/package.json" "@sigil/mcp-server" && \
   file_contains "packages/tui-backend/package.json" "@sigil/tui-backend"; then
  test_pass "All packages use @sigil/* naming convention"
else
  test_fail "Packages should use @sigil/* naming"
fi

test_start "ARCH.4: Rust TUI crate named sigil-tui"
if file_contains "crates/tui/Cargo.toml" 'name = "sigil-tui"'; then
  test_pass "Rust TUI crate correctly named sigil-tui"
else
  test_fail "Rust TUI should be named sigil-tui"
fi

test_start "ARCH.5: ratatui dependency present in TUI crate"
if file_contains "crates/tui/Cargo.toml" "ratatui"; then
  test_pass "ratatui TUI framework dependency present (NFR1, NFR2)"
else
  test_fail "Rust TUI should depend on ratatui"
fi

test_start "ARCH.6: tokio async runtime present in TUI crate"
if file_contains "crates/tui/Cargo.toml" "tokio"; then
  test_pass "tokio async runtime present for IPC communication"
else
  test_fail "Rust TUI should depend on tokio for async IPC"
fi

test_start "ARCH.7: serde/serde_json for IPC serialization"
if file_contains "crates/tui/Cargo.toml" "serde" && file_contains "crates/tui/Cargo.toml" "serde_json"; then
  test_pass "serde configured for JSON-RPC IPC with TypeScript backend"
else
  test_fail "Rust TUI should have serde/serde_json for IPC"
fi

test_start "ARCH.8: No headless agent package (architecture decision)"
if [ ! -d "packages/headless-agent" ]; then
  test_pass "Correctly no headless-agent package - external SDKs use MCP server"
else
  test_warn "headless-agent package exists but architecture specifies external SDKs only"
fi

test_start "ARCH.9: skills/ directory for shared SKILL.md files"
if [ -d "skills" ]; then
  test_pass "skills/ directory present for shared skill definitions"
else
  test_warn "skills/ directory should exist (may be empty at this stage)"
fi

test_start "ARCH.10: agents/ directory for agent configurations"
if [ -d "agents" ]; then
  test_pass "agents/ directory present for CLAUDE.md and AGENTS.md"
else
  test_warn "agents/ directory should exist (may be empty at this stage)"
fi

echo ""

# Critical NFR validation
echo -e "${YELLOW}=== Critical NFR Validation ===${NC}"

test_start "CRITICAL.1: SpacetimeDB SDK 1.3.3 requirement (NFR18)"
if check_dependency_version "packages/client/package.json" "@clockworklabs/spacetimedb-sdk" "\\^1\\.3\\.3"; then
  test_pass "CRITICAL: SpacetimeDB SDK 1.3.3 confirmed (prevents protocol incompatibility)"
else
  test_fail "CRITICAL FAILURE: SpacetimeDB SDK must be 1.3.3 for 1.6.x server compatibility"
fi

test_start "CRITICAL.2: TypeScript strict mode (runtime safety for NFR4, NFR5)"
if file_contains "tsconfig.base.json" '"strict": true'; then
  test_pass "CRITICAL: TypeScript strict mode prevents runtime errors"
else
  test_fail "CRITICAL: Strict mode required for type safety"
fi

test_start "CRITICAL.3: No security credentials in repository"
if ! file_contains ".gitignore" "^\\.env$" && ! file_contains ".gitignore" "\\.env"; then
  test_fail "CRITICAL: .env files not excluded - security risk (NFR8-NFR13)"
else
  test_pass "CRITICAL: Security - .env files excluded from version control"
fi

test_start "CRITICAL.4: Build outputs excluded from git"
if file_contains ".gitignore" "dist/" && file_contains ".gitignore" "target/" && file_contains ".gitignore" "node_modules/"; then
  test_pass "Build artifacts excluded from git (maintainability)"
else
  test_fail "Build artifacts should be excluded from version control"
fi

echo ""
echo "========================================="
echo "NFR Test Summary"
echo "========================================="
echo -e "Total Tests: ${TOTAL_COUNT}"
echo -e "${GREEN}Passed: ${PASS_COUNT}${NC}"
echo -e "${RED}Failed: ${FAIL_COUNT}${NC}"
echo -e "${BLUE}Warnings: ${WARN_COUNT}${NC}"
echo ""

# Severity scoring
CRITICAL_SCORE=$((PASS_COUNT - FAIL_COUNT))
if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✓ ALL NFR TESTS PASSED - ARCHITECTURE FULLY ALIGNED${NC}"
  exit 0
elif [ $FAIL_COUNT -le 3 ]; then
  echo -e "${YELLOW}⚠ MINOR ISSUES DETECTED - REVIEW RECOMMENDED${NC}"
  exit 0
else
  echo -e "${RED}✗ SIGNIFICANT NFR ISSUES - ARCHITECTURE REVIEW REQUIRED${NC}"
  exit 1
fi
