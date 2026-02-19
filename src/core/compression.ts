import type {
  CapturedSession,
  CompressionOptions,
  CompressionResult,
  PriorityLayer,
} from "../types/index.js";

/**
 * Compression engine using priority-layered packing.
 * Takes a CapturedSession and a token budget, produces compressed content.
 */
export function compress(
  session: CapturedSession,
  options: CompressionOptions
): CompressionResult {
  // TODO: Build priority layers and pack within token budget
  throw new Error("Not implemented");
}

/**
 * Build all priority layers from a captured session.
 */
export function buildLayers(session: CapturedSession): PriorityLayer[] {
  // TODO: Build layers 1-7 as specified in the PRD
  throw new Error("Not implemented");
}
