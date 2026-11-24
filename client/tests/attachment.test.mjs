import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Attachment } from '../src/components/page/Attachment.ts';

test('attachment cards download with the display filename and do not open a preview tab', () => {
  const attrs = { url: '/files/2026/11/a1b2c3d4-报告.pdf', name: '报告.pdf', size: 123 };
  const spec = Attachment.config.renderHTML({ node: { attrs }, HTMLAttributes: {} });
  assert.equal(spec[0], 'a');
  assert.equal(spec[1].href, attrs.url);
  assert.equal(spec[1].download, attrs.name);
  assert.equal(spec[1].target, undefined);
  assert.equal(spec[1].title, '下载 报告.pdf');
  assert.equal(spec[1]['aria-label'], '下载附件 报告.pdf');
});

test('clicking a card downloads outside the editable region and keeps the page in place', async () => {
  const { handleAttachmentClick } = await import('../src/components/page/Attachment.ts');
  const previousDocument = globalThis.document;
  const calls = [];
  const link = { click() { calls.push('download'); }, remove() { calls.push('remove'); } };
  globalThis.document = {
    createElement(tag) { assert.equal(tag, 'a'); return link; },
    body: { appendChild(node) { assert.equal(node, link); calls.push('append'); } },
  };
  try {
    const target = { closest: () => ({
      href: 'https://example.test/files/report.pdf',
      getAttribute(name) { return name === 'download' ? '报告.pdf' : null; },
    }) };
    const handled = handleAttachmentClick(target, { preventDefault() { calls.push('preventDefault'); } });
    assert.equal(handled, true);
    assert.equal(link.download, '报告.pdf');
    assert.equal(link.href, 'https://example.test/files/report.pdf');
    assert.equal(link.target, undefined);
    assert.deepEqual(calls, ['preventDefault', 'append', 'download', 'remove']);
  } finally {
    globalThis.document = previousDocument;
  }
});
