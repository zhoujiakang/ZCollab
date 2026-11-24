import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(fs.readFileSync(new URL('../src/components/page/useComments.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Run the production hook with state slots, dependency tracking and effect cleanups.
function harness(api) {
  const slots = [];
  let cursor = 0, effects = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = initial;
      return [slots[slot], value => { slots[slot] = value; }];
    },
    useRef(initial) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useCallback(fn, deps) {
      const slot = cursor++;
      if (!same(slots[slot]?.deps, deps)) slots[slot] = { deps, value: fn };
      return slots[slot].value;
    },
    useEffect(fn, deps) {
      const slot = cursor++;
      if (!same(slots[slot]?.deps, deps)) {
        const previous = slots[slot];
        effects.push(() => { previous?.cleanup?.(); slots[slot] = { deps, cleanup: fn() }; });
      }
    },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => name === 'react' ? react : api });
  return {
    render(id) { cursor = 0; effects = []; return exports.useComments(id); },
    effects() { for (const fn of effects.splice(0)) fn(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('switching hides old comments before effects, even when the new request fails', async () => {
  const h = harness({ listComments: async id => { if (id === 'A') return [{ id: 'A-comment' }]; throw new Error('offline'); } });
  h.render('A'); h.effects(); await tick();
  assert.equal(h.render('A').comments[0].id, 'A-comment');
  assert.equal(h.render('B').comments.length, 0);
  h.effects(); await tick();
  assert.equal(h.render('B').comments.length, 0);
});

test('a late response from the previous document cannot replace current comments', async () => {
  const old = deferred();
  const h = harness({ listComments: id => id === 'A' ? old.promise : Promise.resolve([{ id: 'B-comment' }]) });
  h.render('A'); h.effects();
  h.render('B'); h.effects(); await tick();
  old.resolve([{ id: 'A-comment' }]); await tick();
  assert.equal(h.render('B').comments[0].id, 'B-comment');
});

test('a previous documents pending mutation cannot reload comments into the current document', async () => {
  const mutation = deferred(), calls = [];
  const h = harness({
    createComment: () => mutation.promise,
    listComments: async id => { calls.push(id); return [{ id: id + '-comment' }]; },
  });
  let a = h.render('A'); h.effects(); await tick();
  const creation = a.create({ docId: 'A' });
  h.render('B'); h.effects(); await tick();
  mutation.resolve(); await creation;
  assert.deepEqual(calls, ['A', 'B']);
  assert.equal(h.render('B').comments[0].id, 'B-comment');
});

test('leaving the editor hides comments and ignores outstanding requests', async () => {
  const pending = deferred();
  const h = harness({ listComments: () => pending.promise });
  h.render('A'); h.effects();
  assert.equal(h.render(undefined).comments.length, 0);
  h.effects(); pending.resolve([{ id: 'A-comment' }]); await tick();
  assert.equal(h.render(undefined).comments.length, 0);
});
