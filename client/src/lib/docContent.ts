import type { JSONContent } from '@tiptap/react';

export function parseDocContent(raw: string): JSONContent {
  const blank: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };
  if (!raw) return blank;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      (parsed as JSONContent).type === 'doc' &&
      Array.isArray((parsed as JSONContent).content)
    ) {
      return parsed as JSONContent;
    }
  } catch {
    // 旧文档或非法 JSON：按纯文本处理
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: raw }],
      },
    ],
  };
}

export function hasDocContent(node: JSONContent): boolean {
  if (typeof node.text === 'string') return node.text.trim().length > 0;
  return (node.content ?? []).some(hasDocContent);
}
