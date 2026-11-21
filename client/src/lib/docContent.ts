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

export const editorStyles = `
.zcollab-editor {
  box-sizing: border-box;
  min-height: 400px;
  padding: 12px 14px;
  border: 1px solid var(--mantine-color-gray-3);
  border-radius: 8px;
  font-size: 15px;
  line-height: 1.7;
  white-space: pre-wrap;
  color: var(--mantine-color-text);
  outline: none;
}
.zcollab-editor:focus-within { border-color: var(--mantine-color-teal-5); }
.zcollab-editor p { margin: 0; }
.zcollab-editor > * + * { margin-top: 0.75em; }
.zcollab-editor h1, .zcollab-editor h2, .zcollab-editor h3 { font-weight: 700; line-height: 1.3; margin: 1em 0 0.5em; }
.zcollab-editor h1 { font-size: 2em; }
.zcollab-editor h2 { font-size: 1.6em; }
.zcollab-editor h3 { font-size: 1.3em; }
.zcollab-editor ul, .zcollab-editor ol { padding-left: 1.8em; margin: 0.5em 0; }
.zcollab-editor ul { list-style: disc; }
.zcollab-editor ol { list-style: decimal; }
.zcollab-editor li { margin: 0.25em 0; }
.zcollab-editor li p { margin: 0; }
.zcollab-editor blockquote { margin: 0.75em 0; padding: 2px 0 2px 14px; border-left: 3px solid var(--mantine-color-gray-4); color: var(--mantine-color-dimmed); }
.zcollab-editor pre { margin: 0.75em 0; padding: 12px 14px; border-radius: 6px; background: var(--mantine-color-gray-1); overflow-x: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.6; }
.zcollab-editor code { padding: 0.15em 0.35em; border-radius: 4px; background: var(--mantine-color-gray-1); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.zcollab-editor pre code { padding: 0; background: transparent; }
.zcollab-editor hr { border: 0; border-top: 1px solid var(--mantine-color-gray-3); margin: 1.5em 0; }
.zcollab-editor .collaboration-carets__caret {
  position: relative;
  margin-left: -1px;
  margin-right: -1px;
  border-left: 2px solid;
  border-right: 2px solid;
  pointer-events: none;
  word-break: normal;
}
.zcollab-editor .collaboration-carets__label {
  position: absolute;
  top: -1.5em;
  left: -1px;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  color: #fff;
  padding: 1px 5px;
  border-radius: 3px 3px 3px 0;
  user-select: none;
  white-space: nowrap;
}
`;
