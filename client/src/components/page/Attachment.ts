import { Node, mergeAttributes } from '@tiptap/core';
import type { DOMOutputSpec } from '@tiptap/pm/model';

export interface AttachmentAttrs {
  url: string;
  name: string;
  size: number;
}

export function formatFileSize(bytes: number): string {
  const value = Number(bytes);
  const size = Number.isFinite(value) && value > 0 ? value : 0;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** Trigger downloads outside contenteditable so selecting an atomic node cannot swallow the click. */
export function handleAttachmentClick(target: Element, event: MouseEvent): boolean {
  const attachment = target.closest<HTMLAnchorElement>('a[data-attachment]');
  if (!attachment) return false;
  event.preventDefault();
  const download = document.createElement('a');
  download.href = attachment.href;
  download.download = attachment.getAttribute('download') ?? attachment.getAttribute('data-name') ?? '';
  download.rel = 'noopener noreferrer';
  document.body.appendChild(download);
  try {
    download.click();
  } finally {
    download.remove();
  }
  return true;
}

const FILE_ICON: DOMOutputSpec = [
  'svg',
  {
    viewBox: '0 0 24 24',
    width: 20,
    height: 20,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 1.7,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  },
  ['path', { d: 'M14 2v6h6' }],
  ['path', { d: 'M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z' }],
];

/** 编辑页与分享页共用下载卡片；服务端同时为附件设置 attachment 响应头。 */
export const Attachment = Node.create({
  name: 'attachment',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-url') ?? '',
        renderHTML: (attributes) => ({ 'data-url': attributes.url }),
      },
      name: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-name') ?? '',
        renderHTML: (attributes) => ({ 'data-name': attributes.name }),
      },
      size: {
        default: 0,
        parseHTML: (element) => {
          const size = Number(element.getAttribute('data-size') ?? 0);
          return Number.isFinite(size) ? size : 0;
        },
        renderHTML: (attributes) => ({ 'data-size': String(attributes.size ?? 0) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-attachment]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { url, name, size } = node.attrs as AttachmentAttrs;
    const spec: DOMOutputSpec = [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-attachment': '',
        href: url,
        download: name,
        rel: 'noopener noreferrer',
        class: 'attachment-card',
        title: `下载 ${name}`,
        'aria-label': `下载附件 ${name}`,
      }),
      FILE_ICON,
      [
        'span',
        { class: 'attachment-card-body' },
        ['span', { class: 'attachment-card-name' }, name],
        ['span', { class: 'attachment-card-size' }, formatFileSize(size)],
      ],
      ['span', { class: 'attachment-card-arrow', 'aria-hidden': 'true' }, '↓'],
    ];
    return spec;
  },
});
