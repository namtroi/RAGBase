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
    PG[("PostgreSQL <br/> (Auth & Subscriptions)")]
    Qdrant[("Qdrant <br/> (Centralized Vector DB)")]

    Client -->|1. Connect + API Key| Gateway
    Gateway -->|2. Validate Key| PG
    PG -.->|3. Sub Data (e.g. TX, CA)| Gateway
    Gateway -.->|4. Expose Tools <br/> (search_tx_law)| Client
    
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
The gateway is built using Node.js and the official Model Context Protocol SDK. It uses **Server-Sent Events (SSE)** for external client connections. This is chosen because standard STDIO routing is difficult to expose securely across the internet.

### B. Gateway Initialization & Auth Middleware
When a client application (like Claude Desktop) connects to the gateway, it provides an API key in the connection headers/URL.
1. The server intercepts this connection request and validates the API key against the PostgreSQL database.
2. It retrieves the subscriber's specific data permissions (e.g., access to Immigration Law, or specific Texas Family Law).
3. If valid, an SSE transport session is established and tied to those specific permissions.

### C. Dynamic Tool Registration Strategy
Instead of defining a static list of tools for every user, the server dynamically generates the tools based on the user's validated subscriptions.
- If a user only has access to Texas data, the server registers a single tool specifically named for Texas (e.g., `search_family_law_tx`).
- If a user has full access, the server registers tools for all available domains.

When the LLM asks the server what tools are available, it only sees the tools it is authorized to use. Behind the scenes, all tools route to a single core search function, but with hardcoded domain and state metadata filters applied server-side.

### D. The Crucial Security Principle (Zero Hallucination Routing)
By registering tools dynamically:
1. **No LLM Guesswork**: The LLM is never given a generic search tool where it has to "guess" or provide the state code. This prevents the LLM from hallucinating and attempting to access data the user hasn't paid for.
2. **Optimized Context Window**: The LLM only receives tool definitions relevant to the user's subscription, saving tokens and keeping the AI focused.
3. **Impenetrable Data Isolation**: Because the metadata filters (like `state=TX`) are hardcoded into the dynamically generated tool on the server side, the client or LLM cannot manipulate the vector database filter query.

