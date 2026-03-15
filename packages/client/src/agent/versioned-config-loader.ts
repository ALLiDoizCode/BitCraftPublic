/**
 * Versioned Agent Configuration Loader
 * Story 4.7: Swappable Agent Configuration
 *
 * Wraps the agent config loader (Story 4.2) with configuration versioning.
 * Reads Agent.md and skill files from disk, computes content hashes, and
 * produces a VersionedAgentConfig with a ConfigSnapshot for reproducibility.
 *
 * Stateless: every call re-reads from disk (NFR25). No caching.
 *
 * @module agent/versioned-config-loader
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ResolvedAgentConfig } from './agent-config-types.js';
import type { ConfigSnapshot } from './config-version-types.js';
import { loadAgentConfig } from './agent-config-loader.js';
import { computeConfigVersion, createConfigSnapshot } from './config-version.js';
import { parseSkillMetadata } from './skill-parser.js';

/** File extension for skill files (matches skill-loader.ts) */
const SKILL_FILE_EXTENSION = '.skill.md';

/**
 * Versioned agent configuration that extends ResolvedAgentConfig with
 * a configuration snapshot for experiment reproducibility.
 */
export interface VersionedAgentConfig extends ResolvedAgentConfig {
  /** Computed version information including content hashes */
  configSnapshot: ConfigSnapshot;
}

/**
 * Read raw file contents of all .skill.md files in a directory, keyed by skill name.
 *
 * Lists all .skill.md files in the directory, reads each file's content,
 * extracts the skill name from YAML frontmatter via parseSkillMetadata,
 * and returns a Map keyed by skill name with raw file content as values.
 *
 * On individual file read or parse errors: silently skips the file
 * (defensive -- do not crash the agent). The affected skill's hash will
 * fall back to "unknown" in the config version.
 *
 * Security note: This function does not perform path traversal or symlink
 * validation. In loadVersionedAgentConfig(), loadAgentConfig() is called
 * first, which validates the directory path via skill-loader.ts. If the
 * path is malicious, loadAgentConfig() throws before this function runs.
 *
 * @param skillsDirPath - Path to the directory containing SKILL.md files
 * @returns Map of skill name -> raw file content
 */
export async function readSkillContents(skillsDirPath: string): Promise<Map<string, string>> {
  const contentsMap = new Map<string, string>();

  let entries: string[];
  try {
    const dirEntries = await readdir(skillsDirPath, { withFileTypes: true });
    entries = dirEntries
      .filter((entry) => entry.isFile() && entry.name.endsWith(SKILL_FILE_EXTENSION))
      .map((entry) => entry.name);
  } catch {
    // Directory read failed -- return empty map (defensive)
    return contentsMap;
  }

  for (const filename of entries) {
    const filePath = join(skillsDirPath, filename);
    try {
      const content = await readFile(filePath, 'utf-8');
      // Extract skill name from YAML frontmatter
      const metadata = parseSkillMetadata(filePath, content);
      contentsMap.set(metadata.name, content);
    } catch {
      // Individual file read/parse error -- skip file (defensive)
      // The skill may still work via loadAgentConfig; only the hash will be "unknown"
    }
  }

  return contentsMap;
}

/**
 * Load and resolve an Agent.md configuration with version computation.
 *
 * Reads Agent.md from disk, loads the agent config via loadAgentConfig (Story 4.2),
 * reads skill file contents for hashing, and computes a ConfigSnapshot.
 *
 * Stateless: every call reads fresh from disk (NFR25). No caching.
 *
 * Note: Skill files are read twice -- once by loadAgentConfig (for parsing) and
 * once by readSkillContents (for hashing). This is acceptable for MVP as skill
 * files are small (< 10KB) and loaded infrequently (only on restart/reload).
 *
 * @param agentMdPath - Path to the Agent.md file
 * @param skillsDirPath - Path to the directory containing SKILL.md files
 * @returns Versioned agent configuration with configSnapshot
 */
export async function loadVersionedAgentConfig(
  agentMdPath: string,
  skillsDirPath: string
): Promise<VersionedAgentConfig> {
  // Read Agent.md content for hashing
  const agentMdContent = await readFile(agentMdPath, 'utf-8');

  // Load the resolved agent config (Story 4.2)
  const resolvedConfig = await loadAgentConfig(agentMdPath, skillsDirPath);

  // Read skill file contents for hashing
  const skillContents = await readSkillContents(skillsDirPath);

  // Compute version from content hashes
  const version = computeConfigVersion(
    agentMdContent,
    agentMdPath,
    skillContents,
    resolvedConfig.skills
  );

  // Build the snapshot
  const configSnapshot = createConfigSnapshot(resolvedConfig, version);

  return {
    ...resolvedConfig,
    configSnapshot,
  };
}

/**
 * Reload agent configuration with version computation (semantic alias).
 *
 * Reads fresh from disk every time (NFR25 stateless). Equivalent to
 * loadVersionedAgentConfig -- exists for semantic clarity matching
 * reloadAgentConfig (Story 4.2).
 *
 * @param agentMdPath - Path to the Agent.md file
 * @param skillsDirPath - Path to the directory containing SKILL.md files
 * @returns Versioned agent configuration with configSnapshot
 */
export async function reloadVersionedAgentConfig(
  agentMdPath: string,
  skillsDirPath: string
): Promise<VersionedAgentConfig> {
  return loadVersionedAgentConfig(agentMdPath, skillsDirPath);
}
