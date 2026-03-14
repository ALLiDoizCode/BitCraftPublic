/**
 * Triggering Precision Validator
 * Story 4.2: Agent.md Configuration & Skill Selection
 *
 * Analyzes skill descriptions for overlapping/ambiguous triggering.
 * Uses deterministic token-overlap (Jaccard similarity) -- NOT LLM-based.
 *
 * @module agent/triggering-precision
 */

import type { Skill } from './types.js';

/**
 * Warning about overlapping skill descriptions.
 */
export interface TriggeringPrecisionWarning {
  /** First skill name */
  skillA: string;
  /** Second skill name */
  skillB: string;
  /** Jaccard similarity score (0.0 to 1.0) */
  similarity: number;
  /** Human-readable reason for the warning */
  reason: string;
}

/**
 * Report from triggering precision validation.
 */
export interface TriggeringPrecisionReport {
  /** List of warnings about overlapping descriptions */
  warnings: TriggeringPrecisionWarning[];
  /** Whether the validation passed (no warnings) */
  passed: boolean;
}

/** Jaccard similarity threshold for triggering a warning */
const SIMILARITY_THRESHOLD = 0.7;

/** Stop words to remove from token comparison */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'the',
  'a',
  'an',
  'to',
  'for',
  'of',
  'in',
  'on',
  'at',
  'by',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'that',
  'this',
  'it',
  'and',
  'or',
  'but',
]);

/**
 * Tokenize a description string into significant words.
 * Lowercases, splits on whitespace/punctuation, removes stop words.
 *
 * @param description - Raw description string
 * @returns Set of significant tokens
 */
function tokenize(description: string): Set<string> {
  const tokens = description
    .toLowerCase()
    .split(/[\s,.;:!?()[\]{}"'`/\\]+/)
    .filter((t) => t.length > 0)
    .filter((t) => !STOP_WORDS.has(t));

  return new Set(tokens);
}

/**
 * Compute Jaccard similarity between two token sets.
 * Jaccard similarity = |intersection| / |union|
 *
 * @param setA - First token set
 * @param setB - Second token set
 * @returns Similarity score between 0.0 and 1.0
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 1.0; // Both empty -> identical
  }

  let intersectionSize = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}

/**
 * Check if one description is a substring of another.
 *
 * @param descA - First description (lowercase)
 * @param descB - Second description (lowercase)
 * @returns True if either is a substring of the other
 */
function isSubstringMatch(descA: string, descB: string): boolean {
  const lowerA = descA.toLowerCase().trim();
  const lowerB = descB.toLowerCase().trim();
  return lowerA.includes(lowerB) || lowerB.includes(lowerA);
}

/**
 * Validate triggering precision of skill descriptions.
 * Compares every pair of skill descriptions for ambiguity using:
 * 1. Exact match detection
 * 2. Substring containment detection
 * 3. Token overlap (Jaccard similarity) with threshold >= 0.7
 *
 * @param skills - Array of resolved skills to analyze
 * @returns Report with warnings and pass/fail status
 */
export function validateTriggeringPrecision(skills: Skill[]): TriggeringPrecisionReport {
  const warnings: TriggeringPrecisionWarning[] = [];

  // Compare every pair of skills
  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const skillA = skills[i];
      const skillB = skills[j];
      const descA = skillA.description;
      const descB = skillB.description;

      // Strategy 1: Exact match
      if (descA === descB) {
        warnings.push({
          skillA: skillA.name,
          skillB: skillB.name,
          similarity: 1.0,
          reason: `Identical descriptions: "${descA}"`,
        });
        continue;
      }

      // Strategy 2: Substring containment
      if (isSubstringMatch(descA, descB)) {
        const tokensA = tokenize(descA);
        const tokensB = tokenize(descB);
        const similarity = jaccardSimilarity(tokensA, tokensB);
        warnings.push({
          skillA: skillA.name,
          skillB: skillB.name,
          similarity,
          reason: `One description contains the other: "${descA.length <= descB.length ? descA : descB}" is substring of "${descA.length > descB.length ? descA : descB}"`,
        });
        continue;
      }

      // Strategy 3: Token overlap (Jaccard similarity)
      const tokensA = tokenize(descA);
      const tokensB = tokenize(descB);
      const similarity = jaccardSimilarity(tokensA, tokensB);

      if (similarity >= SIMILARITY_THRESHOLD) {
        warnings.push({
          skillA: skillA.name,
          skillB: skillB.name,
          similarity,
          reason: `High token overlap (Jaccard similarity: ${similarity.toFixed(2)}): many shared significant words between descriptions`,
        });
      }
    }
  }

  return {
    warnings,
    passed: warnings.length === 0,
  };
}
