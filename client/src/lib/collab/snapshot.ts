import * as Y from 'yjs';

export interface PersistedDocState {
  snapshot: string | null;
  updates: string[];
  version: string;
}

function decodeBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

/** Merge every persisted update, even when this client missed a peer's final edits. */
export function buildCompactSnapshot(local: Uint8Array, state: PersistedDocState): string {
  const merged = new Y.Doc();
  try {
    Y.applyUpdate(merged, local);
    if (state.snapshot) Y.applyUpdate(merged, decodeBase64(state.snapshot));
    for (const update of state.updates) Y.applyUpdate(merged, decodeBase64(update));
    const bytes = Y.encodeStateAsUpdate(merged);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  } finally {
    merged.destroy();
  }
}
