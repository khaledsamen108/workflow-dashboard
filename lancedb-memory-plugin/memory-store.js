import * as lancedb from "@lancedb/lancedb";
import { embed, VECTOR_DIM } from "./embeddings.js";
import path from "path";
import os from "os";
import fs from "fs";

const DB_DIR = path.join(os.homedir(), ".claude", "lancedb-memory");
const TABLE_NAME = "memories";

let db = null;
let table = null;

/**
 * Connect to LanceDB and ensure the memories table exists.
 */
async function getTable() {
  if (table) return table;

  fs.mkdirSync(DB_DIR, { recursive: true });
  db = await lancedb.connect(DB_DIR);

  const tableNames = await db.tableNames();
  if (tableNames.includes(TABLE_NAME)) {
    table = await db.openTable(TABLE_NAME);
  } else {
    // Create with a seed record, then delete it
    const seedVector = new Array(VECTOR_DIM).fill(0);
    table = await db.createTable(TABLE_NAME, [
      {
        id: "__seed__",
        text: "",
        category: "",
        tags: "",
        created_at: "",
        updated_at: "",
        vector: seedVector,
      },
    ]);
    await table.delete('id = "__seed__"');
  }

  return table;
}

function generateId() {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function now() {
  return new Date().toISOString();
}

/**
 * Store a new memory.
 */
export async function storeMemory(text, category = "general", tags = "") {
  const tbl = await getTable();
  const vector = await embed(text);
  const id = generateId();
  const timestamp = now();

  await tbl.add([
    {
      id,
      text,
      category,
      tags,
      created_at: timestamp,
      updated_at: timestamp,
      vector,
    },
  ]);

  return { id, created_at: timestamp };
}

/**
 * Search memories by semantic similarity.
 */
export async function searchMemories(query, limit = 5, category = null) {
  const tbl = await getTable();
  const queryVector = await embed(query);

  let search = tbl.search(queryVector).limit(limit);

  const results = await search.toArray();

  // Filter by category in JS if specified (LanceDB filter syntax varies by version)
  let filtered = results;
  if (category) {
    filtered = results.filter((r) => r.category === category);
  }

  return filtered.map((r) => ({
    id: r.id,
    text: r.text,
    category: r.category,
    tags: r.tags,
    created_at: r.created_at,
    updated_at: r.updated_at,
    distance: r._distance,
  }));
}

/**
 * List all memories, optionally filtered by category.
 */
export async function listMemories(category = null, limit = 20) {
  const tbl = await getTable();
  let results = await tbl.query().limit(limit).toArray();

  if (category) {
    results = results.filter((r) => r.category === category);
  }

  return results.map((r) => ({
    id: r.id,
    text: r.text,
    category: r.category,
    tags: r.tags,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

/**
 * Delete a memory by ID.
 */
export async function deleteMemory(id) {
  const tbl = await getTable();
  await tbl.delete(`id = "${id}"`);
  return { deleted: id };
}

/**
 * Update a memory's text (re-embeds it).
 */
export async function updateMemory(id, newText, category = null) {
  const tbl = await getTable();

  // Find existing
  const existing = await tbl.query().limit(1000).toArray();
  const record = existing.find((r) => r.id === id);
  if (!record) {
    throw new Error(`Memory with id "${id}" not found`);
  }

  // Delete old and insert updated
  await tbl.delete(`id = "${id}"`);

  const vector = await embed(newText);
  const timestamp = now();

  await tbl.add([
    {
      id,
      text: newText,
      category: category || record.category,
      tags: record.tags,
      created_at: record.created_at,
      updated_at: timestamp,
      vector,
    },
  ]);

  return { id, updated_at: timestamp };
}
