import crypto from "crypto";

export const VECTOR_DIM = 384;

let transformersPipeline = null;
let useTransformers = null;

/**
 * Try to load the Transformers.js pipeline for high-quality embeddings.
 * Falls back to hash-based embeddings if the model can't be loaded.
 */
async function tryLoadTransformers() {
  if (useTransformers !== null) return useTransformers;

  try {
    const { pipeline } = await import("@xenova/transformers");
    transformersPipeline = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
    useTransformers = true;
  } catch {
    useTransformers = false;
  }
  return useTransformers;
}

/**
 * Hash-based embedding: deterministic, zero-dependency fallback.
 * Uses multiple seeded hashes to produce a stable vector from text.
 * Not as semantically rich as a neural model, but works offline
 * and still provides useful similarity for exact/near-exact matches.
 */
function hashEmbed(text) {
  const normalized = text.toLowerCase().trim();
  const vector = new Float32Array(VECTOR_DIM);

  // Generate overlapping n-gram features
  const tokens = normalized.split(/\s+/);
  const features = new Set();

  // Unigrams
  for (const t of tokens) features.add(t);
  // Bigrams
  for (let i = 0; i < tokens.length - 1; i++)
    features.add(`${tokens[i]} ${tokens[i + 1]}`);
  // Character trigrams for fuzzy matching
  for (let i = 0; i < normalized.length - 2; i++)
    features.add(`_${normalized.slice(i, i + 3)}`);

  // Hash each feature into multiple vector positions
  for (const feature of features) {
    for (let seed = 0; seed < 4; seed++) {
      const hash = crypto
        .createHash("sha256")
        .update(`${seed}:${feature}`)
        .digest();
      for (let j = 0; j < 8; j++) {
        const idx = hash.readUInt16BE(j * 2) % VECTOR_DIM;
        const sign = hash[16 + (j % 16)] & 1 ? 1 : -1;
        vector[idx] += sign * (1.0 / Math.sqrt(features.size));
      }
    }
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < VECTOR_DIM; i++) vector[i] /= norm;

  return Array.from(vector);
}

/**
 * Generate a 384-dimensional embedding vector for the given text.
 * Uses Transformers.js (all-MiniLM-L6-v2) when available, falls back to hash-based.
 */
export async function embed(text) {
  const hasTransformers = await tryLoadTransformers();

  if (hasTransformers && transformersPipeline) {
    const output = await transformersPipeline(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  }

  return hashEmbed(text);
}
