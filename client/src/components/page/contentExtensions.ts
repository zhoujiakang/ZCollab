import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Attachment } from './Attachment';

/**
 * 纯内容扩展清单。每次调用都生成新的实例，避免两个编辑器共用同一个
 * Extension 实例时互相覆盖 `this.editor`。
 */
export function createContentExtensions() {
  return [
    Image.configure({ inline: false, allowBase64: false }),
    Attachment,
    TableKit.configure({ table: { resizable: true } }),
  ];
}
