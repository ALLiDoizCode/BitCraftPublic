/**
 * Configuration Versioning Types
 * Story 4.7: Swappable Agent Configuration
 *
 * Type definitions for configuration version computation, used to track
 * Agent.md and SKILL.md file versions for experiment reproducibility.
 * Version information is captured alongside decision logs (Story 4.6).
 *
 * @module agent/config-version-types
 */

/**
 * Version information for a single skill file.
 */
export interface SkillVersion {
  /** Skill name (from YAML frontmatter) */
  name: string;
  /** SHA-256 hash of the SKILL.md file content (first 12 hex chars), or "unknown" if unavailable */
  contentHash: string;
  /** Target reducer name (for quick identification) */
  reducer: string;
}

/**
 * Configuration version computed from Agent.md and skill file contents.
 * Captures sufficient information to distinguish different experiment configurations.
 */
export interface ConfigVersion {
  /** SHA-256 hash of the Agent.md file content (first 12 hex chars) */
  agentMdHash: string;
  /** Path to the Agent.md file */
  agentMdPath: string;
  /** Version info for each active skill */
  skillVersions: SkillVersion[];
  /** ISO 8601 timestamp when version was computed */
  timestamp: string;
}

/**
 * Snapshot of agent configuration for reproducibility.
 * Contains the computed version and formatted fields compatible with
 * DecisionLogEntry.agentConfig (Story 4.6).
 */
export interface ConfigSnapshot {
  /** Agent name from AgentConfig.name */
  agentName: string;
  /** The computed version information */
  version: ConfigVersion;
  /** List of active skill names (for DecisionLogEntry.agentConfig.activeSkills) */
  activeSkills: string[];
  /** Formatted version string for DecisionLogEntry.agentConfig.agentMdVersion (e.g., "sha256:abc123def456") */
  agentMdVersion: string;
}
