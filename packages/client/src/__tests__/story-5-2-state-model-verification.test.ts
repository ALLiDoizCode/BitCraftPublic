/**
 * Story 5.2: Game State Model & Table Relationships
 * Acceptance Test-Driven Development (ATDD) - Verification Tests
 *
 * Story 5.2 is a research/documentation story. Its primary deliverable is an
 * update to the BitCraft Game Reference document at:
 *   _bmad-output/planning-artifacts/bitcraft-game-reference.md
 *
 * These verification tests validate that the output document meets all 5
 * acceptance criteria (AC1-AC5), the 5 verification checks (V5.2-01 through
 * V5.2-05), and the completeness metrics (entity coverage >= 85%, FK
 * relationships >= 30, all 14 game systems with subscriptions) defined in
 * the story.
 *
 * Test levels: Unit/Verification (vitest, file-based validation)
 * No Docker required for these tests.
 *
 * Run these tests explicitly with:
 *   RUN_VERIFICATION_TESTS=true npx vitest run --config packages/client/vitest.config.ts packages/client/src/__tests__/story-5-2-state-model-verification.test.ts
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
// 2. The game reference document contains the State Model section (Story 5.2 implemented)
//
// Note: Unlike Story 5.1 which checks for file existence, Story 5.2 checks for
// the State Model section because the file already exists from Story 5.1.
// This prevents RED phase failures from blocking CI before Story 5.2 is implemented.
function hasStateModelSection(): boolean {
  try {
    const content = fs.readFileSync(GAME_REFERENCE_PATH, 'utf-8');
    return /^#{1,3}\s+.*state\s+model/im.test(content);
  } catch {
    return false;
  }
}
const runVerification = process.env.RUN_VERIFICATION_TESTS === 'true' || hasStateModelSection();

// The 14 game systems from Story 5.1 (AC3 requirement)
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
  'claim',
  'rental',
  'housing',
  'quest',
] as const;

// Core entity tables that must appear in the entity-to-concept mapping (AC1 spot-check)
const SPOT_CHECK_ENTITY_TABLES = [
  'player_state',
  'mobile_entity_state',
  'health_state',
  'stamina_state',
  'inventory_state',
  'equipment_state',
  'building_state',
  'combat_state',
  'trade_session_state',
  'progressive_action_state',
] as const;

// Critical entity-to-entity FK relationships that must be documented (AC2 spot-check)
const ENTITY_TO_ENTITY_FK_SPOT_CHECKS = [
  { source: 'user_state', target: 'player_state', via: 'entity_id' },
  { source: 'player_state', target: 'mobile_entity_state', via: 'entity_id' },
  { source: 'player_state', target: 'health_state', via: 'entity_id' },
  { source: 'player_state', target: 'inventory_state', via: 'entity_id' },
  { source: 'player_state', target: 'equipment_state', via: 'entity_id' },
] as const;

// Critical entity-to-static FK relationships that must be documented (AC2 spot-check)
const ENTITY_TO_STATIC_FK_SPOT_CHECKS = [
  { source: 'building_state', target: 'building_desc' },
  { source: 'inventory_state', target: 'item_desc' },
  { source: 'progressive_action_state', target: 'crafting_recipe_desc' },
  { source: 'progressive_action_state', target: 'extraction_recipe_desc' },
  { source: 'resource_state', target: 'resource_desc' },
] as const;

// Static data tables essential for Stories 5.4-5.8 (AC4 requirement)
const ESSENTIAL_STATIC_DATA_TABLES = [
  'extraction_recipe_desc',
  'crafting_recipe_desc',
  'item_desc',
  'resource_desc',
  'building_desc',
  'food_desc',
  'tool_desc',
  'equipment_desc',
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

/**
 * Helper: Extract a section from the document between two headings.
 * Returns the content between the start heading and the next heading at the same or higher level.
 */
function extractSection(content: string, sectionHeading: string): string {
  const escapedHeading = escapeRegExp(sectionHeading);
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- sectionHeading from hardcoded string literals, escaped via escapeRegExp()
  const startPattern = new RegExp(`^(#{1,4})\\s+${escapedHeading}`, 'im');
  const startMatch = startPattern.exec(content);
  if (!startMatch) return '';

  const startLevel = startMatch[1].length;
  const startIndex = startMatch.index + startMatch[0].length;

  // Find the next heading at the same or higher level
  const remainingContent = content.substring(startIndex);
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- startLevel is a number (1-4) derived from regex capture group length, not user input
  const endPattern = new RegExp(`^#{1,${startLevel}}\\s+`, 'm');
  const endMatch = endPattern.exec(remainingContent);

  if (endMatch) {
    return remainingContent.substring(0, endMatch.index);
  }
  return remainingContent;
}

describe.skipIf(!runVerification)(
  'Story 5.2: Game State Model & Table Relationships Verification',
  () => {
    let content: string;
    let fileExists: boolean;
    let headings: string[];

    beforeAll(() => {
      fileExists = fs.existsSync(GAME_REFERENCE_PATH);
      content = readGameReference();
      headings = extractHeadings(content);
    });

    // ==========================================================================
    // AC5 / V5.2-05: Game Reference document exists and was updated
    // ==========================================================================
    describe('AC5: Game Reference document updated with State Model', () => {
      it('should have the game reference document at the expected path', () => {
        // Given: Story 5.2 implementation is complete
        // When: We check the expected output path
        // Then: The file exists
        expect(fileExists).toBe(true);
      });

      it('should contain a State Model section', () => {
        // Given: The game reference document exists
        // When: We look for a State Model section heading
        // Then: A dedicated section for the state model exists
        const hasStateModel = headings.some(
          (h) => h.includes('state model') || h.includes('state-model')
        );
        expect(hasStateModel).toBe(true);
      });

      it('should preserve Story 5.1 content (Reducer Catalog section)', () => {
        // Given: Story 5.1 created the Reducer Catalog section
        // When: We check that it still exists after Story 5.2 updates
        // Then: The Reducer Catalog section is preserved
        const hasReducerCatalog = headings.some(
          (h) => h.includes('reducer catalog') || (h.includes('reducer') && h.includes('catalog'))
        );
        expect(hasReducerCatalog).toBe(true);
      });

      it('should preserve Story 5.1 content (Identity Propagation section)', () => {
        // Given: Story 5.1 created the Identity Propagation section
        // When: We check that it still exists after Story 5.2 updates
        // Then: The Identity Propagation section is preserved
        const hasIdentitySection = headings.some(
          (h) => h.includes('identity') && h.includes('propagation')
        );
        expect(hasIdentitySection).toBe(true);
      });

      it('should preserve Story 5.1 content (Table-Reducer Relationships section)', () => {
        // Given: Story 5.1 created the Table-Reducer Relationships section
        // When: We check that it still exists after Story 5.2 updates
        // Then: The Table-Reducer Relationships section is preserved
        const hasTableReducerSection = headings.some(
          (h) => (h.includes('table') && h.includes('reducer')) || h.includes('table-reducer')
        );
        expect(hasTableReducerSection).toBe(true);
      });

      it('should preserve Story 5.1 content (Known Constraints section)', () => {
        // Given: Story 5.1 created the Known Constraints section
        // When: We check that it still exists after Story 5.2 updates
        // Then: The Known Constraints section is preserved
        const hasConstraints = headings.some(
          (h) => h.includes('constraint') || h.includes('limitation')
        );
        expect(hasConstraints).toBe(true);
      });

      it('should preserve Story 5.1 content (Quick Reference section)', () => {
        // Given: Story 5.1 created the Quick Reference section
        // When: We check that it still exists after Story 5.2 updates
        // Then: The Quick Reference section is preserved
        const hasQuickRef = headings.some(
          (h) => h.includes('quick reference') || h.includes('quick-reference')
        );
        expect(hasQuickRef).toBe(true);
      });

      it('should be substantially larger than Story 5.1 baseline', () => {
        // Given: Story 5.1 created the initial document
        // When: Story 5.2 adds the State Model section
        // Then: The document should be substantially larger (5.1 was ~25K chars;
        //       5.2 adds entity mappings, FK tables, ER diagram, subscriptions, gap analysis)
        // Use 30K as minimum to verify the State Model content was actually added
        expect(content.length).toBeGreaterThan(30000);
      });
    });

    // ==========================================================================
    // AC1 / V5.2-01: Entity table mapping completeness
    // ==========================================================================
    describe('AC1 / V5.2-01: Entity table mapping completeness', () => {
      it('should contain an entity-to-concept mapping section', () => {
        // Given: The game reference document exists
        // When: We look for an entity mapping section
        // Then: A section for entity-to-concept mapping exists
        const hasEntityMapping = headings.some(
          (h) =>
            (h.includes('entity') && h.includes('mapping')) ||
            (h.includes('entity') && h.includes('table')) ||
            (h.includes('entity') && h.includes('concept'))
        );
        expect(hasEntityMapping).toBe(true);
      });

      it('should map at least 68 entity tables (>= 85% of ~80)', () => {
        // Given: The entity table section exists
        // When: We count unique entity table names documented in table rows
        // Then: At least 68 entity tables are mapped (85% of ~80)
        // Pattern: table rows with entity table names (snake_case names in table cells)
        // Look for patterns like "| `table_name` |" or "| table_name |" in markdown tables
        const stateModelSection = extractSection(content, 'State Model');
        const entityMappingContent = stateModelSection || content;

        // Count unique table names that look like entity tables (ending in _state, _slot, etc.)
        // or matching known entity table patterns
        const tableNamePattern =
          /\|\s*`?([a-z][a-z0-9_]*(?:_state|_tiles?|_slot|_spawn|_matrix|_description|_unlock|_stack|_listing|_session|_order|_outcome|_trail|_chunks|_function|_progress|_site|_clump|_deposit|_energy|_buff|_scaling|_report|_settings|_action|_log|_shaping|_paved))`?\s*\|/gi;
        const matches = entityMappingContent.match(tableNamePattern);
        const uniqueTables = matches
          ? new Set(
              matches
                .map((m) => {
                  const nameMatch = m.match(/`?([a-z][a-z0-9_]*)`?/);
                  return nameMatch ? nameMatch[1] : null;
                })
                .filter(Boolean)
            )
          : new Set<string>();

        // Also count plain entity table names in table format without specific suffixes
        const generalTablePattern = /\|\s*`([a-z][a-z0-9_]+)`\s*\|/g;
        const generalMatches = entityMappingContent.match(generalTablePattern);
        const generalTables = generalMatches
          ? new Set(
              generalMatches
                .map((m) => {
                  const nameMatch = m.match(/`([a-z][a-z0-9_]+)`/);
                  return nameMatch ? nameMatch[1] : null;
                })
                .filter(Boolean)
            )
          : new Set<string>();

        // Take the larger count
        const tableCount = Math.max(uniqueTables.size, generalTables.size);
        expect(tableCount).toBeGreaterThanOrEqual(68);
      });

      it('should include primary key documentation for entity tables', () => {
        // Given: Entity tables are mapped
        // When: We check for PK documentation
        // Then: Primary key information is present (e.g., "PK", "primary key", "entity_id", "id")
        const stateModelSection = extractSection(content, 'State Model');
        const searchContent = stateModelSection || content;

        const hasPKDocs =
          /primary\s*key/i.test(searchContent) ||
          /\bPK\b/.test(searchContent) ||
          /\|\s*.*entity_id.*\|/i.test(searchContent);
        expect(hasPKDocs).toBe(true);
      });

      it('should include game concept categories for entity tables', () => {
        // Given: Entity tables are mapped
        // When: We check for concept category documentation
        // Then: Game concept categories are used (player, inventory, combat, etc.)
        const stateModelSection = extractSection(content, 'State Model');
        const searchContent = stateModelSection || content;

        const categories = [
          'player',
          'inventory',
          'combat',
          'building',
          'position',
          'movement',
          'trading',
          'crafting',
        ];
        const foundCategories = categories.filter((cat) =>
          searchContent.toLowerCase().includes(cat)
        );
        // At least 6 of 8 categories should be present
        expect(foundCategories.length).toBeGreaterThanOrEqual(6);
      });

      it.each(SPOT_CHECK_ENTITY_TABLES)('should document the "%s" entity table', (tableName) => {
        // Given: The entity mapping section exists
        // When: We search for this specific entity table
        // Then: The table is documented in the state model
        const stateModelSection = extractSection(content, 'State Model');
        const searchContent = stateModelSection || content;
        expect(searchContent).toContain(tableName);
      });

      it('should distinguish entity tables from static data tables', () => {
        // Given: Entity tables and static data tables have different purposes
        // When: We check the document structure
        // Then: Entity tables and static data tables are in separate sections or clearly labeled
        const hasEntitySection = headings.some(
          (h) => h.includes('entity') && !h.includes('static')
        );
        const hasStaticSection =
          headings.some((h) => h.includes('static') && h.includes('data')) ||
          content.toLowerCase().includes('static data');
        expect(hasEntitySection && hasStaticSection).toBe(true);
      });

      it('should document key columns for entity tables in mapping tables', () => {
        // Given: AC1 requires "each mapping documents: table name, primary key, key columns,
        //        and the game concept it represents"
        // When: We look for "Key Columns" in the entity mapping table headers
        // Then: The entity mapping tables include a Key Columns column
        const stateModelSection = extractSection(content, 'State Model');
        const searchContent = stateModelSection || content;

        const hasKeyColumnsHeader =
          /\|\s*Key Columns\s*\|/i.test(searchContent) ||
          /\|\s*Key\s+Columns\s*\|/i.test(searchContent);
        expect(hasKeyColumnsHeader).toBe(true);
      });

      it('should document tables with compound primary keys (Task 1.5)', () => {
        // Given: Task 1.5 requires "Document any tables with compound primary keys
        //        or unusual indexing patterns"
        // When: We check for compound PK documentation in the entity mapping
        // Then: At least one compound PK is documented
        const stateModelSection = extractSection(content, 'State Model');
        const searchContent = stateModelSection || content;

        const hasCompoundPK =
          /compound/i.test(searchContent) ||
          /composite.*key/i.test(searchContent) ||
          /multi.*column.*key/i.test(searchContent);
        expect(hasCompoundPK).toBe(true);
      });

      it('should map entity tables to at least 15 game concept categories', () => {
        // Given: The story mapped 131 entity tables into 19 game concept categories
        // When: We count the number of category subsections in the entity mapping
        // Then: At least 15 distinct game concept categories are documented
        const stateModelSection = extractSection(content, 'Entity-to-Concept Mapping');
        expect(stateModelSection.length).toBeGreaterThan(0);
        // Count section headings that describe categories (e.g., "#### Player Core (14 tables)")
        const categoryHeadings = stateModelSection.match(/^#{3,4}\s+.+\(\d+\s+tables?\)/gim);
        const categoryCount = categoryHeadings ? categoryHeadings.length : 0;
        expect(categoryCount).toBeGreaterThanOrEqual(15);
      });
    });

    // ==========================================================================
    // AC2 / V5.2-02: Table relationship documentation
    // ==========================================================================
    describe('AC2 / V5.2-02: Table relationship documentation', () => {
      it('should contain a foreign key relationships section in the State Model', () => {
        // Given: The game reference document has a State Model section
        // When: We look for FK relationship documentation
        // Then: A foreign key relationships section exists
        const hasFKSection = headings.some(
          (h) =>
            (h.includes('foreign') && h.includes('key')) ||
            h.includes('relationship') ||
            h.includes('fk')
        );
        expect(hasFKSection).toBe(true);
      });

      it('should document at least 30 total FK relationships', () => {
        // Given: Story 5.1 documented 18 FK relationships
        // When: Story 5.2 adds entity-to-entity and entity-to-static relationships
        // Then: At least 30 total FK relationships are documented
        // Count FK relationship entries across the document
        // Patterns: "X -> Y", "X.field -> Y.field", "references", arrows in tables
        const fkPatterns = [
          /\|\s*`?[a-z_]+`?\s*\|\s*`?[a-z_]+_id`?\s*\|\s*`?[a-z_]+`?\s*\|/gi, // Table format: | source | field_id | target |
          /[a-z_]+\.[a-z_]+_id\s*(?:->|→)\s*[a-z_]+/gi, // Dot notation: source.field_id -> target
          /[a-z_]+_id\s*\|\s*`?[a-z_]+`?/gi, // Field ID referencing table
        ];

        let totalFkCount = 0;
        for (const pattern of fkPatterns) {
          totalFkCount += countOccurrences(content, pattern);
        }

        // If pattern matching doesn't find enough, also count table rows in FK sections
        const fkSection =
          extractSection(content, 'Foreign Key') ||
          extractSection(content, 'Relationship') ||
          extractSection(content, 'FK');
        if (fkSection) {
          const tableRows = fkSection.match(/^\|[^|]+\|[^|]+\|[^|]+\|/gm);
          if (tableRows) {
            // Subtract header and separator rows
            const dataRows = tableRows.filter(
              (row) => !row.includes('---') && !row.includes('Source') && !row.includes('source')
            );
            totalFkCount = Math.max(totalFkCount, dataRows.length);
          }
        }

        expect(totalFkCount).toBeGreaterThanOrEqual(30);
      });

      it.each(ENTITY_TO_ENTITY_FK_SPOT_CHECKS)(
        'should document FK: $source -> $target (via $via)',
        ({ source, target, via }) => {
          // Given: The FK relationships section exists
          // When: We look for this specific entity-to-entity relationship
          // Then: Both the source and target tables appear with the FK field
          expect(content).toContain(source);
          expect(content).toContain(target);
          expect(content).toContain(via);
        }
      );

      it.each(ENTITY_TO_STATIC_FK_SPOT_CHECKS)(
        'should document FK: $source -> $target (entity-to-static)',
        ({ source, target }) => {
          // Given: The FK relationships section exists
          // When: We look for this specific entity-to-static relationship
          // Then: Both the source entity table and target static data table are documented
          expect(content).toContain(source);
          expect(content).toContain(target);
        }
      );

      it('should document relationship types (1:1, 1:N)', () => {
        // Given: FK relationships are documented
        // When: We look for cardinality information
        // Then: At least some relationships specify their type
        const hasCardinality =
          /1:1|1:N|1:M|N:M|one-to-one|one-to-many|many-to-many/i.test(content) ||
          /\bone\b.*\bmany\b/i.test(content);
        expect(hasCardinality).toBe(true);
      });
    });

    // ==========================================================================
    // AC2 / V5.2-05: Mermaid ER diagram
    // ==========================================================================
    describe('AC2 / V5.2-05: Mermaid ER diagram', () => {
      it('should contain a Mermaid ER diagram code block', () => {
        // Given: Story 5.2 requires a Mermaid relationship diagram
        // When: We search for Mermaid erDiagram syntax
        // Then: An erDiagram code block exists
        const hasMermaidErDiagram = /```mermaid[\s\S]*?erDiagram[\s\S]*?```/i.test(content);
        expect(hasMermaidErDiagram).toBe(true);
      });

      it('should include core entity tables in the Mermaid diagram', () => {
        // Given: The Mermaid diagram exists
        // When: We check for core table names inside the diagram
        // Then: Key tables like player_state, inventory_state, building_state appear
        const mermaidMatch = content.match(/```mermaid[\s\S]*?erDiagram([\s\S]*?)```/i);
        const mermaidContent = mermaidMatch ? mermaidMatch[1] : '';

        const coreTables = [
          'player_state',
          'mobile_entity_state',
          'inventory_state',
          'building_state',
          'health_state',
        ];

        const foundTables = coreTables.filter((table) =>
          mermaidContent.toLowerCase().includes(table.toLowerCase().replace(/_/g, '_'))
        );
        // At least 3 core tables should appear in the diagram
        expect(foundTables.length).toBeGreaterThanOrEqual(3);
      });

      it('should use erDiagram relationship syntax', () => {
        // Given: The Mermaid diagram uses erDiagram format
        // When: We check for relationship syntax
        // Then: Mermaid ER relationship syntax is present (e.g., ||--o{, }|--|{)
        const mermaidMatch = content.match(/```mermaid[\s\S]*?erDiagram([\s\S]*?)```/i);
        const mermaidContent = mermaidMatch ? mermaidMatch[1] : '';

        const hasRelationshipSyntax =
          /\|\|--|[{o|]|[}|]--\|\||[|o{]--[|o{]|[|}o]--[|}o]/i.test(mermaidContent) ||
          /\|\|.*\{/.test(mermaidContent) ||
          /\}.*\|\|/.test(mermaidContent) ||
          /--/.test(mermaidContent);
        expect(hasRelationshipSyntax).toBe(true);
      });

      it('should focus on 20-30 core tables (not all 80+)', () => {
        // Given: The story requires a focused diagram (~25-30 tables)
        // When: We count unique entities in the Mermaid diagram
        // Then: The count is between 10 and 40 (focused, not exhaustive)
        const mermaidMatch = content.match(/```mermaid[\s\S]*?erDiagram([\s\S]*?)```/i);
        const mermaidContent = mermaidMatch ? mermaidMatch[1] : '';

        // Count entity declarations (lines with entity names followed by { or relationship syntax)
        const entityNames = mermaidContent.match(/^\s*([a-z][a-z0-9_]+)\s*[{|]/gim);
        const entityCount = entityNames
          ? new Set(entityNames.map((e) => e.trim().split(/\s/)[0].toLowerCase())).size
          : 0;

        // Between 10 and 40 entities (focused diagram)
        expect(entityCount).toBeGreaterThanOrEqual(10);
        expect(entityCount).toBeLessThanOrEqual(40);
      });
    });

    // ==========================================================================
    // AC3 / V5.2-03: Subscription requirements per game system
    // ==========================================================================
    describe('AC3 / V5.2-03: Subscription requirements per game system', () => {
      it('should contain a subscription requirements section', () => {
        // Given: The game reference document exists
        // When: We look for a subscription section
        // Then: A dedicated subscription requirements section exists
        const hasSubscriptionSection = headings.some((h) => h.includes('subscription'));
        expect(hasSubscriptionSection).toBe(true);
      });

      it.each(REQUIRED_GAME_SYSTEMS)(
        'should document subscription requirements for the "%s" game system',
        (system) => {
          // Given: The subscription section exists
          // When: We search for this game system's subscription requirements
          // Then: The system has documented subscription tables
          const subscriptionSection =
            extractSection(content, 'Subscription Requirements') ||
            extractSection(content, 'Subscription') ||
            content;

          const systemLower = system.toLowerCase();
          // The system name should appear in the subscription context
          expect(subscriptionSection.toLowerCase()).toContain(systemLower);
        }
      );

      it('should include subscription SQL examples', () => {
        // Given: Subscription requirements are documented
        // When: We look for SQL subscription examples
        // Then: At least one SQL example is present
        const hasSQLExample =
          /SELECT\s+\*\s+FROM\s+[a-z_]+/i.test(content) || /SELECT.*FROM.*WHERE/i.test(content);
        expect(hasSQLExample).toBe(true);
      });

      it('should distinguish per-player from global subscriptions', () => {
        // Given: Subscription requirements are documented
        // When: We look for per-player vs global distinction
        // Then: The document explains the difference
        const hasDistinction =
          (/per.?player/i.test(content) && /global/i.test(content)) ||
          (/filtered/i.test(content) && /entity_id/i.test(content)) ||
          /WHERE\s+entity_id/i.test(content);
        expect(hasDistinction).toBe(true);
      });

      it('should include subscription SQL examples for multiple game systems', () => {
        // Given: AC3 requires "subscription queries are documented with example SQL"
        // When: We count game systems that have SQL examples near them
        // Then: At least 3 game systems should have their own SQL examples
        const subscriptionSection =
          extractSection(content, 'Subscription Requirements') ||
          extractSection(content, 'Subscription') ||
          '';

        // Count SELECT statements in the subscription section
        const sqlExamples = subscriptionSection.match(/SELECT\s+\*\s+FROM\s+[a-z_]+/gi);
        const sqlCount = sqlExamples ? sqlExamples.length : 0;
        // With 14 game systems, we expect multiple SQL examples
        expect(sqlCount).toBeGreaterThanOrEqual(5);
      });

      it('should document update frequency or data volume for subscription strategy', () => {
        // Given: Task 5.5 requires "Document estimated data volume per subscription
        //        (number of rows, update frequency) to inform subscription strategy"
        // When: We look for update frequency documentation in the subscription section
        // Then: At least some game systems document update frequency
        const subscriptionSection =
          extractSection(content, 'Subscription Requirements') ||
          extractSection(content, 'Subscription') ||
          '';

        const hasFrequencyDocs =
          /update\s+frequency/i.test(subscriptionSection) ||
          /frequency/i.test(subscriptionSection) ||
          /data\s+volume/i.test(subscriptionSection) ||
          /\b(high|medium|low)\b.*\b(every|per|frequency)\b/i.test(subscriptionSection);
        expect(hasFrequencyDocs).toBe(true);
      });

      it('should list minimum table subscriptions per game system', () => {
        // Given: Subscription requirements are documented per game system
        // When: We look for table lists associated with game systems
        // Then: At least 5 game systems have explicit table subscription lists
        const subscriptionSection =
          extractSection(content, 'Subscription Requirements') ||
          extractSection(content, 'Subscription') ||
          '';

        // Count game systems that have table names mentioned near them
        const systemsWithTables = REQUIRED_GAME_SYSTEMS.filter((system) => {
          const systemLower = system.toLowerCase();
          const systemEscaped = escapeRegExp(systemLower);
          // Look for the system name followed by (within 500 chars) a table name
          // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- values from hardcoded REQUIRED_GAME_SYSTEMS const array, escaped via escapeRegExp()
          const nearbyTablePattern = new RegExp(
            `${systemEscaped}[\\s\\S]{0,500}(?:_state|_desc)`,
            'i'
          );
          return nearbyTablePattern.test(subscriptionSection);
        });

        expect(systemsWithTables.length).toBeGreaterThanOrEqual(5);
      });
    });

    // ==========================================================================
    // AC4 / V5.2-04: Static data dependency analysis
    // ==========================================================================
    describe('AC4 / V5.2-04: Static data dependency analysis', () => {
      it('should contain a static data analysis section', () => {
        // Given: The game reference document exists
        // When: We look for a static data gap analysis section
        // Then: A section analyzing static data dependencies exists
        const hasStaticDataSection = headings.some(
          (h) =>
            (h.includes('static') && h.includes('data')) ||
            h.includes('gap analysis') ||
            (h.includes('static') && h.includes('dependency'))
        );
        expect(hasStaticDataSection).toBe(true);
      });

      it('should reference the 148 total static data tables', () => {
        // Given: Story 5.1 established 148 *_desc tables exist
        // When: We look for this total count
        // Then: The 148 count is mentioned
        const has148Reference =
          /148/i.test(content) && /static.*data|_desc|stage_|import_/i.test(content);
        expect(has148Reference).toBe(true);
      });

      it('should reference the 40 already-loaded static data tables', () => {
        // Given: Story 1.5 loaded 40 static data tables
        // When: We look for this baseline count
        // Then: The 40 count is mentioned in context of loaded/existing tables
        const has40Reference =
          /\b40\b/.test(content) && /loaded|existing|current|already/i.test(content);
        expect(has40Reference).toBe(true);
      });

      it('should identify the gap between loaded and needed tables', () => {
        // Given: 40 tables are loaded out of 148 total
        // When: We look for gap analysis
        // Then: The document identifies which essential tables are missing
        const hasGapAnalysis =
          /gap/i.test(content) ||
          /missing/i.test(content) ||
          /not\s+loaded/i.test(content) ||
          /unloaded/i.test(content) ||
          /\b108\b/.test(content); // 148 - 40 = 108 unloaded
        expect(hasGapAnalysis).toBe(true);
      });

      it.each(ESSENTIAL_STATIC_DATA_TABLES)(
        'should mention essential static data table "%s"',
        (tableName) => {
          // Given: The gap analysis identifies essential tables
          // When: We search for this essential table
          // Then: It appears in the document
          expect(content).toContain(tableName);
        }
      );

      it('should categorize static data tables by game system', () => {
        // Given: Static data tables are analyzed
        // When: We check for categorization
        // Then: Tables are organized by game system they support
        const stateModelSection = extractSection(content, 'State Model') || content;

        const categories = ['crafting', 'building', 'resource', 'item'];
        const foundCategories = categories.filter((cat) =>
          stateModelSection.toLowerCase().includes(cat)
        );
        // At least 3 of 4 categories should appear near static data documentation
        expect(foundCategories.length).toBeGreaterThanOrEqual(3);
      });
    });

    // ==========================================================================
    // Completeness Metrics (from Test Design)
    // ==========================================================================
    describe('Completeness metrics', () => {
      it('should have entity table coverage >= 85% (V5.2-01 metric)', () => {
        // Given: ~80 entity tables exist in the BitCraft server source
        // When: We count documented entity tables in the state model
        // Then: At least 68 are documented (85% of 80)
        // This is a duplicate check of AC1, but framed as the metric from test design
        const stateModelSection = extractSection(content, 'State Model') || content;
        const tablePattern = /\|\s*`([a-z][a-z0-9_]+)`\s*\|/g;
        const matches = stateModelSection.match(tablePattern);
        const uniqueTables = matches
          ? new Set(
              matches
                .map((m) => {
                  const nameMatch = m.match(/`([a-z][a-z0-9_]+)`/);
                  return nameMatch ? nameMatch[1] : null;
                })
                .filter(Boolean)
            )
          : new Set<string>();

        expect(uniqueTables.size).toBeGreaterThanOrEqual(68);
      });

      it('should have relationship coverage >= 30 (V5.2-02 metric)', () => {
        // Given: Story 5.1 documented 18 FK relationships
        // When: Story 5.2 extends with entity-to-entity and entity-to-static FKs
        // Then: At least 30 total FK relationships are documented
        // Count arrow patterns that indicate FK relationships
        const arrowPatterns = content.match(/[a-z_]+(?:\.[a-z_]+)?\s*(?:->|→)\s*[a-z_]+/gi);
        const tableRowFKs = content.match(
          /\|\s*`?[a-z_]+`?\s*\|\s*`?[a-z_]+_id`?\s*\|\s*`?[a-z_]+`?\s*\|/gi
        );

        const arrowCount = arrowPatterns ? arrowPatterns.length : 0;
        const tableCount = tableRowFKs ? tableRowFKs.length : 0;
        const totalCount = Math.max(arrowCount, tableCount);

        expect(totalCount).toBeGreaterThanOrEqual(30);
      });

      it('should cover all 14 game systems with subscriptions (V5.2-03 metric)', () => {
        // Given: 14 game systems exist from Story 5.1
        // When: We check all 14 have subscription documentation
        // Then: All 14 are mentioned in subscription context
        const subscriptionSection = extractSection(content, 'Subscription') || content;

        const coveredSystems = REQUIRED_GAME_SYSTEMS.filter((system) =>
          subscriptionSection.toLowerCase().includes(system.toLowerCase())
        );
        expect(coveredSystems.length).toBe(REQUIRED_GAME_SYSTEMS.length);
      });
    });

    // ==========================================================================
    // Subscription Quick Reference for Stories 5.4-5.8
    // ==========================================================================
    describe('Subscription Quick Reference for Stories 5.4-5.8', () => {
      const DOWNSTREAM_STORIES = ['5.4', '5.5', '5.6', '5.7', '5.8'] as const;

      it('should include a Subscription Quick Reference section', () => {
        // Given: The story requires a quick reference for downstream stories
        // When: We look for the section
        // Then: A quick reference exists
        const hasQuickRef =
          /subscription.*quick.*reference/i.test(content) ||
          /quick.*reference.*subscription/i.test(content) ||
          (headings.some((h) => h.includes('quick reference')) && /subscription/i.test(content));
        expect(hasQuickRef).toBe(true);
      });

      it.each(DOWNSTREAM_STORIES)('should include subscription mapping for Story %s', (story) => {
        // Given: The subscription quick reference exists
        // When: We look for story-specific subscription mappings
        // Then: Each downstream story has subscription documentation
        // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- values from hardcoded DOWNSTREAM_STORIES const array, escaped via escapeRegExp()
        const storyPattern = new RegExp(`(?:story\\s*)?${escapeRegExp(story)}`, 'i');
        expect(storyPattern.test(content)).toBe(true);
      });
    });

    // ==========================================================================
    // Document Structure and Formatting
    // ==========================================================================
    describe('Document structure and formatting', () => {
      it('should use snake_case for all entity table names', () => {
        // Given: BitCraft uses snake_case for table names
        // When: We check table name format in the State Model section
        // Then: No camelCase table names appear (consistency with Story 5.1)
        const stateModelSection = extractSection(content, 'State Model');
        expect(stateModelSection.length).toBeGreaterThan(0);
        const backtickNames = stateModelSection.match(/`([a-z][a-zA-Z0-9_]*_state)`/g);
        if (backtickNames && backtickNames.length > 0) {
          const camelCaseNames = backtickNames.filter((name) =>
            /[A-Z]/.test(name.replace(/`/g, ''))
          );
          expect(camelCaseNames).toHaveLength(0);
        }
      });

      it('should include table format (markdown tables) for entity mappings', () => {
        // Given: Entity mappings need structured presentation
        // When: We check for markdown table format
        // Then: At least one markdown table exists in the State Model section
        const stateModelSection = extractSection(content, 'State Model');
        expect(stateModelSection.length).toBeGreaterThan(0);
        const hasTable = /\|.*\|.*\|/.test(stateModelSection);
        expect(hasTable).toBe(true);
      });

      it('should reference mobile_entity_state for position data', () => {
        // Given: Position data lives in mobile_entity_state (critical for movement/spatial)
        // When: We check the document
        // Then: mobile_entity_state is documented as containing position
        const hasPositionDoc =
          /mobile_entity_state.*position/i.test(content) ||
          /position.*mobile_entity_state/i.test(content) ||
          (content.includes('mobile_entity_state') &&
            /x|y|position|location|coordinate/i.test(content));
        expect(hasPositionDoc).toBe(true);
      });

      it('should document the user_state -> entity_id identity root', () => {
        // Given: user_state.entity_id is the root of all entity relationships
        // When: We check for this fundamental relationship
        // Then: The identity chain from user_state to player entities is documented
        expect(content).toContain('user_state');
        const hasIdentityRoot =
          /user_state.*entity_id/i.test(content) || /identity.*user_state/i.test(content);
        expect(hasIdentityRoot).toBe(true);
      });
    });

    // ==========================================================================
    // Cross-reference with Story 5.1 existing content
    // ==========================================================================
    describe('Cross-reference with Story 5.1 content', () => {
      it('should not duplicate the 18 FK relationships from Story 5.1 verbatim', () => {
        // Given: Story 5.1 documented 18 FK relationships
        // When: Story 5.2 extends with NEW relationships
        // Then: The document should have more than 18 FK-related entries
        //       (indicating new ones were added, not just duplicated)
        // This is a soft check -- we verify the FK section is substantially larger
        const fkSections = [
          extractSection(content, 'Foreign Key'),
          extractSection(content, 'Table Relationship'),
          extractSection(content, 'FK Relationship'),
        ].filter(Boolean);

        const combinedFKContent = fkSections.join('');
        // The combined FK documentation should be substantial (indicating extension beyond 18)
        expect(combinedFKContent.length).toBeGreaterThan(500);
      });

      it('should reference the Reducer -> Table Impact Matrix from Story 5.1', () => {
        // Given: Story 5.1 created a Reducer -> Table Impact Matrix
        // When: Story 5.2 documents subscriptions
        // Then: The Impact Matrix is referenced or cross-referenced
        const hasImpactRef =
          /impact.*matrix/i.test(content) || /reducer.*table.*impact/i.test(content);
        expect(hasImpactRef).toBe(true);
      });

      it('should use consistent entity table names with Story 5.1', () => {
        // Given: Story 5.1 established table naming conventions
        // When: We check for key table names
        // Then: They match the names used in Story 5.1
        const story51Tables = [
          'player_state',
          'mobile_entity_state',
          'inventory_state',
          'building_state',
          'progressive_action_state',
        ];
        const allPresent = story51Tables.every((table) => content.includes(table));
        expect(allPresent).toBe(true);
      });
    });

    // ==========================================================================
    // DEBT-2 resolution support
    // ==========================================================================
    describe('DEBT-2 support: Static data gap identification', () => {
      it('should identify which unloaded static data tables are essential', () => {
        // Given: 108 of 148 static data tables are not loaded (DEBT-2)
        // When: We look for essential-but-unloaded table identification
        // Then: Specific tables are called out as needed
        const hasEssentialUnloaded =
          /essential.*not.*loaded/i.test(content) ||
          /needed.*not.*loaded/i.test(content) ||
          /required.*missing/i.test(content) ||
          /gap.*essential/i.test(content) ||
          /priority.*load/i.test(content) ||
          /DEBT-2/i.test(content);
        expect(hasEssentialUnloaded).toBe(true);
      });

      it('should provide priority ranking for unloaded tables', () => {
        // Given: Not all 108 unloaded tables are equally important
        // When: We check for prioritization
        // Then: Some form of priority or ranking exists
        const hasPriority =
          /priority/i.test(content) ||
          /critical|essential|required|needed|important/i.test(content);
        expect(hasPriority).toBe(true);
      });

      it('should map static data tables per Stories 5.4-5.8 in gap analysis', () => {
        // Given: AC4 requires "the 40 tables already loaded in Story 1.5 are mapped
        //        against this analysis to identify gaps"
        // When: We look for a per-story mapping in the static data gap analysis
        // Then: Stories 5.4-5.8 appear with their required static data tables
        const gapSection =
          extractSection(content, 'Static Data Gap Analysis') ||
          extractSection(content, 'Gap Analysis') ||
          '';

        const storiesInGap = ['5.4', '5.5', '5.6', '5.7', '5.8'].filter((story) =>
          gapSection.includes(story)
        );
        // At least 3 stories should appear in the gap analysis
        expect(storiesInGap.length).toBeGreaterThanOrEqual(3);
      });
    });

    // ==========================================================================
    // Read-Only vs. Player-Mutated table classification (Task 1.4)
    // ==========================================================================
    describe('Read-Only vs. Player-Mutated table classification', () => {
      it('should document read-only (server agent populated) tables', () => {
        // Given: Task 1.4 requires identifying tables that are read-only state
        //        (populated by server agents, not directly by player reducers)
        // When: We look for read-only table classification in the State Model
        // Then: A read-only classification section exists
        const hasReadOnly =
          /read.?only/i.test(content) ||
          /server.*agent.*populated/i.test(content) ||
          /server.*populated/i.test(content);
        expect(hasReadOnly).toBe(true);
      });

      it('should document player-mutated tables', () => {
        // Given: Task 1.4 requires identifying tables mutated by player actions
        // When: We look for player-mutated table classification
        // Then: Player-mutated tables are listed
        const hasPlayerMutated =
          /player.?mutated/i.test(content) ||
          /mutated.*player/i.test(content) ||
          /mutated.*via.*reducer/i.test(content) ||
          /player.*action.*trigger/i.test(content);
        expect(hasPlayerMutated).toBe(true);
      });

      it('should document hybrid tables (player actions + server agents)', () => {
        // Given: Some tables are updated by both player actions and server agents
        // When: We look for hybrid classification
        // Then: Hybrid tables (like health_state, stamina_state) are identified
        const hasHybrid =
          /hybrid/i.test(content) ||
          /player.*actions.*trigger.*server.*resolves/i.test(content) ||
          /health_state.*combat.*agent/i.test(content) ||
          /stamina_state.*player.*agent/i.test(content);
        expect(hasHybrid).toBe(true);
      });
    });

    // ==========================================================================
    // Static data categorization breadth (AC4 extended)
    // ==========================================================================
    describe('Static data categorization breadth', () => {
      it('should categorize static data tables across at least 10 game system groups', () => {
        // Given: AC4 requires static data categorized by game system
        // When: We count distinct game system groups in the static data categorization
        // Then: At least 10 game system groups are documented (document has 15)
        const staticDataSection =
          extractSection(content, 'Static Data Tables by Game System') ||
          extractSection(content, 'Static Data Tables Categorized') ||
          '';

        // Count game system categories in table format: | **System** | tables |
        const categories = staticDataSection.match(/\|\s*\*\*[^|]+\*\*\s*\|/g);
        const categoryCount = categories ? categories.length : 0;

        // If no bold table format, count via standalone bold labels
        const altCategories = staticDataSection.match(/\*\*[A-Z][a-zA-Z/]+\*\*/g);
        const altCount = altCategories ? new Set(altCategories).size : 0;

        expect(Math.max(categoryCount, altCount)).toBeGreaterThanOrEqual(10);
      });

      it('should include static data tables for combat system', () => {
        // Given: Combat is a key game system requiring static data
        // When: We look for combat-related static data tables
        // Then: Combat static data tables like combat_action_desc, enemy_desc are documented
        const staticDataSection =
          extractSection(content, 'Static Data Tables by Game System') ||
          extractSection(content, 'Static Data Tables Categorized') ||
          content;

        const hasCombatStatic =
          staticDataSection.includes('combat_action_desc') ||
          staticDataSection.includes('enemy_desc') ||
          staticDataSection.includes('weapon_desc');
        expect(hasCombatStatic).toBe(true);
      });

      it('should include static data tables for equipment/tools', () => {
        // Given: Equipment and tools are key game systems requiring static data
        // When: We look for equipment-related static data tables
        // Then: Equipment static data tables like equipment_desc, tool_desc are documented
        const staticDataSection =
          extractSection(content, 'Static Data Tables by Game System') ||
          extractSection(content, 'Static Data Tables Categorized') ||
          content;

        const hasEquipmentStatic =
          staticDataSection.includes('equipment_desc') || staticDataSection.includes('tool_desc');
        expect(hasEquipmentStatic).toBe(true);
      });
    });

    // ==========================================================================
    // Entity mapping table format validation (AC1 extended)
    // ==========================================================================
    describe('Entity mapping table format validation', () => {
      it('should include a "Mutated By" or similar column documenting which reducers modify each table', () => {
        // Given: Entity tables are documented with structured table format
        // When: We check for a column indicating what modifies each table
        // Then: A "Mutated By" or equivalent column exists
        const stateModelSection = extractSection(content, 'Entity-to-Concept Mapping') || '';
        const hasMutatedBy =
          /\|\s*Mutated\s+By\s*\|/i.test(stateModelSection) ||
          /\|\s*Modified\s+By\s*\|/i.test(stateModelSection) ||
          /\|\s*Written\s+By\s*\|/i.test(stateModelSection);
        expect(hasMutatedBy).toBe(true);
      });

      it('should document the total entity table count (138 tables)', () => {
        // Given: The story's Definition of Done states "138 tables mapped"
        // When: We check for the count in the State Model section
        // Then: The 138 count is documented
        const stateModelSection = extractSection(content, 'State Model') || '';
        expect(stateModelSection).toContain('138');
      });

      it('should document the static data table count (108 tables)', () => {
        // Given: The story found 108 unique static data tables
        // When: We check for the count in the State Model section
        // Then: The 108 count is documented
        const stateModelSection = extractSection(content, 'State Model') || '';
        expect(stateModelSection).toContain('108');
      });
    });
  }
);
