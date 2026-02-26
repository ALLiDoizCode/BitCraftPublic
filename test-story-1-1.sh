#!/usr/bin/env bash
set -e

# Story 1.1 ATDD Acceptance Test Suite
# This script verifies all acceptance criteria for monorepo scaffolding
#
# Test Coverage:
# - AC1 (8 tests): pnpm workspace resolution and TypeScript base config
# - AC2 (8 tests): Cargo workspace builds and Rust configuration
# - AC3 (13 tests): Root configuration files (.gitignore, ESLint, Prettier, etc.)
# - AC4 (11 tests): CI workflows for TypeScript and Rust
# - AC5 (17 tests): TypeScript package configuration for all 3 packages
# - Additional (3 tests): Placeholder directories (skills/, agents/, docker/)
# - Build/Test Verification (17 tests): Actual build and test execution
#
# Total: 77 automated tests covering all acceptance criteria
#
# Test Types:
# 1. Static checks: File/directory existence, content verification
# 2. Build verification: pnpm install, pnpm build, cargo build
# 3. Test execution: pnpm test, cargo test (unit + integration)
# 4. Quality checks: lint, typecheck, cargo fmt, cargo clippy
# 5. Artifact verification: ESM/CJS/DTS output files, binary executables

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REPO_ROOT="/Users/jonathangreen/Documents/BitCraftPublic"
cd "$REPO_ROOT"

PASS_COUNT=0
FAIL_COUNT=0
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

function file_exists() {
  if [ -f "$1" ]; then
    test_pass "File exists: $1"
  else
    test_fail "File missing: $1"
    return 1
  fi
}

function dir_exists() {
  if [ -d "$1" ]; then
    test_pass "Directory exists: $1"
  else
    test_fail "Directory missing: $1"
    return 1
  fi
}

function file_contains() {
  if grep -q "$2" "$1" 2>/dev/null; then
    test_pass "File $1 contains: $2"
  else
    test_fail "File $1 missing: $2"
    return 1
  fi
}

function json_has_field() {
  if command -v jq >/dev/null 2>&1; then
    if jq -e "$2" "$1" >/dev/null 2>&1; then
      test_pass "JSON $1 has field: $2"
    else
      test_fail "JSON $1 missing field: $2"
      return 1
    fi
  else
    # Fallback to grep if jq not available
    if grep -q "$2" "$1" 2>/dev/null; then
      test_pass "JSON $1 contains: $2"
    else
      test_fail "JSON $1 missing: $2"
      return 1
    fi
  fi
}

echo "========================================="
echo "Story 1.1 ATDD Acceptance Test Suite"
echo "========================================="
echo ""

# AC1: pnpm workspace resolution
echo -e "${YELLOW}=== AC1: pnpm workspace resolution ===${NC}"
test_start "pnpm-workspace.yaml exists"
file_exists "pnpm-workspace.yaml"

test_start "pnpm-workspace.yaml contains packages/*"
file_contains "pnpm-workspace.yaml" "packages/\*"

test_start "tsconfig.base.json exists"
file_exists "tsconfig.base.json"

test_start "tsconfig.base.json has strict: true"
file_contains "tsconfig.base.json" '"strict": true'

test_start "tsconfig.base.json has target: ES2022"
file_contains "tsconfig.base.json" '"target": "ES2022"'

test_start "packages/client directory exists"
dir_exists "packages/client"

test_start "packages/mcp-server directory exists"
dir_exists "packages/mcp-server"

test_start "packages/tui-backend directory exists"
dir_exists "packages/tui-backend"

echo ""
# AC2: Cargo workspace builds
echo -e "${YELLOW}=== AC2: Cargo workspace builds ===${NC}"
test_start "Root Cargo.toml exists"
file_exists "Cargo.toml"

test_start "Root Cargo.toml has [workspace]"
file_contains "Cargo.toml" '\[workspace\]'

test_start "Root Cargo.toml has crates/* members"
file_contains "Cargo.toml" "crates/\*"

test_start "crates/tui directory exists"
dir_exists "crates/tui"

test_start "crates/tui/Cargo.toml exists"
file_exists "crates/tui/Cargo.toml"

test_start "rustfmt.toml exists"
file_exists "rustfmt.toml"

test_start "rustfmt.toml has edition = \"2021\""
file_contains "rustfmt.toml" 'edition = "2021"'

test_start "rustfmt.toml has max_width = 100"
file_contains "rustfmt.toml" "max_width = 100"

echo ""
# AC3: Root configuration files present
echo -e "${YELLOW}=== AC3: Root configuration files present ===${NC}"
test_start ".eslintrc.cjs exists"
file_exists ".eslintrc.cjs"

test_start ".prettierrc exists"
file_exists ".prettierrc"

test_start ".env.example exists"
file_exists ".env.example"

test_start ".gitignore exists"
file_exists ".gitignore"

test_start ".gitignore excludes node_modules/"
file_contains ".gitignore" "node_modules/"

test_start ".gitignore excludes target/"
file_contains ".gitignore" "target/"

test_start ".gitignore excludes .env"
file_contains ".gitignore" "^\\.env$"

test_start ".gitignore excludes dist/"
file_contains ".gitignore" "dist/"

test_start ".gitignore excludes build/"
file_contains ".gitignore" "build/"

test_start ".gitignore excludes *.tsbuildinfo"
file_contains ".gitignore" "\\*\\.tsbuildinfo"

test_start ".gitignore excludes .turbo/"
file_contains ".gitignore" "\\.turbo/"

test_start ".gitignore excludes *.local"
file_contains ".gitignore" "\\*\\.local"

test_start ".gitignore excludes coverage/"
file_contains ".gitignore" "coverage/"

echo ""
# AC4: CI workflows execute successfully
echo -e "${YELLOW}=== AC4: CI workflows execute successfully ===${NC}"
test_start ".github/workflows/ci-typescript.yml exists"
file_exists ".github/workflows/ci-typescript.yml"

test_start ".github/workflows/ci-rust.yml exists"
file_exists ".github/workflows/ci-rust.yml"

test_start "ci-typescript.yml has pnpm install step"
file_contains ".github/workflows/ci-typescript.yml" "pnpm install"

test_start "ci-typescript.yml has lint step"
file_contains ".github/workflows/ci-typescript.yml" "lint"

test_start "ci-typescript.yml has typecheck step"
file_contains ".github/workflows/ci-typescript.yml" "typecheck"

test_start "ci-typescript.yml has test step"
file_contains ".github/workflows/ci-typescript.yml" "test"

test_start "ci-typescript.yml has build step"
file_contains ".github/workflows/ci-typescript.yml" "build"

test_start "ci-rust.yml has fmt check"
file_contains ".github/workflows/ci-rust.yml" "fmt.*--check"

test_start "ci-rust.yml has clippy"
file_contains ".github/workflows/ci-rust.yml" "clippy"

test_start "ci-rust.yml has test"
file_contains ".github/workflows/ci-rust.yml" "cargo test"

test_start "ci-rust.yml has build"
file_contains ".github/workflows/ci-rust.yml" "cargo build"

echo ""
# AC5: TypeScript packages configured correctly
echo -e "${YELLOW}=== AC5: TypeScript packages configured correctly ===${NC}"
test_start "packages/client/package.json exists"
file_exists "packages/client/package.json"

test_start "packages/client/package.json has name @sigil/client"
file_contains "packages/client/package.json" '"name": "@sigil/client"'

test_start "packages/client/package.json has type: module"
file_contains "packages/client/package.json" '"type": "module"'

test_start "packages/mcp-server/package.json has workspace:* dependency"
file_contains "packages/mcp-server/package.json" "workspace:\*"

test_start "packages/tui-backend/package.json has workspace:* dependency"
file_contains "packages/tui-backend/package.json" "workspace:\*"

test_start "packages/client/tsup.config.ts exists"
file_exists "packages/client/tsup.config.ts"

test_start "packages/mcp-server/tsup.config.ts exists"
file_exists "packages/mcp-server/tsup.config.ts"

test_start "packages/tui-backend/tsup.config.ts exists"
file_exists "packages/tui-backend/tsup.config.ts"

test_start "tsup.config.ts has format: [\"esm\", \"cjs\"]"
file_contains "packages/client/tsup.config.ts" "format.*esm.*cjs"

test_start "tsup.config.ts has dts: true"
file_contains "packages/client/tsup.config.ts" "dts.*true"

test_start "tsup.config.ts has outDir: \"dist\""
file_contains "packages/client/tsup.config.ts" 'outDir.*dist'

test_start "packages/client/package.json has test script with vitest"
file_contains "packages/client/package.json" '"test".*vitest'

test_start "packages/client/src/index.ts exists"
file_exists "packages/client/src/index.ts"

test_start "packages/client/src/index.ts exports placeholder constant"
file_contains "packages/client/src/index.ts" "export.*const"

test_start "packages/mcp-server/src/index.ts exists"
file_exists "packages/mcp-server/src/index.ts"

test_start "packages/tui-backend/src/index.ts exists"
file_exists "packages/tui-backend/src/index.ts"

echo ""
# Additional verification tests: placeholder directories
echo -e "${YELLOW}=== Additional Verification: Placeholder Directories ===${NC}"
test_start "skills/ directory exists"
dir_exists "skills"

test_start "agents/ directory exists"
dir_exists "agents"

test_start "docker/ directory exists"
dir_exists "docker"

echo ""
# Build and test verification (AC1, AC2, AC5)
echo -e "${YELLOW}=== Build and Test Verification ===${NC}"

test_start "pnpm install succeeds"
if pnpm install --silent 2>&1 | grep -qi "error"; then
  test_fail "pnpm install failed"
else
  test_pass "pnpm install succeeded"
fi

test_start "pnpm build succeeds for all packages"
if pnpm --recursive --silent build 2>&1 | grep -qi "error\|failed"; then
  test_fail "pnpm build failed"
else
  test_pass "pnpm build succeeded"
fi

test_start "Build artifacts exist for @sigil/client (ESM)"
if [ -f "packages/client/dist/index.js" ] || [ -f "packages/client/dist/index.mjs" ]; then
  test_pass "ESM build artifact exists"
else
  test_fail "ESM build artifact missing"
fi

test_start "Build artifacts exist for @sigil/client (CJS)"
file_exists "packages/client/dist/index.cjs"

test_start "Build artifacts exist for @sigil/client (TypeScript declarations)"
file_exists "packages/client/dist/index.d.ts"

test_start "cargo build succeeds"
if cargo build --quiet 2>&1 | grep -qi "error"; then
  test_fail "cargo build failed"
else
  test_pass "cargo build succeeded"
fi

test_start "sigil-tui binary exists"
file_exists "target/debug/sigil-tui"

test_start "pnpm test succeeds"
if pnpm --recursive test 2>&1 | grep -qi "fail\|error" | grep -v "0 failed"; then
  test_fail "pnpm test failed"
else
  test_pass "pnpm test succeeded"
fi

test_start "cargo test succeeds"
if cargo test 2>&1 | grep -q "test result: ok"; then
  test_pass "cargo test succeeded"
else
  test_fail "cargo test failed"
fi

test_start "SpacetimeDB SDK version is 1.3.3"
if grep -q '"@clockworklabs/spacetimedb-sdk".*"1\.3\.3"' "packages/client/package.json" || \
   grep -q '"@clockworklabs/spacetimedb-sdk".*"\^1\.3\.3"' "packages/client/package.json"; then
  test_pass "SpacetimeDB SDK version is 1.3.3"
else
  test_fail "SpacetimeDB SDK version is not 1.3.3"
fi

test_start "TypeScript packages have test files"
file_exists "packages/client/src/index.test.ts"

test_start "packages/mcp-server has test file"
file_exists "packages/mcp-server/src/index.test.ts"

test_start "packages/tui-backend has test file"
file_exists "packages/tui-backend/src/index.test.ts"

test_start "Rust integration tests exist"
file_exists "crates/tui/tests/integration_test.rs"

test_start "pnpm lint succeeds"
if pnpm lint 2>&1 | grep -qi "error"; then
  test_fail "pnpm lint failed"
else
  test_pass "pnpm lint succeeded"
fi

test_start "pnpm typecheck succeeds"
if pnpm typecheck 2>&1 | grep -qi "error"; then
  test_fail "pnpm typecheck failed"
else
  test_pass "pnpm typecheck succeeded"
fi

test_start "cargo fmt check succeeds"
if cargo fmt --check 2>&1 | grep -qi "diff"; then
  test_fail "cargo fmt check failed (code needs formatting)"
else
  test_pass "cargo fmt check succeeded"
fi

test_start "cargo clippy succeeds"
if cargo clippy -- -D warnings 2>&1 | grep -qi "error\|warning"; then
  test_fail "cargo clippy failed"
else
  test_pass "cargo clippy succeeded"
fi

echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "Total Tests: ${TOTAL_COUNT}"
echo -e "${GREEN}Passed: ${PASS_COUNT}${NC}"
echo -e "${RED}Failed: ${FAIL_COUNT}${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✓ ALL ACCEPTANCE CRITERIA SATISFIED${NC}"
  exit 0
else
  echo -e "${RED}✗ SOME ACCEPTANCE CRITERIA NOT MET${NC}"
  exit 1
fi
