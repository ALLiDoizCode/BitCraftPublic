/**
 * Skill Action Registry
 * Story 4.1: Skill File Format & Parser
 *
 * In-memory registry for parsed skills. Provides uniform consumption (AC5, NFR21)
 * across all frontends (MCP server, TUI backend, direct import).
 *
 * @module agent/skill-registry
 */

import type { Skill, SkillMetadata } from './types.js';
import { SkillParseError } from './types.js';
import { loadSkillDirectory } from './skill-loader.js';

/**
 * In-memory registry for parsed skills.
 * Provides uniform access to skill data for all consumers.
 */
export class SkillRegistry {
  private readonly skills: Map<string, Skill> = new Map();

  /**
   * Register a skill by name.
   * @throws {SkillParseError} With code DUPLICATE_SKILL_NAME if a skill with the same name exists
   */
  register(skill: Skill, filePath?: string): void {
    if (this.skills.has(skill.name)) {
      throw new SkillParseError(
        `Duplicate skill name "${skill.name}": a skill with this name is already registered`,
        'DUPLICATE_SKILL_NAME',
        filePath ?? '<registry>'
      );
    }
    this.skills.set(skill.name, skill);
  }

  /**
   * Retrieve a skill by name.
   * @returns The skill, or undefined if not found
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * Retrieve skill metadata by name (AC6 progressive disclosure).
   * Returns only metadata fields (name, description, reducer, params, subscriptions, tags).
   * Excludes body and evals.
   *
   * @returns The skill metadata (without body/evals), or undefined if not found
   */
  getMetadata(name: string): SkillMetadata | undefined {
    const skill = this.skills.get(name);
    if (!skill) {
      return undefined;
    }
    return extractMetadata(skill);
  }

  /**
   * Get all registered skills.
   */
  getAll(): Skill[] {
    return [...this.skills.values()];
  }

  /**
   * Get metadata for all registered skills (AC6 progressive disclosure).
   */
  getAllMetadata(): SkillMetadata[] {
    return [...this.skills.values()].map(extractMetadata);
  }

  /**
   * Check if a skill is registered.
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * Get the number of registered skills.
   */
  get size(): number {
    return this.skills.size;
  }

  /**
   * Remove all registered skills.
   */
  clear(): void {
    this.skills.clear();
  }
}

/**
 * Extract metadata-only fields from a full Skill object.
 * Creates a new object without body or evals properties.
 */
function extractMetadata(skill: Skill): SkillMetadata {
  const metadata: SkillMetadata = {
    name: skill.name,
    description: skill.description,
    reducer: skill.reducer,
    params: skill.params,
    subscriptions: skill.subscriptions,
  };

  if (skill.tags !== undefined) {
    metadata.tags = skill.tags;
  }

  return metadata;
}

/**
 * Convenience factory: load all skills from a directory and register them.
 * Combines loadSkillDirectory() + SkillRegistry.
 *
 * @param dirPath - Path to the directory containing skill files
 * @returns Object with the registry and any parse errors
 */
export async function createSkillRegistryFromDirectory(
  dirPath: string
): Promise<{ registry: SkillRegistry; errors: SkillParseError[] }> {
  const { skills, errors } = await loadSkillDirectory(dirPath);
  const registry = new SkillRegistry();

  for (const skill of skills.values()) {
    registry.register(skill);
  }

  return { registry, errors };
}
