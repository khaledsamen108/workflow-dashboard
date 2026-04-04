# LanceDB Memory Plugin for Claude Code

A Model Context Protocol (MCP) server that gives Claude Code persistent, semantic memory using [LanceDB](https://lancedb.com/) as a local vector database.

## Features

- **Persistent memory** — facts, decisions, preferences, and code patterns survive across sessions
- **Semantic search** — find relevant memories by meaning, not just keywords
- **Local embeddings** — uses `all-MiniLM-L6-v2` via Transformers.js (no API keys needed)
- **Zero infrastructure** — LanceDB stores everything as local files, no server required
- **Categorized storage** — organize memories by type (preference, decision, fact, code-pattern, etc.)

## MCP Tools

| Tool | Description |
|------|-------------|
| `store_memory` | Save text with optional category and tags |
| `search_memory` | Semantic similarity search across all memories |
| `list_memories` | List stored memories, optionally filtered by category |
| `update_memory` | Update an existing memory (re-embeds automatically) |
| `delete_memory` | Remove a memory by ID |

## Setup

### 1. Install dependencies

```bash
cd lancedb-memory-plugin
npm install
```

### 2. Configure Claude Code

The `.mcp.json` file at the project root registers this plugin automatically. If you want to install it globally, add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "lancedb-memory": {
      "command": "node",
      "args": ["/absolute/path/to/lancedb-memory-plugin/server.js"]
    }
  }
}
```

### 3. Use it

Once configured, Claude Code will have access to memory tools. Examples:

- **"Remember that I prefer TypeScript over JavaScript"** → stores a preference
- **"What do you remember about my coding style?"** → semantic search
- **"List all my stored decisions"** → filtered list

## Storage

Memories are stored at `~/.claude/lancedb-memory/` as LanceDB files. Each memory includes:

- `id` — unique identifier
- `text` — the content
- `vector` — 384-dimensional embedding (all-MiniLM-L6-v2)
- `category` — organizational label
- `tags` — comma-separated tags
- `created_at` / `updated_at` — timestamps

## Architecture

```
server.js          — MCP server with tool definitions
memory-store.js    — LanceDB CRUD operations
embeddings.js      — Local embedding generation (Transformers.js)
```
