#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  storeMemory,
  searchMemories,
  listMemories,
  deleteMemory,
  updateMemory,
} from "./memory-store.js";

const server = new McpServer({
  name: "lancedb-memory",
  version: "1.0.0",
});

// ── Tool: store_memory ──────────────────────────────────────────────
server.tool(
  "store_memory",
  "Store a piece of information in long-term memory. Use this to remember facts, decisions, user preferences, code patterns, or anything worth recalling later.",
  {
    text: z.string().describe("The content to remember"),
    category: z
      .string()
      .optional()
      .describe(
        'Category for organization (e.g. "preference", "decision", "fact", "code-pattern", "project-context")'
      ),
    tags: z
      .string()
      .optional()
      .describe("Comma-separated tags for filtering"),
  },
  async ({ text, category, tags }) => {
    const result = await storeMemory(text, category || "general", tags || "");
    return {
      content: [
        {
          type: "text",
          text: `Stored memory ${result.id} at ${result.created_at}`,
        },
      ],
    };
  }
);

// ── Tool: search_memory ─────────────────────────────────────────────
server.tool(
  "search_memory",
  "Search long-term memory using semantic similarity. Returns the most relevant memories for a given query.",
  {
    query: z.string().describe("Natural language search query"),
    limit: z
      .number()
      .optional()
      .describe("Max results to return (default: 5)"),
    category: z
      .string()
      .optional()
      .describe("Filter by category"),
  },
  async ({ query, limit, category }) => {
    const results = await searchMemories(query, limit || 5, category || null);

    if (results.length === 0) {
      return {
        content: [{ type: "text", text: "No matching memories found." }],
      };
    }

    const formatted = results
      .map(
        (r, i) =>
          `[${i + 1}] (${r.category}) ${r.text}\n    id: ${r.id} | distance: ${r.distance?.toFixed(3) ?? "N/A"} | tags: ${r.tags || "none"} | created: ${r.created_at}`
      )
      .join("\n\n");

    return {
      content: [
        { type: "text", text: `Found ${results.length} memories:\n\n${formatted}` },
      ],
    };
  }
);

// ── Tool: list_memories ─────────────────────────────────────────────
server.tool(
  "list_memories",
  "List stored memories, optionally filtered by category.",
  {
    category: z
      .string()
      .optional()
      .describe("Filter by category"),
    limit: z
      .number()
      .optional()
      .describe("Max results (default: 20)"),
  },
  async ({ category, limit }) => {
    const results = await listMemories(category || null, limit || 20);

    if (results.length === 0) {
      return {
        content: [{ type: "text", text: "No memories stored yet." }],
      };
    }

    const formatted = results
      .map(
        (r) =>
          `- [${r.category}] ${r.text}\n  id: ${r.id} | tags: ${r.tags || "none"} | created: ${r.created_at}`
      )
      .join("\n\n");

    return {
      content: [
        { type: "text", text: `${results.length} memories:\n\n${formatted}` },
      ],
    };
  }
);

// ── Tool: delete_memory ─────────────────────────────────────────────
server.tool(
  "delete_memory",
  "Delete a specific memory by its ID.",
  {
    id: z.string().describe("The memory ID to delete"),
  },
  async ({ id }) => {
    const result = await deleteMemory(id);
    return {
      content: [{ type: "text", text: `Deleted memory: ${result.deleted}` }],
    };
  }
);

// ── Tool: update_memory ─────────────────────────────────────────────
server.tool(
  "update_memory",
  "Update the text of an existing memory. The embedding is automatically recomputed.",
  {
    id: z.string().describe("The memory ID to update"),
    text: z.string().describe("The new text content"),
    category: z
      .string()
      .optional()
      .describe("Optionally update the category"),
  },
  async ({ id, text, category }) => {
    try {
      const result = await updateMemory(id, text, category || null);
      return {
        content: [
          {
            type: "text",
            text: `Updated memory ${result.id} at ${result.updated_at}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ── Start server ────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LanceDB Memory MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
