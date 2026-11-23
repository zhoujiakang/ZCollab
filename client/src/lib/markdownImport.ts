import MarkdownIt, { type Token } from 'markdown-it';
import type { JSONContent } from '@tiptap/react';

type TiptapMark = NonNullable<JSONContent['marks']>[number];

const mdParser = new MarkdownIt({ html: false, linkify: true, breaks: false });

const BLOCK_TYPES = new Set([
  'doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem',
  'blockquote', 'codeBlock', 'horizontalRule', 'table', 'tableRow',
  'tableHeader', 'tableCell',
]);

interface Frame {
  node: JSONContent;
  passthrough?: boolean;
}

function inlineNodes(tokens: Token[]): JSONContent[] {
  const out: JSONContent[] = [];
  const marks: TiptapMark[] = [];

  const popMark = (type: string) => {
    for (let i = marks.length - 1; i >= 0; i -= 1) {
      if (marks[i].type === type) {
        marks.splice(i, 1);
        return;
      }
    }
  };
  const pushText = (raw: string, extra: TiptapMark[] = []) => {
    if (!raw) return;
    const active = [...marks, ...extra];
    out.push(active.length ? { type: 'text', text: raw, marks: active } : { type: 'text', text: raw });
  };

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        pushText(token.content);
        break;
      case 'softbreak':
        pushText(' ');
        break;
      case 'hardbreak':
        out.push({ type: 'hardBreak' });
        break;
      case 'code_inline':
        pushText(token.content, [{ type: 'code' }]);
        break;
      case 'strong_open':
        marks.push({ type: 'bold' });
        break;
      case 'strong_close':
        popMark('bold');
        break;
      case 'em_open':
        marks.push({ type: 'italic' });
        break;
      case 'em_close':
        popMark('italic');
        break;
      case 's_open':
        marks.push({ type: 'strike' });
        break;
      case 's_close':
        popMark('strike');
        break;
      case 'link_open': {
        const href = token.attrGet('href') ?? '';
        const title = token.attrGet('title');
        marks.push({ type: 'link', attrs: title ? { href, title } : { href } });
        break;
      }
      case 'link_close':
        popMark('link');
        break;
      case 'image': {
        const src = token.attrGet('src') ?? '';
        if (!src) break;
        const alt = token.attrGet('alt') ?? '';
        const title = token.attrGet('title');
        const image: JSONContent = {
          type: 'image',
          attrs: title ? { src, alt, title } : { src, alt },
        };
        if (marks.length) image.marks = [...marks];
        out.push(image);
        break;
      }
      case 'html_inline':
        break;
      default:
        break;
    }
  }
  return out;
}

function codeLanguage(info: string): string {
  const language = info.trim().split(/\s+/)[0]?.replace(/[`\r\n]/g, '') ?? '';
  return language || 'plaintext';
}

function isBlockNode(node: JSONContent): boolean {
  return BLOCK_TYPES.has(node.type ?? '');
}

function inlineText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  return (node.content ?? []).map(inlineText).join('');
}

function collectBlocks(node: JSONContent, lines: string[]): void {
  const children = node.content ?? [];
  if (children.some(isBlockNode)) {
    for (const child of children) {
      if (isBlockNode(child)) {
        collectBlocks(child, lines);
      } else {
        const text = inlineText(child);
        if (text) lines.push(text);
      }
    }
    return;
  }
  const text = inlineText(node);
  if (text) lines.push(text);
}

/** 把 Markdown 源码转成 Tiptap JSON 以及用于搜索的纯文本。 */
export function markdownToDoc(md: string): { json: JSONContent; text: string } {
  const tokens = mdParser.parse(md, {});
  const root: JSONContent = { type: 'doc', content: [] };
  const stack: Frame[] = [{ node: root }];

  const currentContainer = (): JSONContent => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (!stack[i].passthrough) return stack[i].node;
    }
    return root;
  };
  const append = (node: JSONContent) => {
    const container = currentContainer();
    if (!container.content) container.content = [];
    container.content.push(node);
  };
  const push = (node: JSONContent | null, passthrough = false) => {
    if (node) append(node);
    stack.push({ node: node ?? currentContainer(), passthrough });
  };
  const pop = () => {
    if (stack.length > 1) stack.pop();
  };
  const openCell = (header: boolean) => {
    const cell: JSONContent = { type: header ? 'tableHeader' : 'tableCell', content: [] };
    push(cell);
    push({ type: 'paragraph', content: [] });
  };
  const closeCell = () => {
    pop();
    pop();
  };

  for (const token of tokens) {
    switch (token.type) {
      case 'heading_open': {
        const rawLevel = Number(token.tag.replace(/^h/, '')) || token.markup.length;
        const level = Number.isFinite(rawLevel) ? Math.min(6, Math.max(1, rawLevel)) : 1;
        push({ type: 'heading', attrs: { level }, content: [] });
        break;
      }
      case 'heading_close':
        pop();
        break;
      case 'paragraph_open':
        push({ type: 'paragraph', content: [] });
        break;
      case 'paragraph_close':
        pop();
        break;
      case 'bullet_list_open':
        push({ type: 'bulletList', content: [] });
        break;
      case 'bullet_list_close':
        pop();
        break;
      case 'ordered_list_open': {
        const rawStart = Number(token.attrGet('start'));
        const start = Number.isFinite(rawStart) && rawStart > 0 ? Math.floor(rawStart) : 1;
        push({ type: 'orderedList', attrs: { start }, content: [] });
        break;
      }
      case 'ordered_list_close':
        pop();
        break;
      case 'list_item_open':
        push({ type: 'listItem', content: [] });
        break;
      case 'list_item_close':
        pop();
        break;
      case 'blockquote_open':
        push({ type: 'blockquote', content: [] });
        break;
      case 'blockquote_close':
        pop();
        break;
      case 'fence':
      case 'code_block':
        append({
          type: 'codeBlock',
          attrs: { language: codeLanguage(token.info) },
          content: token.content ? [{ type: 'text', text: token.content }] : [],
        });
        break;
      case 'hr':
        append({ type: 'horizontalRule' });
        break;
      case 'table_open':
        push({ type: 'table', content: [] });
        break;
      case 'table_close':
        pop();
        break;
      case 'thead_open':
      case 'tbody_open':
        push(null, true);
        break;
      case 'thead_close':
      case 'tbody_close':
        pop();
        break;
      case 'tr_open':
        push({ type: 'tableRow', content: [] });
        break;
      case 'tr_close':
        pop();
        break;
      case 'th_open':
        openCell(true);
        break;
      case 'td_open':
        openCell(false);
        break;
      case 'th_close':
      case 'td_close':
        closeCell();
        break;
      case 'inline':
        for (const node of inlineNodes(token.children ?? [])) {
          const container = currentContainer();
          if (!container.content) container.content = [];
          container.content.push(node);
        }
        break;
      case 'html_block':
        break;
      default:
        if (token.nesting === 1) push(null, true);
        else if (token.nesting === -1) pop();
        break;
    }
  }

  const lines: string[] = [];
  collectBlocks(root, lines);
  return { json: root, text: lines.join('\n') };
}
