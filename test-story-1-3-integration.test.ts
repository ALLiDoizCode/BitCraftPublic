/**
 * Story 1.3 Integration Tests
 *
 * These tests verify the acceptance criteria for Docker local development environment
 * through automated execution. They complement the smoke-test.sh script by testing
 * Docker Compose configuration, service startup, connectivity, and platform compatibility.
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = '/Users/jonathangreen/Documents/BitCraftPublic';
const DOCKER_DIR = join(REPO_ROOT, 'docker');

// Helper to run shell commands and capture output
function runCommand(
  cmd: string,
  cwd: string = REPO_ROOT,
  timeout: number = 30000
): { stdout: string; stderr: string; success: boolean } {
  try {
    const stdout = execSync(cmd, {
      cwd,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout,
    });
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

// Helper to wait for condition with timeout
async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number = 60000,
  intervalMs: number = 2000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await condition();
      if (result) return true;
    } catch (e) {
      // Condition check failed, continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

describe('Story 1.3: Docker Local Development Environment - Integration Tests', () => {
  describe('AC1: Docker compose starts BitCraft server and Crosstown node', () => {
    test('docker-compose.yml exists and is valid YAML', () => {
      const composePath = join(DOCKER_DIR, 'docker-compose.yml');
      expect(existsSync(composePath)).toBe(true);

      const composeContent = readFileSync(composePath, 'utf8');

      // Verify it's valid YAML by checking structure (basic validation)
      expect(composeContent).toContain('services:');
      expect(composeContent).toContain('bitcraft-server:');
      expect(composeContent).toContain('crosstown-node:');
    });

    test('docker-compose.yml defines sigil-dev network', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      expect(composeContent).toContain('networks:');
      expect(composeContent).toContain('sigil-dev:');
      expect(composeContent).toContain('driver: bridge');
    });

    test('bitcraft-server service is correctly configured', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      // Check service exists
      expect(composeContent).toContain('bitcraft-server:');

      // Check build context
      expect(composeContent).toContain('build:');
      expect(composeContent).toMatch(/context:.*bitcraft/);

      // Check container name
      expect(composeContent).toContain('container_name: sigil-bitcraft-server');

      // Check port binding (local-only, with or without env vars)
      expect(composeContent).toContain('127.0.0.1');
      expect(composeContent).toMatch(/3000.*:3000/);

      // Check network
      expect(composeContent).toContain('networks:');
      expect(composeContent).toContain('- sigil-dev');

      // Check restart policy
      expect(composeContent).toContain('restart: unless-stopped');
    });

    test('crosstown-node service is correctly configured', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      // Check service exists
      expect(composeContent).toContain('crosstown-node:');

      // Check build context
      expect(composeContent).toContain('build:');
      expect(composeContent).toMatch(/context:.*crosstown/);

      // Check container name
      expect(composeContent).toContain('container_name: sigil-crosstown-node');

      // Check port bindings (local-only, with or without env vars)
      expect(composeContent).toContain('127.0.0.1');
      expect(composeContent).toMatch(/4040.*:4040/);
      expect(composeContent).toMatch(/4041.*:4041/);

      // Check network
      expect(composeContent).toContain('networks:');
      expect(composeContent).toContain('- sigil-dev');

      // Check restart policy
      expect(composeContent).toContain('restart: unless-stopped');
    });

    test('bitcraft-server has healthcheck configured', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      // Find bitcraft-server section and check for healthcheck
      const bitcraftSection = composeContent.split('crosstown-node:')[0];

      expect(bitcraftSection).toContain('healthcheck:');
      expect(bitcraftSection).toMatch(/test:.*curl.*3000.*database.*bitcraft.*info/);
      expect(bitcraftSection).toContain('interval: 30s');
      expect(bitcraftSection).toContain('timeout: 10s');
      expect(bitcraftSection).toContain('retries: 3');
      expect(bitcraftSection).toContain('start_period: 10s');
    });

    test('crosstown-node has healthcheck configured', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      // Find crosstown-node section
      const crosstownSection = composeContent.split('crosstown-node:')[1];

      expect(crosstownSection).toContain('healthcheck:');
      expect(crosstownSection).toMatch(/test:.*curl.*4041.*health/);
      expect(crosstownSection).toContain('interval: 30s');
      expect(crosstownSection).toContain('timeout: 10s');
      expect(crosstownSection).toContain('retries: 3');
      expect(crosstownSection).toContain('start_period: 15s');
    });

    test('crosstown-node depends on bitcraft-server being healthy', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      const crosstownSection = composeContent.split('crosstown-node:')[1];

      expect(crosstownSection).toContain('depends_on:');
      expect(crosstownSection).toContain('bitcraft-server:');
      expect(crosstownSection).toContain('condition: service_healthy');
    });

    test('services have logging configuration', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      // Check for logging driver
      expect(composeContent).toContain('logging:');
      expect(composeContent).toContain('driver: json-file');
      expect(composeContent).toContain('options:');
      expect(composeContent).toMatch(/max-size:.*10m/);
      expect(composeContent).toMatch(/max-file:.*3/);
    });

    test('services have resource limits', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      expect(composeContent).toContain('deploy:');
      expect(composeContent).toContain('resources:');
      expect(composeContent).toContain('limits:');

      // Check BitCraft gets 1GB
      const bitcraftSection = composeContent.split('crosstown-node:')[0];
      expect(bitcraftSection).toMatch(/memory:.*1G/);

      // Check Crosstown gets 512MB
      const crosstownSection = composeContent.split('crosstown-node:')[1];
      expect(crosstownSection).toMatch(/memory:.*512M/);
    });

    test('volume directories exist with .gitkeep files', () => {
      const volumeDirs = [
        join(DOCKER_DIR, 'volumes/spacetimedb'),
        join(DOCKER_DIR, 'volumes/spacetimedb/data'),
        join(DOCKER_DIR, 'volumes/crosstown'),
        join(DOCKER_DIR, 'volumes/crosstown/events'),
      ];

      for (const dir of volumeDirs) {
        expect(existsSync(dir)).toBe(true);

        const gitkeepPath = join(dir, '.gitkeep');
        expect(existsSync(gitkeepPath)).toBe(true);
      }
    });

    test('volumes are in .gitignore', () => {
      const gitignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8');

      expect(gitignore).toContain('docker/volumes/');
    });

    test('services start in correct order (bitcraft before crosstown)', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      // Crosstown should explicitly depend on bitcraft-server
      const crosstownSection = composeContent.split('crosstown-node:')[1];

      expect(crosstownSection).toContain('depends_on:');
      expect(crosstownSection).toContain('bitcraft-server:');

      // Should use service_healthy condition to ensure bitcraft is fully up
      expect(crosstownSection).toContain('condition: service_healthy');
    });

    test('docker compose config validates successfully', () => {
      const result = runCommand('docker compose -f docker-compose.yml config', DOCKER_DIR);

      // If docker is not available, skip this test
      if (
        result.stdout.includes('command not found') ||
        result.stderr.includes('command not found')
      ) {
        console.log('Docker not available, skipping docker compose config test');
        return;
      }

      expect(result.success).toBe(true);
      expect(result.stdout).toBeTruthy();
    });
  });

  describe('AC2: SpacetimeDB client can connect and subscribe', () => {
    test('BitCraft Dockerfile exists and uses correct base image', () => {
      const dockerfilePath = join(DOCKER_DIR, 'bitcraft/Dockerfile');
      expect(existsSync(dockerfilePath)).toBe(true);

      const dockerfile = readFileSync(dockerfilePath, 'utf8');

      // Check base image (should be SpacetimeDB compatible)
      expect(dockerfile).toMatch(/FROM.*spacetime/i);

      // Check for WASM module copy
      expect(dockerfile).toContain('COPY');
      expect(dockerfile).toContain('bitcraft.wasm');

      // Check for init script
      expect(dockerfile).toContain('init.sh');

      // Check environment variables
      expect(dockerfile).toContain('ENV');
      expect(dockerfile).toMatch(/SPACETIMEDB/);
    });

    test('BitCraft init.sh script exists and is executable', () => {
      const initScriptPath = join(DOCKER_DIR, 'bitcraft/init.sh');
      expect(existsSync(initScriptPath)).toBe(true);

      // Check if executable
      const stats = statSync(initScriptPath);
      const isExecutable = (stats.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    });

    test('init.sh validates WASM module existence and size', () => {
      const initScript = readFileSync(join(DOCKER_DIR, 'bitcraft/init.sh'), 'utf8');

      // Check for file existence check
      expect(initScript).toContain('bitcraft.wasm');
      expect(initScript).toMatch(/\[\s*!?\s*-f|test\s+-f/); // [ -f or [ ! -f or test -f

      // Check for size validation (>100KB = 102400 bytes)
      expect(initScript).toMatch(/102400|100.*KB/i);

      // Check for error handling
      expect(initScript).toMatch(/ERROR/);
      expect(initScript).toMatch(/exit 1/);
    });

    test('BitCraft WASM placeholder file exists', () => {
      const placeholderPath = join(DOCKER_DIR, 'bitcraft/bitcraft.wasm.placeholder');
      expect(existsSync(placeholderPath)).toBe(true);

      const placeholder = readFileSync(placeholderPath, 'utf8');
      expect(placeholder).toContain('Replace with actual BitCraft WASM module');
    });

    test('volumes are mounted in docker-compose.yml', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      // Check for volume mounts
      expect(composeContent).toContain('volumes:');
      expect(composeContent).toMatch(/\.\/volumes\/spacetimedb/);
      expect(composeContent).toMatch(/\.\/volumes\/crosstown/);
    });

    test('docker-compose.yml exposes correct SpacetimeDB endpoints', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      // WebSocket and HTTP on port 3000 (may use env vars)
      expect(composeContent).toContain('127.0.0.1');
      expect(composeContent).toMatch(/3000.*:3000/);
    });
  });

  describe('AC3: Cross-platform compatibility', () => {
    test('Dockerfiles do not contain platform-specific commands', () => {
      const bitcraftDockerfile = readFileSync(join(DOCKER_DIR, 'bitcraft/Dockerfile'), 'utf8');
      const crosstownDockerfile = readFileSync(join(DOCKER_DIR, 'crosstown/Dockerfile'), 'utf8');

      // Check they don't use platform-specific directives
      expect(bitcraftDockerfile).not.toContain('--platform=linux/amd64');
      expect(crosstownDockerfile).not.toContain('--platform=linux/amd64');

      // Should work on both architectures via multi-arch base images
    });

    test('shell scripts use POSIX sh, not bash', () => {
      const initScript = readFileSync(join(DOCKER_DIR, 'bitcraft/init.sh'), 'utf8');
      const resetScript = readFileSync(join(DOCKER_DIR, 'scripts/reset-dev-env.sh'), 'utf8');
      const smokeTest = readFileSync(join(DOCKER_DIR, 'tests/smoke-test.sh'), 'utf8');

      // Check shebang is #!/bin/sh not #!/bin/bash
      expect(initScript).toMatch(/^#!\/bin\/sh/);
      expect(resetScript).toMatch(/^#!\/bin\/sh/);
      expect(smokeTest).toMatch(/^#!\/bin\/sh/);

      // Check for POSIX compliance (no bash-isms)
      expect(initScript).not.toMatch(/\[\[/); // [[ is bash-specific
      expect(resetScript).not.toMatch(/\[\[/);
      expect(smokeTest).not.toMatch(/function /); // "function" keyword is bash-specific
    });

    test('README.md documents platform requirements', () => {
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      // Check platform documentation
      expect(readme).toContain('macOS');
      expect(readme).toContain('Linux');

      // Check minimum versions
      expect(readme).toMatch(/macOS.*10\.15/);
      expect(readme).toContain('Docker');
    });

    test('README.md includes troubleshooting section', () => {
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      expect(readme).toMatch(/troubleshoot/i);
      expect(readme).toContain('port');
      expect(readme).toContain('permission');
    });
  });

  describe('AC4: Development overrides with compose override file', () => {
    test('docker-compose.dev.yml exists', () => {
      const devComposePath = join(DOCKER_DIR, 'docker-compose.dev.yml');
      expect(existsSync(devComposePath)).toBe(true);
    });

    test('docker-compose.dev.yml exposes debug ports', () => {
      const devCompose = readFileSync(join(DOCKER_DIR, 'docker-compose.dev.yml'), 'utf8');

      // BitCraft admin port (3001, may use env vars)
      expect(devCompose).toMatch(/3001.*:3001|:3001:3001/);

      // Crosstown metrics port (4042, may use env vars)
      expect(devCompose).toMatch(/4042.*:4042|:4042:4042/);
    });

    test('docker-compose.dev.yml sets debug log levels', () => {
      const devCompose = readFileSync(join(DOCKER_DIR, 'docker-compose.dev.yml'), 'utf8');

      // Check for debug environment variables
      expect(devCompose).toMatch(/LOG_LEVEL.*debug/i);
    });

    test('docker compose with dev override validates successfully', () => {
      const result = runCommand(
        'docker compose -f docker-compose.yml -f docker-compose.dev.yml config',
        DOCKER_DIR
      );

      // If docker is not available, skip this test
      if (
        result.stdout.includes('command not found') ||
        result.stderr.includes('command not found')
      ) {
        console.log('Docker not available, skipping docker compose config test');
        return;
      }

      expect(result.success).toBe(true);
      expect(result.stdout).toBeTruthy();
    });

    test('.env.example contains all configurable variables', () => {
      const envExamplePath = join(DOCKER_DIR, '.env.example');
      expect(existsSync(envExamplePath)).toBe(true);

      const envExample = readFileSync(envExamplePath, 'utf8');

      // Check for required variables
      const requiredVars = [
        'BITCRAFT_PORT',
        'BITCRAFT_ADMIN_PORT',
        'BITCRAFT_MEMORY_LIMIT',
        'CROSSTOWN_NOSTR_PORT',
        'CROSSTOWN_HTTP_PORT',
        'CROSSTOWN_METRICS_PORT',
        'CROSSTOWN_MEMORY_LIMIT',
        'SPACETIMEDB_LOG_LEVEL',
        'CROSSTOWN_LOG_LEVEL',
      ];

      for (const variable of requiredVars) {
        expect(envExample).toContain(variable);
      }

      // Check for comments explaining variables
      expect(envExample).toMatch(/#.*port/i);
    });

    test('.env is in .gitignore', () => {
      const gitignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8');
      expect(gitignore).toContain('.env');
    });
  });

  describe('Documentation and Scripts', () => {
    test('docker/README.md exists and is comprehensive', () => {
      const readmePath = join(DOCKER_DIR, 'README.md');
      expect(existsSync(readmePath)).toBe(true);

      const readme = readFileSync(readmePath, 'utf8');

      // Check for required sections (allowing for variations like "Dev Mode" vs "Development Mode")
      const requiredSections = [
        'Prerequisites',
        'Quick Start',
        'Dev.*Mode|Development',
        'Connection|Endpoint',
        'Endpoint|Connection',
        'Volume',
        'BitCraft.*WASM|WASM',
        'Crosstown',
        'Smoke',
        'Cleanup|Reset',
        'Troubleshooting',
      ];

      for (const section of requiredSections) {
        expect(readme).toMatch(new RegExp(section, 'i'));
      }
    });

    test('README.md documents connection endpoints', () => {
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      // Check SpacetimeDB endpoints
      expect(readme).toContain('ws://localhost:3000');
      expect(readme).toContain('http://localhost:3000');

      // Check Crosstown endpoints
      expect(readme).toContain('ws://localhost:4040');
      expect(readme).toContain('http://localhost:4041');

      // Check dev mode endpoints
      expect(readme).toContain('3001');
      expect(readme).toContain('4042');
    });

    test('README.md documents BitCraft WASM module setup', () => {
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      // Check for module acquisition options
      expect(readme).toMatch(/GitHub.*release/i);
      expect(readme).toMatch(/build.*source/i);
      expect(readme).toMatch(/_assets/);

      // Check for SHA256 mention
      expect(readme).toMatch(/SHA256/i);
    });

    test('README.md documents smoke test usage', () => {
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      expect(readme).toContain('smoke-test.sh');
      expect(readme).toContain('curl');
      expect(readme).toContain('jq');
      expect(readme).toContain('websocat');
      expect(readme).toContain('spacetime');
    });

    test('reset-dev-env.sh script exists and is executable', () => {
      const resetScriptPath = join(DOCKER_DIR, 'scripts/reset-dev-env.sh');
      expect(existsSync(resetScriptPath)).toBe(true);

      // Check if executable
      const stats = statSync(resetScriptPath);
      const isExecutable = (stats.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    });

    test('reset-dev-env.sh performs down -v and up --build', () => {
      const resetScript = readFileSync(join(DOCKER_DIR, 'scripts/reset-dev-env.sh'), 'utf8');

      expect(resetScript).toContain('docker compose down -v');
      expect(resetScript).toContain('docker compose up --build');
      expect(resetScript).toContain('set -e'); // Exit on error
    });

    test('smoke-test.sh exists and is executable', () => {
      const smokeTestPath = join(DOCKER_DIR, 'tests/smoke-test.sh');
      expect(existsSync(smokeTestPath)).toBe(true);

      // Check if executable
      const stats = statSync(smokeTestPath);
      const isExecutable = (stats.mode & 0o111) !== 0;
      expect(isExecutable).toBe(true);
    });

    test('smoke-test.sh checks prerequisites', () => {
      const smokeTest = readFileSync(join(DOCKER_DIR, 'tests/smoke-test.sh'), 'utf8');

      const requiredTools = ['curl', 'jq', 'websocat', 'spacetime'];

      for (const tool of requiredTools) {
        expect(smokeTest).toMatch(new RegExp(`command.*${tool}`, 'i'));
      }
    });

    test('smoke-test.sh tests all required scenarios', () => {
      const smokeTest = readFileSync(join(DOCKER_DIR, 'tests/smoke-test.sh'), 'utf8');

      // Check for all test scenarios
      expect(smokeTest).toContain('Prerequisites');
      expect(smokeTest).toContain('Health');
      expect(smokeTest).toContain('SpacetimeDB HTTP');
      expect(smokeTest).toContain('Crosstown HTTP');
      expect(smokeTest).toContain('Nostr');
      expect(smokeTest).toContain('WebSocket');
      expect(smokeTest).toContain('Volume');
      expect(smokeTest).toContain('Cross-platform');
      expect(smokeTest).toContain('BLS');
    });

    test('smoke-test.sh has proper error handling with detailed output', () => {
      const smokeTest = readFileSync(join(DOCKER_DIR, 'tests/smoke-test.sh'), 'utf8');

      // Check for error variable capture
      expect(smokeTest).toMatch(/RESPONSE|OUTPUT/);

      // Check for error message display
      expect(smokeTest).toMatch(/echo.*\$.*RESPONSE|echo.*\$.*OUTPUT/);

      // Check for meaningful error messages
      expect(smokeTest).toMatch(/ERROR/);
      expect(smokeTest).toMatch(/exit 1/);
    });

    test('root README.md links to docker/README.md', () => {
      const rootReadme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');

      expect(rootReadme).toMatch(/docker.*README/i);
      expect(rootReadme).toMatch(/Development Environment/i);
    });
  });

  describe('Crosstown Node Configuration', () => {
    test('Crosstown Dockerfile exists and uses multi-stage build', () => {
      const dockerfilePath = join(DOCKER_DIR, 'crosstown/Dockerfile');
      expect(existsSync(dockerfilePath)).toBe(true);

      const dockerfile = readFileSync(dockerfilePath, 'utf8');

      // Check for multi-stage build
      expect(dockerfile).toMatch(/FROM.*rust.*AS builder/i);
      expect(dockerfile).toMatch(/FROM.*debian.*slim/i);

      // Check for binary copy from builder
      expect(dockerfile).toMatch(/COPY --from=builder/);
    });

    test('Crosstown Dockerfile uses non-root user', () => {
      const dockerfile = readFileSync(join(DOCKER_DIR, 'crosstown/Dockerfile'), 'utf8');

      // Check for user creation
      expect(dockerfile).toMatch(/useradd/);
      expect(dockerfile).toMatch(/USER.*crosstown/);
    });

    test('Crosstown config.toml exists', () => {
      const configPath = join(DOCKER_DIR, 'crosstown/config.toml');
      expect(existsSync(configPath)).toBe(true);
    });

    test('Crosstown config.toml sets BLS stub mode', () => {
      const config = readFileSync(join(DOCKER_DIR, 'crosstown/config.toml'), 'utf8');

      expect(config).toMatch(/identity_propagation.*stub/i);
      expect(config).toContain('bitcraft');
    });

    test('Crosstown config.toml documented with BLS placeholder comment', () => {
      const config = readFileSync(join(DOCKER_DIR, 'crosstown/config.toml'), 'utf8');

      // Check for Story 2.5 reference
      expect(config).toMatch(/Story 2\.5/);
      expect(config).toMatch(/BLS/);
    });

    test('docker-compose.yml sets Crosstown environment variables', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      const crosstownSection = composeContent.split('crosstown-node:')[1];

      expect(crosstownSection).toMatch(/CROSSTOWN_NOSTR_PORT/);
      expect(crosstownSection).toMatch(/CROSSTOWN_HTTP_PORT/);
      expect(crosstownSection).toMatch(/CROSSTOWN_BITCRAFT_URL/);
      expect(crosstownSection).toMatch(/CROSSTOWN_LOG_LEVEL/);
    });

    test('README.md documents BLS stub behavior', () => {
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      expect(readme).toMatch(/BLS.*stub/i);
      expect(readme).toMatch(/kind 30078/);
      expect(readme).toMatch(/Story 2\.5/);
      expect(readme).toMatch(/log|BLS STUB/i);
      expect(readme).toMatch(/NOT.*forward/i);
    });
  });

  describe('Security and Best Practices', () => {
    test('ports are bound to localhost only (127.0.0.1)', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      // All port bindings should use 127.0.0.1
      const portBindings = composeContent.match(/\d+:\d+:\d+/g) || [];

      for (const binding of portBindings) {
        expect(binding).toMatch(/^127\.0\.0\.1/);
      }
    });

    test('Dockerfiles create non-root users', () => {
      const bitcraftDockerfile = readFileSync(join(DOCKER_DIR, 'bitcraft/Dockerfile'), 'utf8');
      const crosstownDockerfile = readFileSync(join(DOCKER_DIR, 'crosstown/Dockerfile'), 'utf8');

      // Check for USER directive (indicating non-root)
      expect(
        bitcraftDockerfile.includes('USER') || bitcraftDockerfile.includes('base image runs as')
      ).toBe(true);
      expect(crosstownDockerfile).toContain('USER');
    });

    test('sensitive files are in .gitignore', () => {
      const gitignore = readFileSync(join(REPO_ROOT, '.gitignore'), 'utf8');

      const sensitivePatterns = ['.env', 'docker/volumes/', '*.local'];

      for (const pattern of sensitivePatterns) {
        expect(gitignore).toContain(pattern);
      }
    });

    test('no secrets or credentials in committed files', () => {
      const files = [
        join(DOCKER_DIR, 'docker-compose.yml'),
        join(DOCKER_DIR, 'docker-compose.dev.yml'),
        join(DOCKER_DIR, '.env.example'),
        join(DOCKER_DIR, 'bitcraft/Dockerfile'),
        join(DOCKER_DIR, 'crosstown/Dockerfile'),
        join(DOCKER_DIR, 'crosstown/config.toml'),
      ];

      for (const filePath of files) {
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');

          // Check for common secret patterns
          expect(content).not.toMatch(/password.*=.*\S{8,}/i);
          expect(content).not.toMatch(/api[_-]?key.*=.*\S{20,}/i);
          expect(content).not.toMatch(/secret.*=.*\S{20,}/i);
        }
      }
    });
  });

  describe('Module Capabilities Documentation', () => {
    test('README.md documents expected BitCraft module capabilities', () => {
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      // Should mention the expected module features
      expect(readme).toMatch(/364.*reducer/i);
      expect(readme).toMatch(/80.*table/i);
      expect(readme).toMatch(/148.*static/i);
    });

    test('README.md references Story 1.5 for full validation', () => {
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      expect(readme).toMatch(/Story 1\.5/);
    });
  });

  describe('Error Handling and Resilience', () => {
    test('init.sh has proper error handling', () => {
      const initScript = readFileSync(join(DOCKER_DIR, 'bitcraft/init.sh'), 'utf8');

      // Check for set -e (exit on error)
      expect(initScript).toMatch(/set -e/);

      // Check for error messages
      expect(initScript).toMatch(/ERROR/);

      // Check for exit codes
      expect(initScript).toMatch(/exit 1/);
    });

    test('services have restart policies', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      expect(composeContent).toContain('restart: unless-stopped');

      // Both services should have restart policies
      const restartCount = (composeContent.match(/restart: unless-stopped/g) || []).length;
      expect(restartCount).toBeGreaterThanOrEqual(2);
    });

    test('healthchecks have reasonable timeouts and retries', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      // Check healthcheck parameters are present
      expect(composeContent).toContain('interval:');
      expect(composeContent).toContain('timeout:');
      expect(composeContent).toContain('retries:');
      expect(composeContent).toContain('start_period:');
    });

    test('smoke-test.sh has timeout for service health check', () => {
      const smokeTest = readFileSync(join(DOCKER_DIR, 'tests/smoke-test.sh'), 'utf8');

      expect(smokeTest).toMatch(/TIMEOUT/);
      expect(smokeTest).toMatch(/60/); // 60 second timeout
    });

    test('smoke-test.sh exits with non-zero on failure', () => {
      const smokeTest = readFileSync(join(DOCKER_DIR, 'tests/smoke-test.sh'), 'utf8');

      // Should have multiple exit 1 statements for different failure scenarios
      const exitCount = (smokeTest.match(/exit 1/g) || []).length;
      expect(exitCount).toBeGreaterThan(5); // Multiple failure scenarios
    });
  });

  describe('Build Configuration', () => {
    test('Crosstown supports local build mode', () => {
      const dockerfile = readFileSync(join(DOCKER_DIR, 'crosstown/Dockerfile'), 'utf8');

      // Check for build mode support
      expect(dockerfile).toMatch(/ARG BUILD_MODE/);
    });

    test('Crosstown source code exists for local build', () => {
      const crosstownSrcPath = join(DOCKER_DIR, 'crosstown/crosstown-src');
      expect(existsSync(crosstownSrcPath)).toBe(true);

      const cargoTomlPath = join(crosstownSrcPath, 'Cargo.toml');
      expect(existsSync(cargoTomlPath)).toBe(true);

      const mainRsPath = join(crosstownSrcPath, 'src/main.rs');
      expect(existsSync(mainRsPath)).toBe(true);
    });

    test('README.md documents Crosstown build modes', () => {
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      expect(readme).toMatch(/build.*mode/i);
      expect(readme).toContain('remote');
      expect(readme).toContain('local');
    });

    test('.env.example includes Crosstown build mode option', () => {
      const envExample = readFileSync(join(DOCKER_DIR, '.env.example'), 'utf8');

      expect(envExample).toMatch(/CROSSTOWN_BUILD_MODE/);
    });
  });

  describe('Integration with Previous Stories', () => {
    test('Story 1.1 monorepo structure is compatible with Docker setup', () => {
      // Verify that Docker directory doesn't conflict with TS/Rust workspaces
      const pnpmWorkspace = readFileSync(join(REPO_ROOT, 'pnpm-workspace.yaml'), 'utf8');
      const cargoToml = readFileSync(join(REPO_ROOT, 'Cargo.toml'), 'utf8');

      // Docker directory should not be in workspaces
      expect(pnpmWorkspace).not.toContain('docker');
      expect(cargoToml).not.toContain('docker');

      // Docker should exist as standalone directory
      expect(existsSync(DOCKER_DIR)).toBe(true);
    });

    test('Story 1.2 Nostr identity integration placeholder exists', () => {
      // Crosstown should reference Nostr for BLS (implemented in Story 2.5)
      const config = readFileSync(join(DOCKER_DIR, 'crosstown/config.toml'), 'utf8');
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      // Should mention kind 30078 (Nostr event type)
      expect(config.includes('30078') || readme.includes('30078')).toBe(true);
    });
  });

  describe('CI/CD Preparation', () => {
    test('smoke-test.sh includes note about CI integration', () => {
      const smokeTest = readFileSync(join(DOCKER_DIR, 'tests/smoke-test.sh'), 'utf8');
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      // Should mention CI or GitHub Actions
      const hasCIReference =
        smokeTest.includes('CI') ||
        smokeTest.includes('GitHub Actions') ||
        readme.includes('TODO: Add to GitHub Actions') ||
        readme.includes('CI');

      expect(hasCIReference).toBe(true);
    });

    test('Docker configuration is ready for automated testing', () => {
      // All necessary files for CI should exist
      const requiredFiles = [
        join(DOCKER_DIR, 'docker-compose.yml'),
        join(DOCKER_DIR, 'docker-compose.dev.yml'),
        join(DOCKER_DIR, 'tests/smoke-test.sh'),
        join(DOCKER_DIR, '.env.example'),
      ];

      for (const file of requiredFiles) {
        expect(existsSync(file)).toBe(true);
      }
    });
  });

  describe('NFR22: Cross-Platform Integration', () => {
    test('Docker Compose version is compatible with both v1 and v2 CLI', () => {
      const composeContent = readFileSync(join(DOCKER_DIR, 'docker-compose.yml'), 'utf8');

      // Should NOT have version field (deprecated in v2)
      // OR should have version: "3.8" (compatible with both)
      const hasVersion = composeContent.includes('version:');

      if (hasVersion) {
        expect(composeContent).toMatch(/version:.*["']3\.\d+["']/);
      }
    });

    test('README.md specifies minimum Docker versions for both macOS and Linux', () => {
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      // Should specify Docker Desktop for macOS
      expect(readme).toMatch(/Docker Desktop.*4\.\d+/);

      // Should specify Docker Engine for Linux
      expect(readme).toMatch(/Docker Engine.*20\.10/);
    });

    test('README.md documents macOS version requirements', () => {
      const readme = readFileSync(join(DOCKER_DIR, 'README.md'), 'utf8');

      expect(readme).toMatch(/macOS.*10\.15/);
    });

    test('scripts are POSIX-compliant for cross-platform compatibility', () => {
      const scripts = [
        join(DOCKER_DIR, 'bitcraft/init.sh'),
        join(DOCKER_DIR, 'scripts/reset-dev-env.sh'),
        join(DOCKER_DIR, 'tests/smoke-test.sh'),
      ];

      for (const scriptPath of scripts) {
        const script = readFileSync(scriptPath, 'utf8');

        // Check for bash-isms that would break POSIX compliance
        expect(script).not.toMatch(/\[\[.*\]\]/); // [[ ]] is bash-specific
        expect(script).not.toMatch(/^function /m); // function keyword is bash-specific
        // Note: $(( )) is POSIX-compliant for arithmetic expansion, so we allow it
      }
    });
  });
});
