import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import { buildCompactSnapshot } from '../src/lib/collab/snapshot.ts';

const base64 = (bytes) => Buffer.from(bytes).toString('base64');
function restore(local, state) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(buildCompactSnapshot(local, state), 'base64'));
  const result = doc.getText('body').toString();
  doc.destroy();
  return result;
}

test('includes a peer edit missing from the leaving client', () => {
  const peer = new Y.Doc();
  peer.getText('body').insert(0, 'A');
  const local = Y.encodeStateAsUpdate(peer);
  const vector = Y.encodeStateVector(peer);
  peer.getText('body').insert(1, 'B');
  const missed = Y.encodeStateAsUpdate(peer, vector);
  assert.equal(restore(local, { snapshot: base64(local), updates: [base64(missed)] }), 'AB');
  peer.destroy();
});

test('preserves remote deletions and works after the original document is destroyed', () => {
  const peer = new Y.Doc();
  peer.getText('body').insert(0, 'AB');
  const local = Y.encodeStateAsUpdate(peer);
  const vector = Y.encodeStateVector(peer);
  peer.getText('body').delete(0, 1);
  const deletion = Y.encodeStateAsUpdate(peer, vector);
  peer.destroy();
  assert.equal(restore(local, { snapshot: null, updates: [base64(local), base64(deletion)] }), 'B');
});

test('keeps unsent local edits while merging the persisted state', () => {
  const doc = new Y.Doc();
  doc.getText('body').insert(0, 'A');
  const persisted = Y.encodeStateAsUpdate(doc);
  doc.getText('body').insert(1, ' local');
  const local = Y.encodeStateAsUpdate(doc);
  assert.equal(restore(local, { snapshot: base64(persisted), updates: [] }), 'A local');
  doc.destroy();
});
