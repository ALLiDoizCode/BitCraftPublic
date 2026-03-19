# PREP-E6-3: MCP Protocol SDK Review

**Date:** 2026-03-19
**Purpose:** Evaluate the official MCP TypeScript SDK for use in `@sigil/mcp-server` (Epic 6)

---

## 1. Package Selection

### Recommended: `@modelcontextprotocol/sdk` v1.27.x (stable)

The official TypeScript SDK is published as `@modelcontextprotocol/sdk` on npm. The current stable release is **v1.27.1** (published late February 2026).

**Install command:**
```bash
pnpm add @modelcontextprotocol/sdk zod
```

**Required peer dependency:** `zod` (v4) -- used for tool input/output schema validation.

**Note on v2:** The SDK repository (`main` branch) shows a v2.0.0-alpha.0 monorepo restructure that splits into `@modelcontextprotocol/server` and `@modelcontextprotocol/client` as separate packages. v2 is still alpha and not recommended for production use. We should target **v1.27.x** for Epic 6 and plan a migration to v2 when it stabilizes (likely after MVP).

### Package.json Changes for `@sigil/mcp-server`

Current dependencies only include `@sigil/client`. Epic 6.1 will add:

```json
{
  "dependencies": {
    "@sigil/client": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.27.0"
  },
  "peerDependencies": {
    "zod": "^3.22.0"
  }
}
```

---

## 2. Key API Surface

### Import Paths (v1.27.x)

```typescript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
```

### Creating an MCP Server

```typescript
const server = new McpServer(
  { name: "sigil-mcp-server", version: "0.1.0" },
  { capabilities: { logging: {} } }
);
```

Constructor takes two arguments:
1. **Server metadata** -- `{ name: string, version: string }`
2. **Options** (optional) -- `{ capabilities: { logging?: {}, tasks?: {} } }`

### Registering Tools

Tools are game write actions (reducers) in our architecture. Registration uses `server.registerTool()`:

```typescript
server.registerTool(
  "move_player",                          // tool name (snake_case per AGREEMENT)
  {
    title: "Move Player",
    description: "Move the player to a new position",
    inputSchema: z.object({
      x: z.number().describe("X coordinate"),
      y: z.number().describe("Y coordinate"),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      position: z.object({ x: z.number(), y: z.number() }),
    }),
  },
  async ({ x, y }, ctx) => {
    // ctx.mcpReq.log() for structured logging
    await ctx.mcpReq.log("info", `Moving player to ${x}, ${y}`);

    // Call @sigil/client for actual game action
    const result = await client.publish(/* ... */);

    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  }
);
```

**Key patterns:**
- Handler receives `(args, ctx)` -- args are the validated input, ctx provides `mcpReq` for logging and sampling
- Return type includes both `content` (text/resource_link for display) and `structuredContent` (typed output)
- `resource_link` content type can reference MCP resources without embedding data

### Registering Resources

Resources are game state (read) in our architecture. Two patterns:

**Static resource (fixed URI):**
```typescript
server.registerResource(
  "server-status",                        // resource name
  "sigil://status",                       // fixed URI
  {
    title: "Server Status",
    description: "Current game server connection status",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [{ uri: uri.href, text: JSON.stringify(status) }],
  })
);
```

**Dynamic resource with URI template (parameterized):**
```typescript
server.registerResource(
  "player-profile",                       // resource name
  new ResourceTemplate("sigil://players/{playerId}", {
    list: async () => ({
      resources: connectedPlayers.map(p => ({
        uri: `sigil://players/${p.id}`,
        name: p.name,
      })),
    }),
  }),
  {
    title: "Player Profile",
    description: "Player game state and inventory",
    mimeType: "application/json",
  },
  async (uri, { playerId }) => ({
    contents: [{ uri: uri.href, text: JSON.stringify(await client.getPlayer(playerId)) }],
  })
);
```

**Key patterns:**
- `ResourceTemplate` handles URI pattern matching and parameter extraction
- The `list` callback enables resource discovery (clients can enumerate available resources)
- Handler receives `(uri, params)` where params are extracted from the URI template

### Setting Up Stdio Transport

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

This is the standard transport for local process-spawned MCP servers (Claude Desktop, Claude Code, etc.). The server communicates over stdin/stdout.

---

## 3. Mapping to Planned Architecture

The SDK maps cleanly to our planned directory structure from `project-structure-boundaries.md`:

| Planned File | SDK Mapping | Purpose |
|---|---|---|
| `src/index.ts` | Entry point | Import server, register all tools/resources, connect transport |
| `src/server.ts` | `new McpServer(...)` + `new StdioServerTransport()` | Server configuration and transport setup |
| `src/tools/index.ts` | `server.registerTool()` calls | Aggregate tool registration from sub-modules |
| `src/tools/game-actions.ts` | Individual `registerTool()` per reducer | MCP tools wrapping `@sigil/client` write actions |
| `src/tools/world-queries.ts` | Individual `registerTool()` per query | MCP tools for read queries (alternative to resources) |
| `src/resources/index.ts` | `server.registerResource()` calls | Aggregate resource registration from sub-modules |
| `src/resources/players.ts` | `ResourceTemplate("sigil://players/{id}")` | Player state as MCP resource |
| `src/resources/planets.ts` | `ResourceTemplate("sigil://planets/{id}")` | Planet state as MCP resource |
| `src/resources/teams.ts` | `ResourceTemplate("sigil://teams/{id}")` | Team state as MCP resource |
| `src/resources/inventory.ts` | `ResourceTemplate("sigil://inventory/{playerId}")` | Inventory as MCP resource |

### Recommended Module Pattern

Each resource/tool file should export a registration function that accepts the server and client:

```typescript
// src/resources/players.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SigilClient } from "@sigil/client";

export function registerPlayerResources(server: McpServer, client: SigilClient): void {
  server.registerResource(
    "player",
    new ResourceTemplate("sigil://players/{playerId}", {
      list: async () => ({ resources: /* ... */ }),
    }),
    { title: "Player", description: "Player game state", mimeType: "application/json" },
    async (uri, { playerId }) => ({
      contents: [{ uri: uri.href, text: JSON.stringify(await client.getPlayer(playerId)) }],
    })
  );
}
```

Then `src/resources/index.ts` aggregates:

```typescript
export function registerAllResources(server: McpServer, client: SigilClient): void {
  registerPlayerResources(server, client);
  registerPlanetResources(server, client);
  registerTeamResources(server, client);
  registerInventoryResources(server, client);
}
```

---

## 4. Notable Patterns and Constraints

### Constraint: Zod Required for Schemas

All tool input/output schemas must be defined using Zod. This is a hard requirement, not optional. Zod is already widely used in the TypeScript ecosystem and adds ~50KB to the bundle. Since `@sigil/client` does not currently depend on Zod, this will be a new dependency scoped to `@sigil/mcp-server`.

### Constraint: Stdio Transport is Synchronous

`StdioServerTransport` uses stdin/stdout, which means the MCP server process cannot use `console.log` for debugging (it would corrupt the MCP protocol stream). Use `ctx.mcpReq.log()` for structured logging that goes through the MCP protocol instead.

### Pattern: Tools vs Resources

The MCP protocol distinguishes:
- **Resources** = read-only game state (GET semantics). Clients can subscribe to updates. Maps to our SpacetimeDB subscriptions.
- **Tools** = actions with side effects (POST semantics). Maps to our reducer calls via `client.publish()`.

This aligns perfectly with our architecture's "Tools = game actions, Resources = game state" boundary (Boundary 3 in project-structure-boundaries.md).

### Pattern: Structured Content (Output Schemas)

v1.27 supports `outputSchema` on tools with `structuredContent` in return values. This enables typed responses that AI agents can parse programmatically, rather than relying on text parsing. We should define output schemas for all tools.

### Pattern: Resource Links from Tools

Tools can return `resource_link` content items that reference MCP resources by URI. This is useful for tools that create or modify game state -- they can return a link to the updated resource rather than embedding the full state. Example: a `move_player` tool returns a `resource_link` to `sigil://players/{id}` so the agent can fetch the updated state.

### Pattern: Server Logging via Context

The `capabilities: { logging: {} }` option enables structured logging through the MCP protocol. Tool handlers receive a `ctx` parameter with `ctx.mcpReq.log(level, data)`. This is the correct way to emit logs from an MCP server (not `console.log`).

### Constraint: Single Server Instance

The MCP SDK expects one `McpServer` instance per process, connected to one transport. For our stdio-based architecture, this is natural -- one `@sigil/mcp-server` process per connected AI agent.

### Testing Pattern

Tools and resources can be tested by:
1. Creating an `McpServer` instance in tests
2. Registering tools/resources with mock `@sigil/client` instances
3. Using the SDK's `Client` class to connect via in-memory transport
4. Calling tools/reading resources through the client and asserting results

The SDK provides `InMemoryTransport` for testing (no need for stdio in unit tests).

---

## 5. Risk Assessment

| Risk | Mitigation |
|---|---|
| v2 breaking changes | Pin to `^1.27.0`, monitor v2 alpha. Migration path is clear (rename imports). |
| Zod version conflicts | Use `peerDependencies` to let consumers control Zod version. |
| Stdio debugging difficulty | Use MCP logging capability + separate log file for development. |
| SDK maturity | 34,700+ downstream packages, well-maintained, Anthropic-backed. Low risk. |

---

## 6. Summary

The `@modelcontextprotocol/sdk` v1.27.x is production-ready and maps directly to our planned architecture. Key actions for Epic 6.1:

1. Add `@modelcontextprotocol/sdk@^1.27.0` and `zod` to `@sigil/mcp-server` dependencies
2. Create `server.ts` with `McpServer` + `StdioServerTransport` setup
3. Establish the `tools/` and `resources/` directory structure with registration pattern
4. Use `ResourceTemplate` for parameterized `sigil://` URIs
5. Enable `logging` capability from the start
6. Use `InMemoryTransport` for unit testing
