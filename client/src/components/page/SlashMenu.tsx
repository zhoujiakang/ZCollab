import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Paper } from '@mantine/core';
import type { Editor } from '@tiptap/core';
import {
  IconAlignLeft,
  IconH1,
  IconH2,
  IconH3,
  IconList,
  IconListNumbers,
  IconMinus,
  IconPaperclip,
  IconPhoto,
  IconQuote,
} from '@tabler/icons-react';

export type SlashUploadKind = 'image' | 'attachment';

export type SlashCommandAction = (editor: Editor, position: number) => void;

export type SlashCommandItem = {
  label: string;
  description: string;
  keywords: string[];
  icon: ReactNode;
  action: SlashCommandAction;
};

export type OnRequestUpload = (kind: SlashUploadKind, position: number) => void;

export function createSlashCommands(onRequestUpload: OnRequestUpload): SlashCommandItem[] {
  return [
    {
      label: '正文',
      description: '普通正文段落',
      keywords: ['paragraph', 'text', 'p', '正文', '段落'],
      icon: <IconAlignLeft size={18} stroke={1.7} />,
      action: (editor) => { editor.chain().focus().setParagraph().run(); },
    },
    {
      label: '标题 1',
      description: '一级标题',
      keywords: ['h1', 'heading 1', 'heading1', '一级标题', '标题1'],
      icon: <IconH1 size={18} stroke={1.7} />,
      action: (editor) => { editor.chain().focus().setHeading({ level: 1 }).run(); },
    },
    {
      label: '标题 2',
      description: '二级标题',
      keywords: ['h2', 'heading 2', 'heading2', '二级标题', '标题2'],
      icon: <IconH2 size={18} stroke={1.7} />,
      action: (editor) => { editor.chain().focus().setHeading({ level: 2 }).run(); },
    },
    {
      label: '标题 3',
      description: '三级标题',
      keywords: ['h3', 'heading 3', 'heading3', '三级标题', '标题3'],
      icon: <IconH3 size={18} stroke={1.7} />,
      action: (editor) => { editor.chain().focus().setHeading({ level: 3 }).run(); },
    },
    {
      label: '无序列表',
      description: '带圆点的列表',
      keywords: ['bullet', 'ul', 'list', '无序', '列表'],
      icon: <IconList size={18} stroke={1.7} />,
      action: (editor) => { editor.chain().focus().toggleBulletList().run(); },
    },
    {
      label: '有序列表',
      description: '带编号的列表',
      keywords: ['ordered', 'ol', 'number', 'list', '有序', '编号', '列表'],
      icon: <IconListNumbers size={18} stroke={1.7} />,
      action: (editor) => { editor.chain().focus().toggleOrderedList().run(); },
    },
    {
      label: '引用',
      description: '引用一段文字',
      keywords: ['quote', 'blockquote', '引用'],
      icon: <IconQuote size={18} stroke={1.7} />,
      action: (editor) => { editor.chain().focus().toggleBlockquote().run(); },
    },
    {
      label: '分割线',
      description: '分隔上下内容',
      keywords: ['hr', 'rule', 'divider', '分割线', '分隔线'],
      icon: <IconMinus size={18} stroke={1.7} />,
      action: (editor) => { editor.chain().focus().setHorizontalRule().run(); },
    },
    {
      label: '图片',
      description: '上传一张图片',
      keywords: ['image', 'photo', 'picture', '图片'],
      icon: <IconPhoto size={18} stroke={1.7} />,
      action: (_editor, position) => { onRequestUpload('image', position); },
    },
    {
      label: '附件',
      description: '上传一个文件',
      keywords: ['attachment', 'file', '附件', '文件'],
      icon: <IconPaperclip size={18} stroke={1.7} />,
      action: (_editor, position) => { onRequestUpload('attachment', position); },
    },
  ];
}

export function filterSlashCommands(items: SlashCommandItem[], query: string): SlashCommandItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => (
    item.label.toLowerCase().includes(normalized)
    || item.keywords.some((keyword) => keyword.toLowerCase().includes(normalized))
  ));
}

export type SlashMenuProps = {
  items: SlashCommandItem[];
  query: string;
  command: (item: SlashCommandItem) => void;
  onClose: () => void;
};

export type SlashMenuHandle = {
  update: (props: SlashMenuProps) => void;
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(initialProps, ref) {
  const [view, setView] = useState({
    items: initialProps.items,
    query: initialProps.query,
    command: initialProps.command,
    onClose: initialProps.onClose,
  });
  const viewRef = useRef(view);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedIndexRef = useRef(0);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const apply = useCallback((next: SlashMenuProps) => {
    const previous = viewRef.current;
    const itemsChanged = next.items !== previous.items;
    if (
      !itemsChanged
      && next.query === previous.query
      && next.command === previous.command
      && next.onClose === previous.onClose
    ) {
      return;
    }

    const nextView = {
      items: next.items,
      query: next.query,
      command: next.command,
      onClose: next.onClose,
    };
    viewRef.current = nextView;
    setView(nextView);
    if (itemsChanged) {
      selectedIndexRef.current = 0;
      setSelectedIndex(0);
      itemRefs.current = [];
    }
  }, []);

  useEffect(() => {
    apply(initialProps);
  }, [apply, initialProps]);

  const select = useCallback((index: number) => {
    const count = viewRef.current.items.length;
    if (count === 0) return;
    const next = ((index % count) + count) % count;
    selectedIndexRef.current = next;
    setSelectedIndex(next);
  }, []);

  useImperativeHandle(ref, () => ({
    update: apply,
    onKeyDown: ({ event }) => {
      const { items, command, onClose } = viewRef.current;
      switch (event.key) {
        case 'ArrowDown':
          select(selectedIndexRef.current + 1);
          return true;
        case 'ArrowUp':
          select(selectedIndexRef.current - 1);
          return true;
        case 'Enter':
        case 'Tab': {
          if (items.length === 0) return true;
          const index = Math.min(selectedIndexRef.current, items.length - 1);
          command(items[index]);
          return true;
        }
        case 'Escape':
          onClose();
          return true;
        default:
          return false;
      }
    },
  }), [apply, select]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, view.items]);

  return (
    <Paper
      shadow="md"
      radius="md"
      withBorder
      style={{ width: '100%', background: 'var(--mantine-color-body)', overflow: 'hidden' }}
    >
      <div style={{ maxHeight: 320, overflowY: 'auto', padding: 6 }}>
        {view.items.length === 0 ? (
          <div style={{ padding: '10px 8px', fontSize: 13, color: 'var(--mantine-color-dimmed)' }}>
            没有找到匹配的命令
          </div>
        ) : view.items.map((item, index) => {
          const selected = index === selectedIndex;
          return (
            <div
              key={item.label}
              ref={(node) => { itemRefs.current[index] = node; }}
              onMouseEnter={() => select(index)}
              onMouseDown={(event) => {
                event.preventDefault();
                select(index);
                viewRef.current.command(item);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                background: selected ? 'var(--mantine-primary-color-light)' : 'transparent',
                color: 'var(--mantine-color-text)',
              }}
            >
              <span style={{ display: 'flex', flexShrink: 0, color: 'var(--mantine-primary-color-filled)' }}>
                {item.icon}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 14, lineHeight: 1.35 }}>{item.label}</span>
                <span style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--mantine-color-dimmed)' }}>
                  {item.description}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </Paper>
  );
});

export default SlashMenu;
