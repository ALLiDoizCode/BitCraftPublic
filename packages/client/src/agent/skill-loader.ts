/**
 * Skill Directory Loader
 * Story 4.1: Skill File Format & Parser
 *
 * Loads all .skill.md files from a directory, parsing each independently
 * with error isolation (AC4). Supports both full parsing and metadata-only
 * parsing for progressive disclosure (AC6).
 *
 * Security: OWASP A03 -- path traversal prevention, symlink boundary enforcement.
 * Performance: NFR7 -- parallel file I/O via Promise.all, target <1s for 50 skills.
 *
 * @module agent/skill-loader
 */

import { readdir, readFile, realpath } from 'node:fs/promises';
import { join, resolve, sep, posix } from 'node:path';
import type { Skill, SkillMetadata } from './types.js';
import { SkillParseError } from './types.js';
import { parseSkillFile, parseSkillMetadata } from './skill-parser.js';

/** File extension for skill files */
const SKILL_FILE_EXTENSION = '.skill.md';

/**
 * Result of loading all skill files from a directory (full parse).
 */
export interface SkillLoadResult {
  /** Successfully parsed skills, keyed by skill name */
  skills: Map<string, Skill>;
  /** Errors encountered while parsing individual files */
  errors: SkillParseError[];
}

/**
 * Result of loading metadata-only from all skill files in a directory.
 */
export interface SkillMetadataLoadResult {
  /** Successfully parsed skill metadata, keyed by skill name */
  skills: Map<string, SkillMetadata>;
  /** Errors encountered while parsing individual files */
  errors: SkillParseError[];
}

/**
 * Validate directory path for security (OWASP A03).
 * Rejects paths containing '..' as a path segment (traversal sequences).
 * Uses path-segment-aware splitting to avoid false positives on
 * legitimate directory names containing '..' as a substring (e.g., 'foo..bar').
 *
 * @param dirPath - Directory path to validate
 * @throws {Error} If path contains traversal sequences
 */
function validateDirectoryPath(dirPath: string): void {
  // Split on both platform separator and POSIX separator to handle cross-platform paths.
  // Use a Set to avoid duplicate segments when sep === posix.sep (macOS/Linux).
  const separators = new Set([sep, posix.sep]);
  for (const separator of separators) {
    const segments = dirPath.split(separator);
    if (segments.some((segment) => segment === '..')) {
      throw new Error(
        `Directory path contains path traversal sequences (..): ${dirPath}`
      );
    }
  }
}

/**
 * Get list of .skill.md files from a directory.
 *
 * @param dirPath - Absolute directory path
 * @returns Array of filenames matching *.skill.md
 */
async function listSkillFiles(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() && entry.name.endsWith(SKILL_FILE_EXTENSION)
    )
    .map((entry) => entry.name);
}

/**
 * Generic result from parsing a single skill file.
 * Used internally by loadSkillFilesFromDirectory to support both full and metadata-only parsing.
 */
type ParseFileResult<T> =
  | { type: 'success'; parsed: T; name: string; filePath: string }
  | { type: 'error'; error: SkillParseError };

/**
 * Core directory loading logic shared between full parse and metadata-only parse.
 * Validates the directory path, resolves symlinks, reads files in parallel,
 * and collects results with error isolation and duplicate detection.
 *
 * @param dirPath - Path to the directory containing skill files
 * @param parseFn - Parser function to apply to each file's content
 * @returns Object with skills map and errors array
 */
async function loadSkillFilesFromDirectory<T extends { name: string }>(
  dirPath: string,
  parseFn: (filePath: string, content: string) => T
): Promise<{ skills: Map<string, T>; errors: SkillParseError[] }> {
  validateDirectoryPath(dirPath);

  // Resolve both logical path and real path (handles macOS /var -> /private/var symlinks)
  const resolvedPath = resolve(dirPath);
  const realDirPath = await realpath(resolvedPath);
  const filenames = await listSkillFiles(realDirPath);

  const skills = new Map<string, T>();
  const errors: SkillParseError[] = [];

  // Load all files in parallel (NFR7 performance)
  const results: ParseFileResult<T>[] = await Promise.all(
    filenames.map(async (filename): Promise<ParseFileResult<T>> => {
      const filePath = join(realDirPath, filename);
      try {
        // Verify the real path doesn't escape the directory (symlink protection)
        const realFilePath = await realpath(filePath);
        // Append sep to prevent prefix-based bypass (e.g., /tmp/skills-dir-other matching /tmp/skills-dir)
        const dirBoundary = realDirPath.endsWith(sep) ? realDirPath : realDirPath + sep;
        if (!realFilePath.startsWith(dirBoundary)) {
          throw new SkillParseError(
            `Symlink escapes skill directory boundary: ${filename}`,
            'PARSE_ERROR',
            filePath
          );
        }

        const content = await readFile(filePath, 'utf-8');
        const parsed = parseFn(filePath, content);
        return { type: 'success', parsed, name: parsed.name, filePath };
      } catch (err: unknown) {
        if (err instanceof SkillParseError) {
          return { type: 'error', error: err };
        }
        return {
          type: 'error',
          error: new SkillParseError(
            err instanceof Error
              ? err.message
              : `Unknown error parsing ${filename}`,
            'PARSE_ERROR',
            filePath
          ),
        };
      }
    })
  );

  for (const result of results) {
    if (result.type === 'success') {
      if (skills.has(result.name)) {
        errors.push(
          new SkillParseError(
            `Duplicate skill name "${result.name}": another file in the same directory defines a skill with this name`,
            'DUPLICATE_SKILL_NAME',
            result.filePath
          )
        );
      } else {
        skills.set(result.name, result.parsed);
      }
    } else {
      errors.push(result.error);
    }
  }

  return { skills, errors };
}

/**
 * Load all .skill.md files from a directory (full parse).
 * Parses each file independently with error isolation.
 * Valid skills are still loaded even if some files fail to parse.
 *
 * @param dirPath - Path to the directory containing skill files
 * @returns Object with skills map and errors array
 * @throws {Error} If dirPath contains path traversal sequences or does not exist
 */
export async function loadSkillDirectory(
  dirPath: string
): Promise<SkillLoadResult> {
  return loadSkillFilesFromDirectory<Skill>(dirPath, parseSkillFile);
}

/**
 * Load metadata-only from all .skill.md files in a directory (AC6 progressive disclosure).
 * Same error isolation as full load, but skips markdown body and evals.
 *
 * @param dirPath - Path to the directory containing skill files
 * @returns Object with metadata map and errors array
 * @throws {Error} If dirPath contains path traversal sequences or does not exist
 */
export async function loadSkillDirectoryMetadata(
  dirPath: string
): Promise<SkillMetadataLoadResult> {
  return loadSkillFilesFromDirectory<SkillMetadata>(dirPath, parseSkillMetadata);
}
