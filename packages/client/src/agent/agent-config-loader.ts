/**
 * Agent Configuration Loader
 * Story 4.2: Agent.md Configuration & Skill Selection
 *
 * Loads Agent.md from disk, parses it, and resolves skill references
 * from the skills directory. Stateless: re-reads from disk on every call (NFR25).
 *
 * @module agent/agent-config-loader
 */

import { readFile } from 'node:fs/promises';
import type { ResolvedAgentConfig } from './agent-config-types.js';
import { AgentConfigError } from './agent-config-types.js';
import { parseAgentConfig } from './agent-config-parser.js';
import { loadSkillDirectory } from './skill-loader.js';
import { SkillRegistry } from './skill-registry.js';

/**
 * Load and resolve an Agent.md configuration.
 * Reads Agent.md from disk, parses it, loads skill directory,
 * and resolves skill references.
 *
 * Stateless: every call reads fresh from disk (NFR25). No caching.
 *
 * @param agentMdPath - Path to the Agent.md file
 * @param skillsDirPath - Path to the directory containing SKILL.md files
 * @returns Resolved agent configuration with skill objects
 * @throws {AgentConfigError} If Agent.md is missing, invalid, or references missing skills
 */
export async function loadAgentConfig(
  agentMdPath: string,
  skillsDirPath: string
): Promise<ResolvedAgentConfig> {
  // Read Agent.md from disk
  let content: string;
  try {
    content = await readFile(agentMdPath, 'utf-8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : `Cannot read file: ${agentMdPath}`;
    throw new AgentConfigError(
      `Failed to read Agent.md at ${agentMdPath}: ${message}`,
      'PARSE_ERROR',
      agentMdPath
    );
  }

  // Parse Agent.md content
  const config = parseAgentConfig(agentMdPath, content);

  // Load all skills from the skills directory
  const { skills: allSkills } = await loadSkillDirectory(skillsDirPath);

  // Resolve skill references: for each referenced name, look up in loaded skills
  const missingSkills: string[] = [];
  for (const skillName of config.skillNames) {
    if (!allSkills.has(skillName)) {
      missingSkills.push(skillName);
    }
  }

  if (missingSkills.length > 0) {
    throw new AgentConfigError(
      `Skills not found for agent "${config.name}" in ${agentMdPath}: ${missingSkills.join(', ')}`,
      'SKILL_NOT_FOUND',
      agentMdPath,
      missingSkills
    );
  }

  // Build filtered SkillRegistry with only the referenced skills
  // Safety: allSkills.get() is guaranteed non-undefined here because the missing-check
  // above already verified all skillNames exist in allSkills and threw if any were missing.
  const filteredRegistry = new SkillRegistry();
  const resolvedSkills = [];
  for (const skillName of config.skillNames) {
    const skill = allSkills.get(skillName);
    if (skill === undefined) {
      // Defensive guard: should never be reached due to the missing-check above,
      // but avoids non-null assertion for robustness against future refactoring.
      throw new AgentConfigError(
        `Unexpected: skill "${skillName}" disappeared during resolution in ${agentMdPath}`,
        'SKILL_NOT_FOUND',
        agentMdPath,
        [skillName]
      );
    }
    filteredRegistry.register(skill);
    resolvedSkills.push(skill);
  }

  return {
    ...config,
    skills: resolvedSkills,
    skillRegistry: filteredRegistry,
  };
}

/**
 * Reload agent configuration from disk (semantic alias for loadAgentConfig).
 * Agent.md is never cached; every call reads fresh from disk (NFR25 stateless).
 *
 * @param agentMdPath - Path to the Agent.md file
 * @param skillsDirPath - Path to the directory containing SKILL.md files
 * @returns Resolved agent configuration with skill objects
 */
export async function reloadAgentConfig(
  agentMdPath: string,
  skillsDirPath: string
): Promise<ResolvedAgentConfig> {
  return loadAgentConfig(agentMdPath, skillsDirPath);
}
