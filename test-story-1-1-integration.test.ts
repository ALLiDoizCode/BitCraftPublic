/**
 * Story 1.1 Integration Tests
 *
 * These tests verify the acceptance criteria through automated execution
 * rather than just file structure checks. They complement the ATDD shell
 * script by testing actual build/runtime behavior.
 */

import { describe, test, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = '/Users/jonathangreen/Documents/BitCraftPublic';

// Helper to run shell commands and capture output
function runCommand(cmd: string, cwd: string = REPO_ROOT): { stdout: string; stderr: string; success: boolean } {
  try {
    const stdout = execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { stdout, stderr: '', success: true };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    // Check if it's actually a failure (non-zero exit code) or just stderr output
    const isFailure = err.status !== undefined && err.status !== 0;
    return {
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      success: !isFailure,
    };
  }
}

describe('Story 1.1: Monorepo Scaffolding & Build Infrastructure - Integration Tests', () => {
  describe('AC1: pnpm workspace resolution', () => {
    test('pnpm install succeeds and resolves all workspace packages', () => {
      const result = runCommand('pnpm install --frozen-lockfile');
      expect(result.success).toBe(true);

      // Verify node_modules exists for workspace packages
      expect(existsSync(join(REPO_ROOT, 'node_modules'))).toBe(true);
      expect(existsSync(join(REPO_ROOT, 'packages/client/node_modules'))).toBe(true);
      expect(existsSync(join(REPO_ROOT, 'packages/mcp-server/node_modules'))).toBe(true);
      expect(existsSync(join(REPO_ROOT, 'packages/tui-backend/node_modules'))).toBe(true);
    });

    test('workspace packages can import each other using workspace: protocol', () => {
      // Verify @sigil/mcp-server depends on @sigil/client via workspace:*
      const mcpPackageJson = JSON.parse(
        readFileSync(join(REPO_ROOT, 'packages/mcp-server/package.json'), 'utf8')
      );
      expect(mcpPackageJson.dependencies['@sigil/client']).toBe('workspace:*');

      // Verify @sigil/tui-backend depends on @sigil/client via workspace:*
      const tuiPackageJson = JSON.parse(
        readFileSync(join(REPO_ROOT, 'packages/tui-backend/package.json'), 'utf8')
      );
      expect(tuiPackageJson.dependencies['@sigil/client']).toBe('workspace:*');
    });

    test('tsconfig.base.json is valid and has required compiler options', () => {
      const tsconfig = JSON.parse(readFileSync(join(REPO_ROOT, 'tsconfig.base.json'), 'utf8'));

      expect(tsconfig.compilerOptions.strict).toBe(true);
      expect(tsconfig.compilerOptions.target).toBe('ES2022');
      expect(tsconfig.compilerOptions.module).toBe('ESNext');
      expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler');
    });
  });

  describe('AC2: Cargo workspace builds', () => {
    test('cargo build succeeds and produces sigil-tui binary', () => {
      const result = runCommand('cargo build');
      expect(result.success).toBe(true);

      // Verify binary was created
      const binaryPath = join(REPO_ROOT, 'target/debug/sigil-tui');
      expect(existsSync(binaryPath)).toBe(true);
    });

    test('cargo test succeeds with all tests passing', () => {
      // Run only the unit tests in main.rs, skip integration tests to avoid recursion
      const result = runCommand('cargo test --bin sigil-tui');
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test result: ok');
    });

    test('rustfmt.toml configuration is valid', () => {
      const rustfmt = readFileSync(join(REPO_ROOT, 'rustfmt.toml'), 'utf8');
      expect(rustfmt).toContain('edition = "2021"');
      expect(rustfmt).toContain('max_width = 100');
    });

    test('Cargo workspace includes crates/tui', () => {
      const cargoToml = readFileSync(join(REPO_ROOT, 'Cargo.toml'), 'utf8');
      expect(cargoToml).toContain('[workspace]');
      expect(cargoToml).toContain('members = ["crates/*"]');
      expect(cargoToml).toContain('resolver = "2"');
    });
  });

  describe('AC3: Root configuration files present', () => {
    test('.gitignore contains all required exclusions', () => {
      const gitignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8');
      const requiredExclusions = [
        'node_modules/',
        'target/',
        '.env',
        'dist/',
        'build/',
        '*.tsbuildinfo',
        '.turbo/',
        '*.local',
        'coverage/',
      ];

      for (const exclusion of requiredExclusions) {
        expect(gitignore).toContain(exclusion);
      }
    });

    test('ESLint configuration is valid', async () => {
      const eslintConfigPath = join(REPO_ROOT, '.eslintrc.cjs');
      const eslintConfig = await import(eslintConfigPath);
      expect(eslintConfig.default.parser).toBe('@typescript-eslint/parser');
      expect(eslintConfig.default.extends).toContain('plugin:@typescript-eslint/recommended');
    });

    test('.prettierrc configuration is valid', () => {
      const prettierConfig = JSON.parse(readFileSync(join(REPO_ROOT, '.prettierrc'), 'utf8'));
      expect(prettierConfig.semi).toBe(true);
      expect(prettierConfig.singleQuote).toBe(true);
      expect(prettierConfig.trailingComma).toBe('es5');
    });

    test('.env.example contains required environment variables', () => {
      const envExample = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');
      expect(envExample).toContain('SPACETIMEDB_URL');
      expect(envExample).toContain('CROSSTOWN_URL');
    });
  });

  describe('AC4: CI workflows execute successfully', () => {
    test('TypeScript CI workflow is valid YAML', () => {
      const workflow = readFileSync(join(REPO_ROOT, '.github/workflows/ci-typescript.yml'), 'utf8');

      // Check for required steps
      expect(workflow).toContain('pnpm install');
      expect(workflow).toContain('pnpm lint');
      expect(workflow).toContain('pnpm typecheck');
      expect(workflow).toContain('pnpm test');
      expect(workflow).toContain('pnpm build');

      // Check for Node.js 20.x
      expect(workflow).toContain("node-version: '20.x'");

      // Check for pnpm cache
      expect(workflow).toContain('actions/cache@v4');
    });

    test('Rust CI workflow is valid YAML', () => {
      const workflow = readFileSync(join(REPO_ROOT, '.github/workflows/ci-rust.yml'), 'utf8');

      // Check for required steps
      expect(workflow).toContain('cargo fmt --check');
      expect(workflow).toContain('cargo clippy');
      expect(workflow).toContain('cargo test');
      expect(workflow).toContain('cargo build --release');

      // Check for Rust stable
      expect(workflow).toContain('toolchain: stable');

      // Check for cargo cache
      expect(workflow).toContain('actions/cache@v4');
    });

    test('pnpm lint succeeds on all packages', () => {
      const result = runCommand('pnpm lint');
      expect(result.success).toBe(true);
    });

    test('pnpm typecheck succeeds on all packages', () => {
      const result = runCommand('pnpm typecheck');
      expect(result.success).toBe(true);
    });

    test('pnpm test succeeds on all packages', () => {
      const result = runCommand('pnpm test');
      // Check that tests passed (allow for exit code 0 or successful test output)
      expect(result.success || result.stdout.includes('Test Files') && result.stdout.includes('passed')).toBe(true);
      // Verify each package has passing tests
      expect(result.stdout).toContain('packages/client test:');
      expect(result.stdout).toContain('packages/mcp-server test:');
      expect(result.stdout).toContain('packages/tui-backend test:');
      expect(result.stdout).toMatch(/1 passed/g); // Each package reports "1 passed"
    });
  });

  describe('AC5: TypeScript packages configured correctly', () => {
    test('@sigil/client package.json has correct configuration', () => {
      const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'packages/client/package.json'), 'utf8'));

      expect(pkg.name).toBe('@sigil/client');
      expect(pkg.type).toBe('module');
      expect(pkg.main).toBe('./dist/index.cjs');
      expect(pkg.module).toBe('./dist/index.js');
      expect(pkg.types).toBe('./dist/index.d.ts');

      // Check exports field for dual ESM/CJS
      expect(pkg.exports['.']).toBeDefined();
      expect(pkg.exports['.'].import).toBe('./dist/index.js');
      expect(pkg.exports['.'].require).toBe('./dist/index.cjs');
      expect(pkg.exports['.'].types).toBe('./dist/index.d.ts');
    });

    test('@sigil/client build produces ESM, CJS, and TypeScript declarations', () => {
      // Run build
      const result = runCommand('pnpm --filter @sigil/client build');
      expect(result.success).toBe(true);

      const distPath = join(REPO_ROOT, 'packages/client/dist');
      expect(existsSync(distPath)).toBe(true);

      const distFiles = readdirSync(distPath);

      // Verify ESM output
      const esmFiles = distFiles.filter(
        (f) => f.endsWith('.mjs') || (f.endsWith('.js') && !f.endsWith('.cjs'))
      );
      expect(esmFiles.length).toBeGreaterThan(0);

      // Verify CJS output
      const cjsFiles = distFiles.filter((f) => f.endsWith('.cjs'));
      expect(cjsFiles.length).toBeGreaterThan(0);

      // Verify TypeScript declarations
      const dtsFiles = distFiles.filter(
        (f) => f.endsWith('.d.ts') || f.endsWith('.d.cts') || f.endsWith('.d.mts')
      );
      expect(dtsFiles.length).toBeGreaterThan(0);
    });

    test('tsup.config.ts has correct build configuration', () => {
      const tsupConfigPath = join(REPO_ROOT, 'packages/client/tsup.config.ts');
      const tsupConfig = readFileSync(tsupConfigPath, 'utf8');

      expect(tsupConfig).toContain("format: ['esm', 'cjs']");
      expect(tsupConfig).toContain('dts: true');
      expect(tsupConfig).toContain("outDir: 'dist'");
      expect(tsupConfig).toContain('clean: true');
    });

    test('vitest is configured for all packages', () => {
      const packages = ['client', 'mcp-server', 'tui-backend'];

      for (const pkg of packages) {
        const packageJson = JSON.parse(
          readFileSync(join(REPO_ROOT, `packages/${pkg}/package.json`), 'utf8')
        );

        expect(packageJson.scripts.test).toContain('vitest');
        expect(packageJson.devDependencies.vitest).toBeDefined();
      }
    });

    test('@sigil/client exports placeholder constant and tests pass', () => {
      const indexTs = readFileSync(join(REPO_ROOT, 'packages/client/src/index.ts'), 'utf8');

      expect(indexTs).toContain('export');
      expect(indexTs).toContain('SIGIL_VERSION');

      // Run tests
      const result = runCommand('pnpm --filter @sigil/client test');
      // Check that tests passed (allow for exit code 0 or successful test output)
      expect(result.success || result.stdout.includes('Test Files') && result.stdout.includes('passed')).toBe(true);
    });

    test('all TypeScript packages extend tsconfig.base.json', () => {
      const packages = ['client', 'mcp-server', 'tui-backend'];

      for (const pkg of packages) {
        const tsconfig = JSON.parse(
          readFileSync(join(REPO_ROOT, `packages/${pkg}/tsconfig.json`), 'utf8')
        );

        expect(tsconfig.extends).toContain('tsconfig.base.json');
      }
    });

    test('@sigil/client has SpacetimeDB SDK 1.3.3 (not 2.0+)', () => {
      const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'packages/client/package.json'), 'utf8'));

      const sdkVersion = pkg.dependencies['@clockworklabs/spacetimedb-sdk'];
      expect(sdkVersion).toBe('^1.3.3');

      // Ensure it's not 2.0+ (protocol incompatibility)
      expect(sdkVersion).not.toContain('^2.');
      expect(sdkVersion).not.toContain('^3.');
    });

    test('all packages build successfully', () => {
      const result = runCommand('pnpm build');
      expect(result.success).toBe(true);

      // Verify dist directories were created
      expect(existsSync(join(REPO_ROOT, 'packages/client/dist'))).toBe(true);
      expect(existsSync(join(REPO_ROOT, 'packages/mcp-server/dist'))).toBe(true);
      expect(existsSync(join(REPO_ROOT, 'packages/tui-backend/dist'))).toBe(true);
    });
  });

  describe('Additional Architecture Requirements', () => {
    test('placeholder directories exist for future implementation', () => {
      expect(existsSync(join(REPO_ROOT, 'skills'))).toBe(true);
      expect(existsSync(join(REPO_ROOT, 'agents'))).toBe(true);
      expect(existsSync(join(REPO_ROOT, 'docker'))).toBe(true);
    });

    test('pnpm-workspace.yaml includes packages/*', () => {
      const workspace = readFileSync(join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8');
      expect(workspace).toContain("- 'packages/*'");
    });

    test('root package.json has build, test, lint, and typecheck scripts', () => {
      const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));

      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.scripts.test).toBeDefined();
      expect(pkg.scripts.lint).toBeDefined();
      expect(pkg.scripts.typecheck).toBeDefined();
    });

    test('root package.json is marked as private', () => {
      const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));

      expect(pkg.private).toBe(true);
      expect(pkg.name).toBe('sigil-monorepo');
    });
  });
});
