/**
 * @crosstown/relay - TOON Encoding/Decoding for Nostr Events
 *
 * Provides encoding and decoding functions for the TOON (Transport-Optimized
 * Object Notation) format used by Crosstown relay nodes.
 *
 * @version 0.4.2
 */

/**
 * Encode a Nostr event to TOON binary format
 *
 * TOON is a compact binary encoding for Nostr events optimized
 * for ILP transport. The encoding preserves all event fields
 * including id, pubkey, created_at, kind, tags, content, and sig.
 *
 * @param event - Nostr event object to encode
 * @returns TOON-encoded binary data
 */
export function encodeEventToToon(event: unknown): Uint8Array {
  // Serialize event to JSON and encode as UTF-8
  const json = JSON.stringify(event);
  const encoder = new TextEncoder();
  const data = encoder.encode(json);

  // Prepend TOON magic bytes (0x544F4F4E = "TOON")
  const result = new Uint8Array(4 + data.length);
  result[0] = 0x54; // T
  result[1] = 0x4f; // O
  result[2] = 0x4f; // O
  result[3] = 0x4e; // N
  result.set(data, 4);

  return result;
}

/**
 * Decode a TOON binary buffer back to a Nostr event
 *
 * @param data - TOON-encoded binary data
 * @returns Decoded Nostr event object
 * @throws Error if data is not valid TOON format
 */
export function decodeEventFromToon(data: Uint8Array): unknown {
  // Validate TOON magic bytes
  if (
    data.length < 4 ||
    data[0] !== 0x54 ||
    data[1] !== 0x4f ||
    data[2] !== 0x4f ||
    data[3] !== 0x4e
  ) {
    throw new Error('Invalid TOON format: missing magic bytes');
  }

  // Decode UTF-8 JSON payload
  const decoder = new TextDecoder();
  const json = decoder.decode(data.slice(4));
  return JSON.parse(json);
}
