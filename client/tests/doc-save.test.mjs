import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docSavePayload, TitleChanges } from '../src/lib/docSave.ts';
import { workspaceConfig, workspaceIdFromPath } from '../src/lib/workspaceScope.ts';

test('body-only autosave leaves a peer rename untouched', () => {
  const server = { title: 'Renamed by peer' };
  const changes = new TitleChanges();
  const payload = docSavePayload('Stale local title', changes.pending, { json: {type:'doc'}, text: 'Body change' });
  Object.assign(server, payload);
  assert.equal(server.title, 'Renamed by peer');
  assert.equal(server.text, 'Body change');
  assert.equal(Object.hasOwn(payload, 'title'), false);
});

test('a rename made while saving is still dirty after the previous request succeeds', () => {
  const changes = new TitleChanges();
  changes.markChanged();
  const inFlightVersion = changes.revision;
  changes.markChanged();
  changes.acknowledge(inFlightVersion);
  assert.equal(changes.pending, true);
  assert.equal(docSavePayload('Latest title', changes.pending).title, 'Latest title');
  changes.acknowledge(changes.revision);
  assert.equal(changes.pending, false);
});

test('failed requests leave title changes pending for retry', () => {
  const changes = new TitleChanges();
  changes.markChanged();
  assert.equal(docSavePayload('', changes.pending).title, '');
  assert.equal(changes.pending, true);
});

test('workspace scope comes from this tabs route including nested settings pages', () => {
  assert.equal(workspaceIdFromPath('/w/2125131547601403906/p/42'), '2125131547601403906');
  assert.equal(workspaceIdFromPath('/w/8/settings'), '8');
  assert.equal(workspaceIdFromPath('/home'), undefined);
  assert.equal(workspaceIdFromPath('/w/0'), undefined);
  assert.equal(workspaceIdFromPath('/w/8bad'), undefined);
});

test('delayed requests retain their original workspace and leaving can explicitly omit scope', () => {
  const config = workspaceConfig('7');
  assert.equal(workspaceIdFromPath('/w/8'), '8');
  assert.equal(config.headers['X-Workspace-Id'], '7');
  assert.equal(workspaceConfig(null).headers['X-Workspace-Id'], false);
});

test('request headers follow the calling tab while explicit cleanup scope survives navigation', async () => {
  const { scopeWorkspaceRequest } = await import('../src/lib/workspaceScope.ts');
  const config = { timeout: 3000, headers: { Accept: 'application/json' } };
  const tabA = scopeWorkspaceRequest('/w/7/p/42', config);
  const tabB = scopeWorkspaceRequest('/w/8/settings', config);
  assert.equal(tabA.headers.get('X-Workspace-Id'), '7');
  assert.equal(tabB.headers.get('X-Workspace-Id'), '8');
  assert.equal(config.headers['X-Workspace-Id'], undefined);
  assert.equal(tabA.timeout, 3000);
  assert.equal(tabA.headers.get('Accept'), 'application/json');
  assert.equal(scopeWorkspaceRequest('/w/8', workspaceConfig('7')).headers.get('X-Workspace-Id'), '7');
  assert.equal(Object.hasOwn(scopeWorkspaceRequest('/w/7', workspaceConfig(null)).headers.toJSON(), 'X-Workspace-Id'), false);
});
