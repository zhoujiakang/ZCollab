import type { JSONContent } from '@tiptap/react';

type TiptapMark = NonNullable<JSONContent['marks']>[number];

interface RenderContext {
  indent: string;
}

const MARK_ORDER = ['bold', 'italic', 'strike', 'code', 'link'] as const;

function escapeBodyText(value: string, atLineStart: boolean): string {
  const out: string[] = [];
  let lineStart = atLineStart;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];

    if (char === '\\' || char === '`' || char === '*' || char === '_' || char === '[' || char === ']') {
      out.push('\\', char);
      lineStart = false;
      continue;
    }

    if (lineStart) {
      if (char === '#' || char === '-' || char === '+' || char === '>') {
        out.push('\\', char);
        lineStart = false;
        continue;
      }
      if (char >= '0' && char <= '9') {
        let end = i;
        while (end < value.length && value[end] >= '0' && value[end] <= '9') end += 1;
        if (value[end] === '.') {
          out.push(value.slice(i, end), '\\.');
          i = end;
          lineStart = false;
          continue;
        }
      }
    }

    out.push(char);
    if (char === '\n') lineStart = true;
    else if (char !== ' ' && char !== '\t') lineStart = false;
  }

  return out.join('');
}

function escapeLinkDestination(value: string): string {
  const raw = value ?? '';
  if (/[\s<>]/.test(raw)) {
    return `<${raw.replace(/</g, '\\<').replace(/>/g, '\\>')}>`;
  }
  return raw.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function codeFence(text: string): string {
  let longest = 0;
  let current = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '`') {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  return '`'.repeat(Math.max(3, longest + 1));
}

function wrapCodeSpan(text: string): string {
  let longest = 0;
  let current = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '`') {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
  }
  const fence = '`'.repeat(Math.max(1, longest + 1));
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${fence}${pad}${text}${pad}${fence}`;
}

function applyMarks(content: string, marks: TiptapMark[]): string {
  const sorted = [...marks]
    .filter((mark) => MARK_ORDER.includes(mark.type as (typeof MARK_ORDER)[number]))
    .sort((a, b) => MARK_ORDER.indexOf(a.type as (typeof MARK_ORDER)[number]) - MARK_ORDER.indexOf(b.type as (typeof MARK_ORDER)[number]));

  let result = content;
  for (const mark of sorted) {
    switch (mark.type) {
      case 'bold':
        result = `**${result}**`;
        break;
      case 'italic':
        result = `*${result}*`;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'code':
        result = wrapCodeSpan(result);
        break;
      case 'link':
        result = `[${result}](${escapeLinkDestination(String(mark.attrs?.href ?? ''))})`;
        break;
    }
  }
  return result;
}

function renderImage(node: JSONContent): string {
  const alt = escapeBodyText(String(node.attrs?.alt ?? ''), false).replace(/\r?\n/g, ' ');
  const src = escapeLinkDestination(String(node.attrs?.src ?? ''));
  return `![${alt}](${src})`;
}

function renderInline(
  nodes: JSONContent[] | undefined,
  linePrefix: string,
  atLineStart = true,
  cellMode = false,
): string {
  const out: string[] = [];
  let lineStart = atLineStart;

  for (const node of nodes ?? []) {
    if (node.type === 'hardBreak') {
      out.push(cellMode ? '<br>' : `  \n${linePrefix}`);
      lineStart = !cellMode;
      continue;
    }

    if (node.type === 'image') {
      out.push(applyMarks(renderImage(node), node.marks ?? []));
      lineStart = false;
      continue;
    }

    if (node.type === 'text') {
      const raw = node.text ?? '';
      const marks = node.marks ?? [];
      const hasCodeMark = marks.some((mark) => mark.type === 'code');
      const text = hasCodeMark ? raw : escapeBodyText(raw, lineStart);
      out.push(applyMarks(text, marks));
      if (raw.includes('\n')) lineStart = raw.endsWith('\n');
      else if (raw.length > 0) lineStart = false;
      continue;
    }

    if (node.content?.length) {
      const inner = renderInline(node.content, linePrefix, lineStart, cellMode);
      out.push(inner);
      if (inner) lineStart = false;
    }
  }

  return out.join('');
}

function renderTableCell(cell: JSONContent): string {
  const parts = (cell.content ?? [])
    .map((child) => renderInline(child.content, '', false, true))
    .filter((part) => part.length > 0);
  return parts.join('<br>').replace(/\|/g, '\\|');
}

function renderTableRow(row: JSONContent, ctx: RenderContext, columns: number): string {
  const cells = (row.content ?? []).filter((cell) => cell.type === 'tableHeader' || cell.type === 'tableCell');
  const values: string[] = [];
  for (let i = 0; i < columns; i += 1) {
    values.push(cells[i] ? renderTableCell(cells[i]) : '');
  }
  return `${ctx.indent}| ${values.join(' | ')} |`;
}

function renderTable(node: JSONContent, ctx: RenderContext): string {
  const rows = node.content ?? [];
  if (rows.length === 0) return '';

  const columns = rows.reduce((max, row) => {
    const count = (row.content ?? []).filter((cell) => cell.type === 'tableHeader' || cell.type === 'tableCell').length;
    return Math.max(max, count);
  }, 0);
  if (columns === 0) return '';

  const delimiter = `${ctx.indent}| ${Array.from({ length: columns }, () => '---').join(' | ')} |`;
  const lines = [renderTableRow(rows[0], ctx, columns), delimiter];
  for (let i = 1; i < rows.length; i += 1) {
    lines.push(renderTableRow(rows[i], ctx, columns));
  }
  return lines.join('\n');
}

function renderList(node: JSONContent, ctx: RenderContext): string {
  const items = (node.content ?? []).filter((item) => item.type === 'listItem');
  const ordered = node.type === 'orderedList';
  const startValue = Number(node.attrs?.start);
  const start = Number.isFinite(startValue) ? startValue : 1;
  const childIndent = `${ctx.indent}  `;
  const lines: string[] = [];

  items.forEach((item, index) => {
    const marker = ordered ? `${start + index}.` : '-';
    const children = item.content ?? [];
    const firstIsParagraph = children[0]?.type === 'paragraph';
    const firstText = firstIsParagraph
      ? renderInline(children[0].content, childIndent, true)
      : '';
    lines.push(`${ctx.indent}${marker}${firstText ? ` ${firstText}` : ''}`);

    const rest = children
      .slice(firstIsParagraph ? 1 : 0)
      .map((child) => renderBlock(child, { indent: childIndent }))
      .filter((chunk) => chunk.length > 0);
    if (rest.length) lines.push(rest.join('\n\n'));
  });

  return lines.join('\n');
}

function renderBlock(node: JSONContent, ctx: RenderContext): string {
  const indent = ctx.indent;

  switch (node.type) {
    case 'paragraph': {
      const text = renderInline(node.content, indent, true);
      return text ? `${indent}${text}` : '';
    }
    case 'heading': {
      const level = Number(node.attrs?.level);
      const depth = Number.isFinite(level) ? Math.min(6, Math.max(1, level)) : 1;
      const text = renderInline(node.content, indent, true);
      return `${indent}${'#'.repeat(depth)}${text ? ` ${text}` : ''}`;
    }
    case 'bulletList':
    case 'orderedList':
      return renderList(node, ctx);
    case 'listItem':
      return renderList({ type: 'bulletList', content: [node] }, ctx);
    case 'blockquote': {
      const inner = (node.content ?? [])
        .map((child) => renderBlock(child, { indent: `${indent}> ` }))
        .filter((chunk) => chunk.length > 0)
        .join('\n\n');
      if (!inner) return '';
      return inner
        .split('\n')
        .map((line) => (line.length ? line : `${indent}>`))
        .join('\n');
    }
    case 'codeBlock': {
      const text = (node.content ?? []).map((child) => child.text ?? '').join('');
      const language = String(node.attrs?.language ?? '').replace(/[`\r\n]/g, '').trim();
      const fence = codeFence(text);
      const body = text.split('\n').map((line) => `${indent}${line}`);
      return [`${indent}${fence}${language}`, ...body, `${indent}${fence}`].join('\n');
    }
    case 'horizontalRule':
      return `${indent}---`;
    case 'image':
      return `${indent}${applyMarks(renderImage(node), node.marks ?? [])}`;
    case 'attachment': {
      const name = escapeBodyText(String(node.attrs?.name ?? ''), false).replace(/\r?\n/g, ' ');
      const url = escapeLinkDestination(String(node.attrs?.url ?? ''));
      return `${indent}[${name}](${url})`;
    }
    case 'table':
      return renderTable(node, ctx);
    case 'tableRow':
      return renderTable({ content: [node] }, ctx);
    case 'tableHeader':
    case 'tableCell':
      return renderTable({ content: [{ content: [node] }] }, ctx);
    default: {
      const text = renderInline(node.content, indent, true);
      return text ? `${indent}${text}` : '';
    }
  }
}

/** 把 editor.getJSON() 的文档树转成 Markdown 文本。 */
export function docToMarkdown(json: JSONContent): string {
  const children = json.content ?? (json.type ? [json] : []);
  return children
    .map((child) => renderBlock(child, { indent: '' }))
    .filter((chunk) => chunk.length > 0)
    .join('\n\n');
}

/** 文档标题转成安全文件名，最多 80 个字符；空标题用「未命名文档」。 */
export function markdownFileName(title: string): string {
  const raw = (title ?? '').trim();
  if (!raw) return '未命名文档';
  const safe = raw.replace(/[\\/:*?"<>|\x00-\x1F\x7F]/g, '-');
  const trimmed = Array.from(safe).slice(0, 80).join('');
  return trimmed || '未命名文档';
}

/** 以 text/markdown Blob 触发一次浏览器下载，点击后立即 revoke。 */
export function downloadMarkdownFile(markdown: string, title: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${markdownFileName(title)}.md`;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
