/**
 * SpacetimeDB Latency Monitor
 *
 * Monitors real-time update latency from database commit to client event.
 * Implements NFR5 requirement: updates must arrive within 500ms.
 */

import { EventEmitter } from 'events';

/**
 * Latency statistics
 */
export interface LatencyStats {
  /** Average latency in milliseconds */
  avg: number;
  /** 50th percentile (median) latency */
  p50: number;
  /** 95th percentile latency */
  p95: number;
  /** 99th percentile latency */
  p99: number;
  /** Sample count */
  count: number;
}

/**
 * Update latency event
 */
export interface UpdateLatencyEvent {
  latency: number;
  timestamp: number;
  tableName?: string;
}

/**
 * Latency Monitor
 *
 * Tracks real-time update latency and exposes statistics.
 * Warns if latency exceeds 500ms threshold (NFR5).
 *
 * @example
 * ```typescript
 * const monitor = new LatencyMonitor();
 *
 * monitor.on('updateLatency', ({ latency }) => {
 *   console.log(`Update latency: ${latency}ms`);
 * });
 *
 * const stats = monitor.getStats();
 * console.log(`P95 latency: ${stats.p95}ms`);
 * ```
 */
export class LatencyMonitor extends EventEmitter {
  private measurements: number[] = [];
  private sortedCache: number[] | null = null; // Cache sorted array for efficiency
  private readonly maxMeasurements = 1000; // Rolling window size
  private readonly latencyThreshold = 500; // NFR5 requirement
  private warningsEnabled = true; // Can be disabled for testing

  /**
   * Record a latency measurement
   *
   * @param latency - Latency in milliseconds
   * @param tableName - Optional table name for context
   * @internal
   */
  recordLatency(latency: number, tableName?: string): void {
    // Add to measurements (rolling window)
    this.measurements.push(latency);
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements.shift(); // Remove oldest measurement
    }

    // Invalidate sorted cache when new data added
    this.sortedCache = null;

    // Emit event
    this.emit('updateLatency', {
      latency,
      timestamp: Date.now(),
      tableName,
    } as UpdateLatencyEvent);

    // Warn if latency exceeds threshold (only if warnings enabled)
    if (this.warningsEnabled && latency > this.latencyThreshold) {
      console.warn(
        `[Sigil] High latency detected: ${latency}ms exceeds ${this.latencyThreshold}ms threshold (NFR5)` +
          (tableName ? ` for table ${tableName}` : '')
      );
    }
  }

  /**
   * Get latency statistics
   *
   * @returns Latency stats including avg, p50, p95, p99
   *
   * @example
   * ```typescript
   * const stats = monitor.getStats();
   * console.log(`Average latency: ${stats.avg}ms`);
   * console.log(`P95 latency: ${stats.p95}ms`);
   * ```
   */
  getStats(): LatencyStats {
    if (this.measurements.length === 0) {
      return {
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        count: 0,
      };
    }

    // Use cached sorted array if available (performance optimization)
    if (!this.sortedCache) {
      this.sortedCache = [...this.measurements].sort((a, b) => a - b);
    }
    const sorted = this.sortedCache;
    const count = sorted.length;

    // Calculate average
    const avg = sorted.reduce((sum, val) => sum + val, 0) / count;

    // Calculate percentiles
    const p50 = this.percentile(sorted, 0.5);
    const p95 = this.percentile(sorted, 0.95);
    const p99 = this.percentile(sorted, 0.99);

    return {
      avg: Math.round(avg * 100) / 100, // Round to 2 decimal places
      p50: Math.round(p50 * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      p99: Math.round(p99 * 100) / 100,
      count,
    };
  }

  /**
   * Calculate percentile from sorted array using linear interpolation
   * @internal
   */
  private percentile(sortedValues: number[], percentile: number): number {
    const targetIndex = (sortedValues.length - 1) * percentile;
    const lowerIndex = Math.floor(targetIndex);
    const upperIndex = Math.ceil(targetIndex);
    const interpolationWeight = targetIndex % 1;

    if (lowerIndex === upperIndex) {
      return sortedValues[lowerIndex];
    }

    return (
      sortedValues[lowerIndex] * (1 - interpolationWeight) +
      sortedValues[upperIndex] * interpolationWeight
    );
  }

  /**
   * Clear all measurements
   * @internal
   */
  clear(): void {
    this.measurements = [];
    this.sortedCache = null;
  }

  /**
   * Get current measurement count
   */
  get measurementCount(): number {
    return this.measurements.length;
  }

  /**
   * Disable console warnings for high latency (useful for testing)
   * @internal
   */
  disableWarnings(): void {
    this.warningsEnabled = false;
  }

  /**
   * Enable console warnings for high latency
   * @internal
   */
  enableWarnings(): void {
    this.warningsEnabled = true;
  }
}
