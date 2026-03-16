/**
 * Docker Stack Health Check Utility
 * Story 5.4: Basic Action Round-Trip Validation (AC6)
 *
 * Checks health of all 3 Docker services:
 * - bitcraft-server (SpacetimeDB) on port 3000
 * - crosstown-node on port 4041
 * - bitcraft-bls on port 3001
 *
 * Used by Stories 5.4-5.8 to conditionally skip integration tests
 * when Docker stack is not available.
 *
 * @integration
 */

/** Health check result for a single service */
export interface ServiceHealthResult {
  service: string;
  url: string;
  healthy: boolean;
  responseTimeMs: number;
  error?: string;
}

/** Aggregated health check result for entire Docker stack */
export interface DockerStackHealthResult {
  allHealthy: boolean;
  services: ServiceHealthResult[];
  totalCheckTimeMs: number;
}

/** Default health check endpoints for Docker services */
const DOCKER_SERVICES = [
  {
    service: 'bitcraft-server',
    url: process.env.SPACETIMEDB_HEALTH_URL || 'http://localhost:3000/database/bitcraft/info',
  },
  {
    service: 'crosstown-node',
    url: process.env.CROSSTOWN_HEALTH_URL || 'http://localhost:4041/health',
  },
  {
    service: 'bitcraft-bls',
    url: process.env.BLS_HEALTH_URL || 'http://localhost:3001/health',
  },
] as const;

/** Default timeout for individual health checks (ms) */
const HEALTH_CHECK_TIMEOUT_MS = 5000;

/**
 * Check health of a single Docker service
 *
 * @param service - Service name (for logging)
 * @param url - Health check endpoint URL
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns ServiceHealthResult
 */
export async function checkServiceHealth(
  service: string,
  url: string,
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS
): Promise<ServiceHealthResult> {
  const start = performance.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });

    const responseTimeMs = performance.now() - start;

    return {
      service,
      url,
      healthy: response.ok,
      responseTimeMs,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    const responseTimeMs = performance.now() - start;
    const errorMessage =
      error instanceof Error
        ? error.name === 'TimeoutError'
          ? `Timeout after ${timeoutMs}ms`
          : error.message
        : 'Unknown error';

    return {
      service,
      url,
      healthy: false,
      responseTimeMs,
      error: errorMessage,
    };
  }
}

/**
 * Check health of entire Docker stack (all 3 services)
 *
 * Checks all services in parallel for speed.
 *
 * @param timeoutMs - Timeout per service in milliseconds (default: 5000)
 * @returns DockerStackHealthResult with individual service results
 */
export async function checkDockerStackHealth(
  timeoutMs: number = HEALTH_CHECK_TIMEOUT_MS
): Promise<DockerStackHealthResult> {
  const start = performance.now();

  const results = await Promise.all(
    DOCKER_SERVICES.map((svc) => checkServiceHealth(svc.service, svc.url, timeoutMs))
  );

  const totalCheckTimeMs = performance.now() - start;

  return {
    allHealthy: results.every((r) => r.healthy),
    services: results,
    totalCheckTimeMs,
  };
}

/**
 * Simple boolean check: is the Docker stack healthy?
 *
 * Convenience wrapper for conditional test execution.
 *
 * @returns true if all 3 Docker services respond OK
 */
export async function isDockerStackHealthy(): Promise<boolean> {
  const result = await checkDockerStackHealth();
  return result.allHealthy;
}

/**
 * Log Docker stack health status to console
 *
 * Useful for debugging when tests are skipped.
 *
 * @param result - DockerStackHealthResult from checkDockerStackHealth()
 */
export function logDockerStackHealth(result: DockerStackHealthResult): void {
  if (result.allHealthy) {
    const checkTimeStr = result.totalCheckTimeMs.toFixed(0);
    const servicesStr = result.services
      .map((s) => `${s.service}=${s.responseTimeMs.toFixed(0)}ms`)
      .join(', ');
    console.log('Docker stack healthy (%sms): %s', checkTimeStr, servicesStr);
  } else {
    console.warn('Docker stack NOT healthy:');
    for (const svc of result.services) {
      const status = svc.healthy ? 'OK' : `FAILED: ${svc.error}`;
      console.warn(`  ${svc.service}: ${status} (${svc.responseTimeMs.toFixed(0)}ms)`);
    }
    console.warn('To start Docker stack: docker compose -f docker/docker-compose.yml up -d');
  }
}
