/**
 * Configuration Version Computation
 * Story 4.7: Swappable Agent Configuration
 *
 * Computes content hashes and version snapshots for Agent.md and SKILL.md files.
 * Used for experiment reproducibility -- version information is captured alongside
 * decision logs (Story 4.6) to distinguish different experiment configurations.
 *
 * Uses SHA-256 truncated to 12 hex chars for version identification (not security).
 * See Dev Notes in Story 4.7 spec for rationale on hash truncation.
 *
 * @module agent/config-version
 */

import { createHash } from 'node:crypto';
import type { Skill } from './types.js';
import type { ResolvedAgentConfig } from './agent-config-types.js';
import type { ConfigVersion, SkillVersion, ConfigSnapshot } from './config-version-types.js';

/**
 * Compute a truncated SHA-256 hash of content for version identification.
 *
 * Returns the first 12 characters of the SHA-256 hex digest.
 * 12 hex chars = 48 bits of entropy, sufficient for distinguishing
 * experiment configurations (collision probability negligible for < 1000 configs).
 *
 * @param content - String content to hash
 * @returns First 12 characters of SHA-256 hex digest
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex').slice(0, 12);
}

/**
 * Compute version information for a single skill.
 *
 * @param skill - The skill object (provides name and reducer)
 * @param content - Raw file content of the SKILL.md file
 * @returns SkillVersion with name, contentHash, and reducer
 */
export function computeSkillVersion(skill: Skill, content: string): SkillVersion {
  return {
    name: skill.name,
    contentHash: computeContentHash(content),
    reducer: skill.reducer,
  };
}

/**
 * Compute the full configuration version from Agent.md and skill file contents.
 *
 * For each skill, looks up its raw file content in the skillContents map.
 * If content is not found (defensive fallback), uses "unknown" as the contentHash.
 *
 * @param agentMdContent - Raw content of the Agent.md file
 * @param agentMdPath - Path to the Agent.md file
 * @param skillContents - Map of skill name -> raw file content
 * @param skills - Array of skill objects to version
 * @returns ConfigVersion with agent hash, skill hashes, and timestamp
 */
export function computeConfigVersion(
  agentMdContent: string,
  agentMdPath: string,
  skillContents: Map<string, string>,
  skills: Skill[]
): ConfigVersion {
  const agentMdHash = computeContentHash(agentMdContent);

  const skillVersions: SkillVersion[] = skills.map((skill) => {
    const content = skillContents.get(skill.name);
    if (content !== undefined) {
      return computeSkillVersion(skill, content);
    }
    // Defensive fallback: skill content unavailable
    return {
      name: skill.name,
      contentHash: 'unknown',
      reducer: skill.reducer,
    };
  });

  return {
    agentMdHash,
    agentMdPath,
    skillVersions,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create a configuration snapshot from a resolved agent config and computed version.
 *
 * The snapshot contains formatted fields compatible with DecisionLogEntry.agentConfig
 * (Story 4.6) for experiment reproducibility.
 *
 * @param config - The resolved agent configuration
 * @param version - The computed configuration version
 * @returns ConfigSnapshot with agent name, version, active skills, and formatted version string
 */
export function createConfigSnapshot(
  config: ResolvedAgentConfig,
  version: ConfigVersion
): ConfigSnapshot {
  return {
    agentName: config.name,
    version,
    activeSkills: config.skillNames,
    agentMdVersion: 'sha256:' + version.agentMdHash,
  };
}

/**
 * Format version information for use in DecisionLogEntry.agentConfig.
 *
 * Returns the { agentMdVersion, activeSkills } structure expected by
 * DecisionLogEntry (Story 4.6).
 *
 * @param snapshot - The configuration snapshot
 * @returns Object with agentMdVersion and activeSkills fields
 */
export function formatVersionForDecisionLog(snapshot: ConfigSnapshot): {
  agentMdVersion: string;
  activeSkills: string[];
} {
  return {
    agentMdVersion: snapshot.agentMdVersion,
    activeSkills: snapshot.activeSkills,
  };
}
