/**
 * Agent File Generator
 * Story 4.2: Agent.md Configuration & Skill Selection
 *
 * Generates CLAUDE.md and AGENTS.md files from a resolved agent configuration.
 * Generated files are returned as strings; writing to disk is the consumer's responsibility.
 *
 * @module agent/agent-file-generator
 */

import type { ResolvedAgentConfig } from './agent-config-types.js';
import type { Skill } from './types.js';

/**
 * Output from agent file generation.
 */
export interface AgentFileOutput {
  /** CLAUDE.md content for Claude agents */
  claudeMd: string;
  /** AGENTS.md content for non-Claude agents (Vercel AI, OpenCode) */
  agentsMd: string;
}

/**
 * Convert a skill name to snake_case MCP tool name.
 * Skill names are already expected to be snake_case, but this
 * ensures consistent formatting.
 */
function toMcpToolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Generate a parameter summary string for a skill.
 */
function formatParamSummary(skill: Skill): string {
  if (skill.params.length === 0) {
    return 'No parameters';
  }
  return skill.params.map((p) => `\`${p.name}\` (${p.type}): ${p.description}`).join('\n  - ');
}

/**
 * Generate CLAUDE.md content for Claude agents.
 * Includes personality, constraints, goals, skill descriptions, and MCP tool references.
 *
 * @param config - Resolved agent configuration with skills
 * @returns CLAUDE.md content string
 */
export function generateClaudeMd(config: ResolvedAgentConfig): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Agent: ${config.name}`);
  lines.push('');

  // Identity section
  lines.push('## Identity');
  lines.push('');
  if (config.personality) {
    lines.push(config.personality);
  } else {
    lines.push(`You are ${config.name}, an AI agent operating in a SpacetimeDB game world.`);
  }
  lines.push('');

  // Constraints section
  lines.push('## Constraints');
  lines.push('');
  if (config.budget) {
    lines.push(`- Budget: ${config.budget.raw}`);
  }
  lines.push(`- Available skills: ${config.skills.length}`);
  lines.push('');

  // Goals section
  lines.push('## Goals');
  lines.push('');
  if (config.personality) {
    lines.push(
      `Operate according to your identity and use available skills to achieve objectives in the game world.`
    );
  } else {
    lines.push('Interact with the game world using your available skills.');
  }
  lines.push('');

  // Available Skills section
  lines.push('## Available Skills');
  lines.push('');
  for (const skill of config.skills) {
    lines.push(`### ${skill.name}`);
    lines.push('');
    lines.push(`**Description:** ${skill.description}`);
    lines.push(`**Reducer:** \`${skill.reducer}\``);
    lines.push(`**Parameters:**`);
    lines.push(`  - ${formatParamSummary(skill)}`);
    lines.push('');
  }

  // MCP Tools section
  lines.push('## MCP Tools');
  lines.push('');
  lines.push('The following MCP tools are available for executing skills:');
  lines.push('');
  for (const skill of config.skills) {
    const toolName = toMcpToolName(skill.name);
    lines.push(`- \`${toolName}\`: ${skill.description}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate AGENTS.md content for non-Claude agents.
 * Same information as CLAUDE.md but in runtime-agnostic format.
 *
 * @param config - Resolved agent configuration with skills
 * @returns AGENTS.md content string
 */
export function generateAgentsMd(config: ResolvedAgentConfig): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Agent Configuration: ${config.name}`);
  lines.push('');

  // Agent Info
  lines.push('## Agent Info');
  lines.push('');
  lines.push(`- **Name:** ${config.name}`);
  if (config.personality) {
    lines.push(`- **Personality:** ${config.personality}`);
  }
  if (config.budget) {
    lines.push(`- **Budget:** ${config.budget.raw}`);
  }
  lines.push(`- **Skill Count:** ${config.skills.length}`);
  lines.push('');

  // Skills
  lines.push('## Skills');
  lines.push('');
  for (const skill of config.skills) {
    lines.push(`### ${skill.name}`);
    lines.push('');
    lines.push(`- **Description:** ${skill.description}`);
    lines.push(`- **Reducer:** \`${skill.reducer}\``);
    lines.push(`- **Parameters:**`);
    lines.push(`  - ${formatParamSummary(skill)}`);
    lines.push('');
  }

  // Tool Mapping
  lines.push('## Tool Mapping');
  lines.push('');
  lines.push('Map the following skill names to tool invocations:');
  lines.push('');
  for (const skill of config.skills) {
    const toolName = toMcpToolName(skill.name);
    lines.push(`- \`${toolName}\` -> reducer \`${skill.reducer}\``);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate both CLAUDE.md and AGENTS.md from a resolved agent configuration.
 *
 * @param config - Resolved agent configuration with skills
 * @returns Object with both generated file contents
 */
export function generateAgentFiles(config: ResolvedAgentConfig): AgentFileOutput {
  return {
    claudeMd: generateClaudeMd(config),
    agentsMd: generateAgentsMd(config),
  };
}
