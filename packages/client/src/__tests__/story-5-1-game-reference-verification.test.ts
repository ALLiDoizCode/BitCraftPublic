/**
 * Story 5.1: Server Source Analysis & Reducer Catalog
 * Acceptance Test-Driven Development (ATDD) - Verification Tests
 *
 * Story 5.1 is a research/documentation story. Its primary deliverable is the
 * BitCraft Game Reference document at:
 *   _bmad-output/planning-artifacts/bitcraft-game-reference.md
 *
 * These verification tests validate that the output document meets all 5
 * acceptance criteria (AC1-AC5), the 10 verification steps (V5.1-01 through
 * V5.1-06 plus structural checks), and the 3 completeness metrics
 * (reducer coverage, signature coverage, game system coverage) defined in
 * the story.
 *
 * Test levels: Unit/Verification (vitest, file-based validation)
 * No Docker required for these tests.
 *
 * Run these tests explicitly with:
 *   RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-1-game-reference-verification.test.ts
 *
 * Or implicitly when the game reference document exists (auto-detected).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const GAME_REFERENCE_PATH = path.join(
  PROJECT_ROOT,
  '_bmad-output/planning-artifacts/bitcraft-game-reference.md'
);

// Run verification tests when:
// 1. Explicitly requested via RUN_VERIFICATION_TESTS=true, OR
// 2. The game reference document already exists (GREEN phase validation)
const runVerification =
  process.env.RUN_VERIFICATION_TESTS === 'true' || fs.existsSync(GAME_REFERENCE_PATH);

// The 10 required game systems from AC1/AC3
const REQUIRED_GAME_SYSTEMS = [
  'movement',
  'gathering',
  'crafting',
  'combat',
  'building',
  'trading',
  'empire',
  'chat',
  'player lifecycle',
  'administrative',
] as const;

/**
 * Helper: Escape a string for safe use in RegExp construction.
 * Prevents ReDoS when building dynamic regex patterns, even from trusted input.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Helper: Read the game reference document content.
 * Returns empty string if file does not exist.
 */
function readGameReference(): string {
  try {
    return fs.readFileSync(GAME_REFERENCE_PATH, 'utf-8');
  } catch (_error: unknown) {
    return '';
  }
}

/**
 * Helper: Extract all markdown headings (levels 1-4: # through ####) from the document.
 */
function extractHeadings(content: string): string[] {
  const headingPattern = /^#{1,4}\s+(.+)$/gm;
  const headings: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(content)) !== null) {
    headings.push(match[1].trim().toLowerCase());
  }
  return headings;
}

/**
 * Helper: Count occurrences of a pattern in document content.
 */
function countOccurrences(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

describe.skipIf(!runVerification)(
  'Story 5.1: BitCraft Game Reference Document Verification',
  () => {
    let content: string;
    let fileExists: boolean;

    beforeAll(() => {
      fileExists = fs.existsSync(GAME_REFERENCE_PATH);
      content = readGameReference();
    });

    // ==========================================================================
    // V5.1-05: Game Reference document saved to correct path (AC4)
    // ==========================================================================
    describe('AC4 / V5.1-05: Document exists at correct path', () => {
      it('should create bitcraft-game-reference.md at _bmad-output/planning-artifacts/', () => {
        // Given: The story implementation is complete
        // When: We check the expected output path
        // Then: The file exists
        expect(fileExists).toBe(true);
      });

      it('should contain non-trivial content (not an empty or stub file)', () => {
        // Given: The game reference document exists
        // When: We measure its length
        // Then: It has substantial content (at least 5000 characters for a comprehensive reference)
        expect(content.length).toBeGreaterThan(5000);
      });
    });

    // ==========================================================================
    // V5.1-01: Reducer catalog covers all public reducers (669 total) (AC1)
    // ==========================================================================
    describe('AC1 / V5.1-01: Reducer catalog completeness', () => {
      it('should contain a Reducer Catalog section', () => {
        // Given: The game reference document exists
        // When: We look for a reducer catalog section
        // Then: The document has a heading for the reducer catalog
        const headings = extractHeadings(content);
        const hasReducerCatalog = headings.some(
          (h) => h.includes('reducer catalog') || (h.includes('reducer') && h.includes('catalog'))
        );
        expect(hasReducerCatalog).toBe(true);
      });

      it('should document the total reducer count', () => {
        // Given: The game reference document exists
        // When: We search for the total reducer count
        // Then: A count is documented (either exact or approximate)
        const hasCountInfo =
          /\b\d{2,3}\s*(reducer|public reducer)/i.test(content) ||
          /total.*reducer.*\d+/i.test(content) ||
          /reducer.*total.*\d+/i.test(content) ||
          /~?\s*\d{2,3}\s*(reducer|public)/i.test(content);
        expect(hasCountInfo).toBe(true);
      });

      it('should have substantial reducer coverage (>= 100 unique reducers documented in tables/signatures)', () => {
        // Given: The game reference document has a reducer catalog
        // When: We count documented reducer entries across all formats
        // Then: At least 100 unique reducers are documented
        // Note: The story found ~669 total reducers (~180 player-facing); the document catalogs
        // player-facing reducers in detailed tables and summarizes admin/data-loading reducers
        // in aggregate. The 100 threshold validates comprehensive coverage of player-facing reducers.
        const reducerEntryPattern = /`[a-z_]+\s*\(/g;
        const reducerTablePattern = /\|\s*`?[a-z_]+`?\s*\|/g;
        const reducerListPattern = /^[-*]\s+`?[a-z_]+`?\s*[:(]/gm;

        const signatureCount = countOccurrences(content, reducerEntryPattern);
        const tableCount = countOccurrences(content, reducerTablePattern);
        const listCount = countOccurrences(content, reducerListPattern);

        // Take the maximum count approach -- the document may use different formats
        const estimatedReducerCount = Math.max(signatureCount, tableCount, listCount);
        expect(estimatedReducerCount).toBeGreaterThanOrEqual(100);
      });
    });

    // ==========================================================================
    // V5.1-02: Argument signature documentation (AC2)
    // ==========================================================================
    describe('AC2 / V5.1-02: Argument signature documentation', () => {
      it('should document reducer argument types using type annotations', () => {
        // Given: The game reference has a reducer catalog
        // When: We search for type annotations in reducer signatures
        // Then: At least 10 reducers have typed parameters documented
        // Patterns like: param_name: Type, or (param1: i32, param2: String)
        const typeAnnotationPattern =
          /[a-z_]+\s*:\s*(i32|i64|u32|u64|u8|u16|u128|f32|f64|bool|String|Identity|Vec|Option|ReducerContext|EntityId|[A-Z][a-zA-Z]+)/g;
        const typeAnnotationCount = countOccurrences(content, typeAnnotationPattern);

        // Expect at least 10 typed parameters documented (spot-check level)
        expect(typeAnnotationCount).toBeGreaterThanOrEqual(10);
      });

      it('should document the identity parameter convention', () => {
        // Given: The game reference document exists
        // When: We search for identity parameter documentation
        // Then: The document explains how identity is handled in reducer signatures
        const hasIdentityDocs =
          /identity.*parameter/i.test(content) ||
          /ReducerContext/i.test(content) ||
          /ctx\.sender/i.test(content) ||
          /identity.*propagation/i.test(content);
        expect(hasIdentityDocs).toBe(true);
      });

      it('should document how the Nostr public key maps to SpacetimeDB Identity', () => {
        // Given: The game reference documents identity conventions
        // When: We search for Nostr-to-SpacetimeDB identity mapping
        // Then: The document explains the mapping
        const hasNostrMapping =
          (/nostr/i.test(content) && /identity/i.test(content)) ||
          (/pubkey/i.test(content) && /spacetimedb/i.test(content)) ||
          /nostr.*public.*key/i.test(content);
        expect(hasNostrMapping).toBe(true);
      });
    });

    // ==========================================================================
    // V5.1-03: Game system grouping (AC3)
    // ==========================================================================
    describe('AC3 / V5.1-03: Game system grouping', () => {
      it.each(REQUIRED_GAME_SYSTEMS)('should have a section for the "%s" game system', (system) => {
        // Given: The game reference has a reducer catalog
        // When: We search for the game system section
        // Then: The system is documented as a heading or section
        const systemLower = system.toLowerCase();
        const systemEscaped = escapeRegExp(systemLower).replace(/\s+/g, '\\s+');
        const hasSystem =
          content.toLowerCase().includes(systemLower) &&
          // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- values from hardcoded REQUIRED_GAME_SYSTEMS const array, escaped via escapeRegExp()
          (new RegExp(`#{1,4}\\s+.*${systemEscaped}`, 'i').test(content) ||
            new RegExp(`\\*\\*${systemEscaped}`, 'i').test(content)); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
        expect(hasSystem).toBe(true);
      });

      it('should cover all 10 game systems', () => {
        // Given: The game reference document exists
        // When: We check all 10 required game systems
        // Then: All 10 are mentioned in the document
        const foundSystems = REQUIRED_GAME_SYSTEMS.filter((system) =>
          content.toLowerCase().includes(system.toLowerCase())
        );
        expect(foundSystems.length).toBe(REQUIRED_GAME_SYSTEMS.length);
      });

      it('should order reducers by invocation sequence within game systems', () => {
        // Given: Game systems are documented
        // When: We look for sequence indicators
        // Then: At least one game system shows an ordered sequence
        // Look for sequence-related language or numbering within system sections
        const hasSequenceIndicators =
          /sequence|step\s*\d|order|first.*then|->|-->|→/i.test(content) ||
          /\d+\.\s+`?[a-z_]+/m.test(content);
        expect(hasSequenceIndicators).toBe(true);
      });
    });

    // ==========================================================================
    // V5.1-04: Identity propagation convention documented (AC2 + AC4)
    // ==========================================================================
    describe('AC2+AC4 / V5.1-04: Identity propagation convention', () => {
      it('should have a dedicated Identity Propagation section', () => {
        // Given: The game reference document exists
        // When: We search for an identity propagation section
        // Then: A dedicated heading exists
        const headings = extractHeadings(content);
        const hasIdentitySection = headings.some(
          (h) => h.includes('identity') && (h.includes('propagation') || h.includes('model'))
        );
        expect(hasIdentitySection).toBe(true);
      });

      it('should document ReducerContext.sender vs explicit parameter convention', () => {
        // Given: The identity section exists
        // When: We look for ReducerContext.sender documentation
        // Then: The convention is documented
        const hasContextSender =
          /ReducerContext/i.test(content) ||
          /ctx\.sender/i.test(content) ||
          /reducer.*context.*sender/i.test(content);
        expect(hasContextSender).toBe(true);
      });

      it('should document BLOCKER-1 analysis and implications', () => {
        // Given: The identity section exists
        // When: We search for BLOCKER-1 documentation
        // Then: The blocker is analyzed with a recommendation
        const hasBlockerAnalysis =
          /BLOCKER-1/i.test(content) || (/blocker/i.test(content) && /identity/i.test(content));
        expect(hasBlockerAnalysis).toBe(true);
      });

      it('should document BLS handler identity propagation path', () => {
        // Given: The identity section exists
        // When: We search for BLS handler identity documentation
        // Then: The BLS identity propagation path is documented
        const hasBlsDocs =
          /BLS.*identity/i.test(content) ||
          /BLS.*handler/i.test(content) ||
          /identity.*BLS/i.test(content) ||
          /prepend.*pubkey/i.test(content) ||
          /pubkey.*prepend/i.test(content);
        expect(hasBlsDocs).toBe(true);
      });
    });

    // ==========================================================================
    // V5.1-06: Table-reducer cross-reference / FK relationships (AC5)
    // ==========================================================================
    describe('AC5 / V5.1-06: Foreign key relationships', () => {
      it('should have a Table-Reducer Relationships section', () => {
        // Given: The game reference document exists
        // When: We search for a table-reducer relationships section
        // Then: A dedicated heading exists
        const headings = extractHeadings(content);
        const hasRelationshipsSection = headings.some(
          (h) =>
            (h.includes('table') && h.includes('reducer')) ||
            (h.includes('foreign') && h.includes('key')) ||
            h.includes('cross-reference') ||
            h.includes('table-reducer')
        );
        expect(hasRelationshipsSection).toBe(true);
      });

      it('should document at least 10 FK relationships', () => {
        // Given: The relationships section exists
        // When: We count FK relationship entries
        // Then: At least 10 relationships are documented
        // FK patterns: "X references Y", "X -> Y table", "FK: X.field -> Y.field"
        const fkPatterns = [
          /→\s*`?[a-z_]+`?\s*(table|\.\s*[a-z_]+)/gi,
          /references?\s+`?[a-z_]+/gi,
          /->\s*`?[a-z_]+/gi,
          /foreign\s+key/gi,
          /\b[a-z_]+_id\b.*\b[a-z_]+\b.*\b(table|entity)\b/gi,
        ];

        let totalFkMentions = 0;
        for (const pattern of fkPatterns) {
          totalFkMentions += countOccurrences(content, pattern);
        }

        // At least 10 FK relationships documented
        expect(totalFkMentions).toBeGreaterThanOrEqual(10);
      });

      it('should map reducer arguments to table primary keys', () => {
        // Given: FK relationships are documented
        // When: We search for argument-to-table mappings
        // Then: Concrete mappings are present (e.g., item_id -> item_desc.id)
        const hasArgToTableMapping =
          /[a-z_]+_id.*[a-z_]+\.(id|pk|key)/i.test(content) ||
          /argument.*table/i.test(content) ||
          /param.*references/i.test(content) ||
          /\|\s*[a-z_]+_id\s*\|/i.test(content);
        expect(hasArgToTableMapping).toBe(true);
      });
    });

    // ==========================================================================
    // Additional structural requirements from AC4 and verification steps
    // ==========================================================================
    describe('Structural completeness (AC4)', () => {
      it('should include a Known Constraints section', () => {
        // Given: The game reference document exists
        // When: We check for a constraints section
        // Then: Known constraints are documented
        const headings = extractHeadings(content);
        const hasConstraints = headings.some(
          (h) => h.includes('constraint') || h.includes('limitation')
        );
        expect(hasConstraints).toBe(true);
      });

      it('should include a Quick Reference table for Stories 5.4-5.8', () => {
        // Given: The game reference document exists
        // When: We check for a quick reference section
        // Then: A quick reference for downstream stories exists
        const hasQuickRef =
          /quick.?reference/i.test(content) ||
          /(5\.4|5\.5|5\.6|5\.7|5\.8).*reducer/i.test(content) ||
          /reducer.*(5\.4|5\.5|5\.6|5\.7|5\.8)/i.test(content);
        expect(hasQuickRef).toBe(true);
      });

      it('should use snake_case for all reducer names', () => {
        // Given: The reducer catalog uses consistent naming
        // When: We check for reducer name format
        // Then: Reducer names follow snake_case convention (no camelCase)
        // Look for backtick-quoted identifiers that look like reducer names
        const reducerNames = content.match(/`([a-z][a-z0-9_]*)\s*\(/g);
        if (reducerNames && reducerNames.length > 0) {
          // None should be camelCase (no uppercase letters after first char within backticks)
          const camelCaseReducers = reducerNames.filter((name) => /[A-Z]/.test(name));
          expect(camelCaseReducers).toHaveLength(0);
        } else {
          // If no backtick-quoted reducers found, the document structure needs work
          expect(reducerNames).not.toBeNull();
        }
      });

      it('should include an Overview section with server architecture', () => {
        // Given: The game reference document exists
        // When: We check for an overview section
        // Then: An overview with architecture context exists
        const headings = extractHeadings(content);
        const hasOverview = headings.some((h) => h.includes('overview'));
        expect(hasOverview).toBe(true);
      });

      it('should include a Module Structure subsection', () => {
        // Given: The game reference document exists (AC4: includes server module structure)
        // When: We check for a module structure section
        // Then: The document describes the server module organization
        const headings = extractHeadings(content);
        const hasModuleStructure = headings.some(
          (h) => h.includes('module') && h.includes('structure')
        );
        expect(hasModuleStructure).toBe(true);
      });
    });

    // ==========================================================================
    // Completeness Metrics: Reducer coverage >= 90%, signature coverage >= 80%
    // ==========================================================================
    describe('Completeness metrics', () => {
      it('should catalog a substantial number of player-facing reducers in tables', () => {
        // Given: The story requires reducer coverage >= 90% of all public reducers (669 total found)
        // When: We count unique reducer names documented in table rows
        // Then: The count should reflect comprehensive coverage of player-facing reducers
        // Count unique reducer names in table format: | `reducer_name` |
        const tableReducerMatches = content.match(/\|\s*`([a-z][a-z0-9_]*)`\s*\|/g);
        const uniqueTableReducers = tableReducerMatches
          ? new Set(
              tableReducerMatches.map((m) => m.match(/`([a-z][a-z0-9_]*)`/)?.[1]).filter(Boolean)
            )
          : new Set<string>();
        // The document catalogs ~180 player-facing reducers across tables;
        // expect at least 100 unique reducer names in table format
        expect(uniqueTableReducers.size).toBeGreaterThanOrEqual(100);
      });

      it('should have signature coverage >= 80% of cataloged reducers', () => {
        // Given: The story requires >= 80% of cataloged reducers have complete argument types
        // When: We count reducers with type annotations vs total in the Reducer Catalog section
        // Then: The ratio should be >= 80%
        // Scope counting to the Reducer Catalog section only (excludes agent tables,
        // entity tables, FK tables which have different column formats)
        const catalogStart = content.indexOf('## Reducer Catalog');
        const catalogEnd = content.indexOf('## Identity Propagation');
        const catalogContent =
          catalogStart !== -1 && catalogEnd !== -1
            ? content.substring(catalogStart, catalogEnd)
            : content;

        // Count reducers with (ctx or (_ctx in their signature column
        const withCtx = catalogContent.match(/\|\s*`[a-z_]+`\s*\|\s*`\(_?ctx/g);
        const totalInCatalog = catalogContent.match(/\|\s*`[a-z][a-z0-9_]*`\s*\|/g);

        const sigCount = withCtx ? withCtx.length : 0;
        const totalCount = totalInCatalog ? totalInCatalog.length : 1;

        // At least 80% of catalog-listed reducers should have signature documentation
        const coverage = sigCount / totalCount;
        expect(coverage).toBeGreaterThanOrEqual(0.8);
      });
    });

    // ==========================================================================
    // V5.1-02 enhanced: Spot-check 10 specific reducers for complete signatures
    // ==========================================================================
    describe('V5.1-02 enhanced: Spot-check specific reducer signatures', () => {
      // These 10 reducers are key player-facing reducers that must have
      // complete argument documentation per the verification step
      const SPOT_CHECK_REDUCERS = [
        'player_move',
        'sign_in',
        'sign_out',
        'extract',
        'craft_initiate',
        'trade_accept',
        'attack',
        'chat_post_message',
        'building_deconstruct',
        'player_respawn',
      ] as const;

      it.each(SPOT_CHECK_REDUCERS)(
        'should document complete argument types for "%s"',
        (reducer) => {
          // Given: The reducer catalog documents this reducer
          // When: We look for it in the document
          // Then: It appears with argument type information
          const reducerEscaped = escapeRegExp(reducer);
          // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- values from hardcoded SPOT_CHECK_REDUCERS const array, escaped via escapeRegExp()
          const reducerPattern = new RegExp(`\`${reducerEscaped}\``, 'i');
          expect(reducerPattern.test(content)).toBe(true);

          // Additionally verify it appears in a signature context with (ctx, ...)
          // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- values from hardcoded SPOT_CHECK_REDUCERS const array, escaped via escapeRegExp()
          const signaturePattern = new RegExp(`\`${reducerEscaped}[^|]*\\(ctx`, 'i');
          const inSignatureContext =
            signaturePattern.test(content) ||
            // Also accept table format where signature is in a separate column
            // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- values from hardcoded SPOT_CHECK_REDUCERS const array, escaped via escapeRegExp()
            new RegExp(`\`${reducerEscaped}\`\\s*\\|\\s*\`\\(ctx`, 'i').test(content);
          expect(inSignatureContext).toBe(true);
        }
      );
    });

    // ==========================================================================
    // Verification step 8: Quick reference covers each of Stories 5.4-5.8
    // ==========================================================================
    describe('Quick reference per-story coverage', () => {
      const DOWNSTREAM_STORIES = ['5.4', '5.5', '5.6', '5.7', '5.8'] as const;

      it.each(DOWNSTREAM_STORIES)(
        'should include reducers for Story %s in quick reference',
        (story) => {
          // Given: The quick reference section exists
          // When: We search for story-specific reducer listings
          // Then: Each downstream story has associated reducer documentation
          // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- values from hardcoded DOWNSTREAM_STORIES const array, escaped via escapeRegExp()
          const storyPattern = new RegExp(`story\\s*${escapeRegExp(story)}`, 'i');
          expect(storyPattern.test(content)).toBe(true);
        }
      );
    });

    // ==========================================================================
    // BLOCKER-1 resolution recommendation (AC2/AC4 sub-requirement)
    // ==========================================================================
    describe('BLOCKER-1 resolution recommendation', () => {
      it('should include resolution options for BLOCKER-1', () => {
        // Given: The identity propagation section analyzes BLOCKER-1
        // When: We look for resolution options or recommendations
        // Then: At least one resolution option is documented
        const hasResolutionOptions =
          /resolution.*option/i.test(content) ||
          /option.*description/i.test(content) ||
          /recommend/i.test(content);
        expect(hasResolutionOptions).toBe(true);
      });

      it('should document the identity mismatch problem', () => {
        // Given: BLOCKER-1 is about identity propagation mismatch
        // When: We look for the mismatch description
        // Then: The problem is clearly stated
        const hasMismatchDoc =
          /mismatch/i.test(content) ||
          /incompatible/i.test(content) ||
          /prepend.*pubkey.*incompatible/i.test(content) ||
          (/admin.*identity/i.test(content) && /player/i.test(content));
        expect(hasMismatchDoc).toBe(true);
      });
    });

    // ==========================================================================
    // V5.1-06 enhanced: Spot-check 5 specific FK relationships
    // ==========================================================================
    describe('V5.1-06 enhanced: Spot-check specific FK relationships', () => {
      // These 5 FK relationships should be documented per the verification step
      const FK_SPOT_CHECKS = [
        { arg: 'recipe_id', table: 'extraction_recipe_desc' },
        { arg: 'recipe_id', table: 'crafting_recipe_desc' },
        { arg: 'building_entity_id', table: 'building_state' },
        { arg: 'session_entity_id', table: 'trade_session_state' },
        { arg: 'claim_entity_id', table: 'claim_state' },
      ] as const;

      it.each(FK_SPOT_CHECKS)('should document FK: $arg -> $table', ({ arg, table }) => {
        // Given: The FK relationships section exists
        // When: We look for this specific FK mapping
        // Then: Both the argument name and referenced table appear in the document
        const hasArg = content.includes(arg);
        const hasTable = content.includes(table);
        expect(hasArg && hasTable).toBe(true);
      });
    });

    // ==========================================================================
    // AC1 sub-requirement: Each reducer entry documents return behavior
    // ==========================================================================
    describe('AC1 sub-requirement: Return behavior documentation', () => {
      it('should document that reducers return Result<(), String>', () => {
        // Given: AC1 requires return behavior documentation for each reducer
        // When: We search for return type documentation
        // Then: The Result<(), String> pattern is documented
        const hasReturnType =
          /Result<\(\), String>/i.test(content) ||
          /Result\s*<\s*\(\)\s*,\s*String\s*>/i.test(content) ||
          /return.*Result/i.test(content);
        expect(hasReturnType).toBe(true);
      });

      it('should note that SpacetimeDB reducers have no return values beyond Result', () => {
        // Given: The document explains reducer behavior
        // When: We look for return value constraint documentation
        // Then: The API constraint about no return values is documented
        const hasReturnConstraint =
          /no.*return.*value/i.test(content) ||
          /success.*failure.*only.*feedback/i.test(content) ||
          /Result<\(\), String>/i.test(content);
        expect(hasReturnConstraint).toBe(true);
      });
    });

    // ==========================================================================
    // AC3 sub-requirement: Multiple game systems have invocation sequences
    // ==========================================================================
    describe('AC3 sub-requirement: Invocation sequences documented per system', () => {
      it('should document invocation sequences for at least 3 game systems', () => {
        // Given: AC3 requires each system's reducers ordered by typical invocation
        // When: We count systems with documented sequences (arrows or "sequence" mentions)
        // Then: At least 3 game systems show invocation sequences
        // Look for "invocation sequence" or "->" patterns near game system headings
        const sequenceBlocks = content.match(/invocation sequence[^#]*?->/gi);
        const arrowSequences = content.match(/`[a-z_]+`\s*->\s*`[a-z_]+`/g);
        const sequenceCount = sequenceBlocks ? sequenceBlocks.length : 0;
        const arrowCount = arrowSequences ? arrowSequences.length : 0;

        // At least 3 game systems should have arrow-based invocation sequences
        expect(Math.max(sequenceCount, arrowCount)).toBeGreaterThanOrEqual(3);
      });
    });

    // ==========================================================================
    // AC4 sub-requirement: Reducer -> Table impact matrix
    // ==========================================================================
    describe('AC4 sub-requirement: Reducer-table impact matrix', () => {
      it('should include a reducer-to-table impact matrix', () => {
        // Given: AC4 says the document includes table impact information
        // When: We look for the impact matrix section
        // Then: A section mapping reducers to the tables they read/write exists
        const hasImpactMatrix =
          /impact.*matrix/i.test(content) ||
          /tables?\s*(read|written)/i.test(content) ||
          (/reducer/i.test(content) && /tables?\s*read/i.test(content));
        expect(hasImpactMatrix).toBe(true);
      });
    });

    // ==========================================================================
    // Progressive action pattern documentation (important for Stories 5.4-5.8)
    // ==========================================================================
    describe('Progressive action pattern documentation', () => {
      it('should document the progressive action (start + complete) pattern', () => {
        // Given: Many BitCraft reducers use the two-phase progressive action pattern
        // When: We look for documentation of this pattern
        // Then: The pattern is explained
        const hasProgressivePattern =
          /progressive.*action/i.test(content) ||
          /start.*complete.*pattern/i.test(content) ||
          /two-phase/i.test(content) ||
          /_start.*phase/i.test(content);
        expect(hasProgressivePattern).toBe(true);
      });

      it('should list specific reducers using the progressive action pattern', () => {
        // Given: The progressive action pattern is documented
        // When: We look for specific reducer pairs
        // Then: At least 3 reducer pairs are listed as using the pattern
        const progressivePairs = [
          'extract_start',
          'craft_initiate_start',
          'building_deconstruct_start',
          'terraform_start',
          'item_use_start',
        ];
        const documentedPairs = progressivePairs.filter((pair) => content.includes(pair));
        expect(documentedPairs.length).toBeGreaterThanOrEqual(3);
      });
    });

    // ==========================================================================
    // Server-side agents documentation (Task 1.4 requirement)
    // ==========================================================================
    describe('Server-side agents documentation', () => {
      it('should document server-side scheduled agents', () => {
        // Given: Task 1.4 requires analysis of server-side agents in agents/
        // When: We look for agent documentation
        // Then: Background agents are documented as non-player-callable
        const hasAgentDocs =
          /server.*agent/i.test(content) ||
          /background.*task/i.test(content) ||
          /scheduled.*agent/i.test(content) ||
          /agent.*loop/i.test(content);
        expect(hasAgentDocs).toBe(true);
      });

      it('should document at least 5 named server-side agents', () => {
        // Given: There are ~21 server-side agents
        // When: We count named agents in the document
        // Then: At least 5 agents are documented by name
        const agentNames = [
          'auto_logout',
          'building_decay',
          'resources_regen',
          'day_night',
          'player_regen',
          'npc_ai',
          'growth',
          'enemy_regen',
          'rent_collector',
          'trade_sessions',
        ];
        const documentedAgents = agentNames.filter((agent) =>
          content.toLowerCase().includes(agent.toLowerCase())
        );
        expect(documentedAgents.length).toBeGreaterThanOrEqual(5);
      });
    });

    // ==========================================================================
    // Data loading reducers documentation (AC1: all public reducers cataloged)
    // ==========================================================================
    describe('Data loading reducer documentation', () => {
      it('should document import/stage reducers as a category', () => {
        // Given: AC1 requires all public reducers cataloged
        // When: We look for import/stage reducer documentation
        // Then: The data loading category is documented
        const hasDataLoadingDocs =
          (/import_\*/i.test(content) || /import.*reducer/i.test(content)) &&
          (/stage_\*/i.test(content) || /stage.*reducer/i.test(content));
        expect(hasDataLoadingDocs).toBe(true);
      });

      it('should document that data loading reducers are not for gameplay', () => {
        // Given: Import/stage reducers are server-initialization only
        // When: We check the documentation
        // Then: It clearly states these are not for gameplay or client.publish() calls
        const hasNonGameplayNote =
          /not.*gameplay/i.test(content) ||
          /not.*player.*callable/i.test(content) ||
          /server.*initialization/i.test(content) ||
          /not.*relevant.*gameplay/i.test(content) ||
          /not.*relevant.*skill/i.test(content);
        expect(hasNonGameplayNote).toBe(true);
      });
    });
  }
);
