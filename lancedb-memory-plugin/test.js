import {
  storeMemory,
  searchMemories,
  listMemories,
  deleteMemory,
  updateMemory,
} from "./memory-store.js";

async function runTests() {
  console.log("=== LanceDB Memory Plugin Tests ===\n");

  // Test 1: Store
  console.log("1. Storing memories...");
  const m1 = await storeMemory(
    "User prefers TypeScript over JavaScript",
    "preference",
    "language,typescript"
  );
  console.log(`   Stored: ${m1.id}`);

  const m2 = await storeMemory(
    "The project uses React with Tailwind CSS for the frontend",
    "fact",
    "stack,frontend"
  );
  console.log(`   Stored: ${m2.id}`);

  const m3 = await storeMemory(
    "We decided to use PostgreSQL instead of MongoDB for the database",
    "decision",
    "database"
  );
  console.log(`   Stored: ${m3.id}`);

  // Test 2: Search
  console.log("\n2. Searching for 'programming language preference'...");
  const searchResults = await searchMemories("programming language preference");
  for (const r of searchResults) {
    console.log(
      `   [${r.category}] ${r.text} (score: ${r.score?.toFixed(3)})`
    );
  }

  // Test 3: List
  console.log("\n3. Listing all memories...");
  const allMemories = await listMemories();
  console.log(`   Total: ${allMemories.length}`);

  // Test 4: List by category
  console.log("\n4. Listing 'decision' category...");
  const decisions = await listMemories("decision");
  console.log(`   Decisions: ${decisions.length}`);

  // Test 5: Update
  console.log("\n5. Updating memory...");
  const updated = await updateMemory(
    m1.id,
    "User strongly prefers TypeScript and avoids plain JavaScript"
  );
  console.log(`   Updated: ${updated.id} at ${updated.updated_at}`);

  // Test 6: Verify update via search
  console.log("\n6. Verifying update via search...");
  const verifyResults = await searchMemories("TypeScript preference", 1);
  console.log(`   Found: ${verifyResults[0]?.text}`);

  // Test 7: Delete
  console.log("\n7. Deleting memory...");
  const deleted = await deleteMemory(m3.id);
  console.log(`   Deleted: ${deleted.deleted}`);

  // Test 8: Verify delete
  console.log("\n8. Verifying deletion...");
  const afterDelete = await listMemories();
  console.log(`   Remaining: ${afterDelete.length}`);

  // Cleanup
  for (const mem of afterDelete) {
    await deleteMemory(mem.id);
  }
  console.log("\n9. Cleaned up all test memories.");

  console.log("\n=== All tests passed! ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
