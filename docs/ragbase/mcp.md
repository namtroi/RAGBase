# Centralized MCP Gateway Design

## 1. Core Concept
- **Single Vector Database**: All 5 million+ chunks (Immigration + 50 states Family Laws) in one Qdrant cluster.
- **Single MCP Server**: One centralized Node.js Gateway.
- **Dynamic Tooling**: Exposes specific search tools to LLM (Claude/Cursor) based on client API Key.
- **Strict Data Isolation**: Enforced via Qdrant payload filtering at the gateway level.

## 2. High-Level Architecture

```mermaid
graph TD
    Client["Client (Claude Desktop / Cursor)"]
    Gateway["Node.js MCP Gateway"]
    PG[("PostgreSQL\n(Auth & Subscriptions)")]
    Qdrant[("Qdrant\n(Centralized Vector DB)")]

    Client -->|1. Connect + API Key| Gateway
    Gateway -->|2. Validate Key| PG
    PG -.->|3. Sub Data (e.g. TX, CA)| Gateway
    Gateway -.->|4. Expose Tools\n(search_tx_law)| Client
    
    Client -->|5. Call Tool (Query)| Gateway
    Gateway -->|6. Inject Metadata Filters| Gateway
    Gateway -->|7. Vector Search| Qdrant
    Qdrant -.->|8. Return Chunks| Gateway
    Gateway -.->|9. Return Context| Client
```

## 3. Data Schema

### Vector Payload (Qdrant)
Crucial indices for fast filtering.
- `domain`: `immigration` | `family_law`
- `state`: `ALL` | `TX` | `CA` | ...
- `doc_id`: UUID
- `text`: string

### Subscription Model (PostgreSQL)
- `tenant_id`: UUID
- `api_key_hash`: string
- `subscriptions`: JSONB -> `{"immigration": true, "family_law": ["TX", "CA"]}`

## 4. Request Flow

### A. Initialization (Dynamic Tool Registration)
1. Client connects to MCP Gateway.
2. Gateway verifies API Key in Postgres.
3. Gateway reads `subscriptions`.
4. Gateway dynamically constructs tool list.
   - Example A (Texas Only): `list_tools` returns `["search_texas_family_laws"]`
   - Example B (Full Access): `list_tools` returns `["search_immigration_laws", "search_all_family_laws"]`
5. LLM receives clean, narrow tool scopes. Reduces hallucination.

### B. Execution (Metadata Filtering)
1. LLM executes tool: `search_texas_family_laws(query: "child custody divorce")`
2. MCP Server captures request.
3. Server **hardcodes** filters preventing unauthorized access.
```json
{
  "filter": {
    "must": [
      { "key": "domain", "match": { "value": "family_law" } },
      { "key": "state", "match": { "value": "TX" } }
    ]
  }
}
```
4. Query sent to Qdrant. Context returned to LLM.

## 5. Deployment
- **Infra**: AWS ECS or EC2 Docker Compose.
- **Gateway**: Node.js + official `@modelcontextprotocol/sdk`.
- **Clients**: Install via `mcp.json` config pointing to your hosted SSE endpoint or running a secure local proxy connecting to your remote server.

## 6. Detailed Implementation Guide

### A. The Node.js MCP Server Setup
The gateway relies on the official Model Context Protocol TypeScript SDK. It uses **Server-Sent Events (SSE)** for external client connections since standard STDIO routing is difficult across the internet.

**Core Dependencies:**
```bash
npm install @modelcontextprotocol/sdk pg @qdrant/js-client-rest fastify
```

### B. Gateway Initialization & Auth Middleware
When a client connects (e.g., Claude Desktop via a proxy), they pass their API key in the connection headers/URL. The server hooks into this to load their subscription profile.

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import fastify from "fastify";

const server = fastify();
const mcp = new McpServer({ name: "RAGBase-Law-Gateway", version: "1.0.0" });

// Store active client transports and their validated subscription logic
const activeClients = new Map<string, { transport: SSEServerTransport, subs: any }>();

server.get("/sse", async (req, res) => {
  const apiKey = req.headers['authorization']?.split(' ')[1];
  
  // 1. Validate API Key against PostgreSQL
  const userSubs = await validateApiKey(apiKey); 
  if (!userSubs) return res.status(401).send("Invalid Key");

  // 2. Establish SSE Transport
  const transport = new SSEServerTransport("/messages", res);
  await mcp.connect(transport);
  
  // 3. Store session metadata
  const sessionId = generateUUID();
  activeClients.set(sessionId, { transport, subs: userSubs });
});
```

### C. Dynamic Tool Registration Strategy
Instead of defining static tools, we define a core search function and expose it via dynamically generated tools tailored to the user's `userSubs`.

```typescript
// Core Vector Search Logic (Internal)
async function performVectorSearch(query: string, domain: string, state: string) {
  // 1. Embed Query
  const queryVector = await embedQuery(query); 
  
  // 2. Query Qdrant with STRICT METADATA FILTERS
  const results = await qdrantClient.search("law_collection", {
    vector: queryVector,
    filter: {
      must: [
        { key: "domain", match: { value: domain } },
        { key: "state", match: { value: state } }
      ]
    },
    limit: 10
  });

  return results.map(r => r.payload.text).join("\n\n");
}

// ---------------------------------------------------------
// How Tools are Registered Dynamically based on the session
// ---------------------------------------------------------
// When Claude asks for tools, the MCP SDK calls the ListTools endpoint.
// We intercept or dynamically construct the tool definitions.

function registerClientTools(mcpServer: McpServer, userSubs: any) {
  // If they have immigration law access:
  if (userSubs.immigration) {
    mcpServer.tool(
      "search_immigration_laws",
      "Search federal immigration laws, statutes, and guidelines.",
      { query: z.string().describe("The search query (e.g. H1B visa requirements)") },
      async ({ query }) => {
        const text = await performVectorSearch(query, "immigration", "ALL");
        return { content: [{ type: "text", text }] };
      }
    );
  }

  // If they have specific family law state access:
  if (userSubs.family_law && userSubs.family_law.length > 0) {
    for (const stateCode of userSubs.family_law) {
      mcpServer.tool(
        `search_family_law_${stateCode.toLowerCase()}`,
        `Search family law documents specifically for the state of ${stateCode}.`,
        { query: z.string().describe("Specific legal concept to search") },
        async ({ query }) => {
          // Hardcoded state filter injection here ensures security
          const text = await performVectorSearch(query, "family_law", stateCode);
          return { content: [{ type: "text", text }] };
        }
      );
    }
  }
}
```

### D. The Crucial Security Principle (Zero Hallucination Routing)
By registering tools dynamically:
1. **Claude never "guesses" the state**: If you gave a generic `search_law(state, query)` tool, the LLM might hallucinate accessing `state="NY"` when the user only paid for `TX`.
2. **Context Window Optimization**: Claude only sees tools for what it owns, saving tokens and improving reasoning focus.
3. **Impenetrable Data Isolation**: The `performVectorSearch` function securely binds the `domain` and `state` parameters *on the server side* inside the closure. The client/LLM literally cannot manipulate the Qdrant filter payload.

