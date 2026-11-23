import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActionIcon, Button, Menu } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { Editor } from '@tiptap/react';
import {
  IconCheck,
  IconChevronDown,
  IconCode,
  IconColumnInsertLeft,
  IconColumnInsertRight,
  IconColumnRemove,
  IconCopy,
  IconRowInsertBottom,
  IconRowInsertTop,
  IconRowRemove,
  IconTable,
  IconTableRow,
  IconTrash,
} from '@tabler/icons-react';
import { CODE_LANGUAGES, languageLabel } from './codeLanguages';
import classes from './FloatingBlockTools.module.css';

const TOOL_GAP = 8;
const MIN_TOP = 44;

type BlockKind = 'table' | 'codeBlock';

type BlockToolsState = {
  kind: BlockKind;
  rect: DOMRect;
  language: string;
  inHeaderRow: boolean;
};

function closestBlock(node: Node | null): { kind: BlockKind; element: Element } | null {
  const element = node instanceof Element ? node : node?.parentElement;
  if (!element) return null;
  const table = element.closest('table');
  if (table) return { kind: 'table', element: table };
  const pre = element.closest('pre');
  if (pre) return { kind: 'codeBlock', element: pre };
  return null;
}

export default function FloatingBlockTools({ editor }: { editor: Editor | null }) {
  const [state, setState] = useState<BlockToolsState | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    frameRef.current = null;
    if (!editor || !editor.isEditable) {
      setState(null);
      return;
    }
    const { view, state: editorState } = editor;
    const resolved = view.domAtPos(editorState.selection.from);
    const block = closestBlock(resolved.node);
    if (!block || !editor.view.dom.contains(block.element)) {
      setState(null);
      return;
    }
    if (block.kind === 'codeBlock' && !editor.isActive('codeBlock')) {
      setState(null);
      return;
    }
    if (block.kind === 'table' && !editor.isActive('table')) {
      setState(null);
      return;
    }
    const language = block.kind === 'codeBlock'
      ? (editorState.selection.$from.parent.attrs.language as string | undefined) ?? 'plaintext'
      : '';
    const rect = block.element.getBoundingClientRect();
    const inHeaderRow = editor.isActive('tableHeader');
    setState((current) => (
      current
      && current.kind === block.kind
      && current.language === language
      && current.inHeaderRow === inHeaderRow
      && current.rect.top === rect.top
      && current.rect.bottom === rect.bottom
      && current.rect.left === rect.left
      && current.rect.right === rect.right
        ? current
        : { kind: block.kind, rect, language, inHeaderRow }
    ));
  }, [editor]);

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(measure);
  }, [measure]);

  useEffect(() => {
    if (!editor || !editor.isEditable) {
      setState(null);
      return;
    }
    scheduleMeasure();
    editor.on('selectionUpdate', scheduleMeasure);
    editor.on('update', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      editor.off('selectionUpdate', scheduleMeasure);
      editor.off('update', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
      window.removeEventListener('resize', scheduleMeasure);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [editor, scheduleMeasure]);

  useLayoutEffect(() => {
    if (!state || !layerRef.current) {
      setPosition(null);
      return;
    }
    const element = layerRef.current;
    const height = element.offsetHeight;
    const width = element.offsetWidth;
    const above = state.rect.top - TOOL_GAP - height;
    const top = state.rect.top >= MIN_TOP + height
      ? above
      : state.rect.bottom + TOOL_GAP;
    const left = Math.max(
      4,
      Math.min(state.rect.right - width, window.innerWidth - width - 4),
    );
    setPosition((current) => (
      current && current.top === top && current.left === left ? current : { top, left }
    ));
  }, [state]);

  useEffect(() => {
    if (!copied) return;
    if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    };
  }, [copied]);

  if (!editor || !state || !editor.isEditable) return null;

  const tableActions = [
    { key: 'addRowBefore', label: '上方加行', icon: <IconRowInsertTop size={16} stroke={1.7} />, unavailable: false, action: () => editor.chain().focus().addRowBefore().run() },
    { key: 'addRowAfter', label: '下方加行', icon: <IconRowInsertBottom size={16} stroke={1.7} />, unavailable: false, action: () => editor.chain().focus().addRowAfter().run() },
    { key: 'addColumnBefore', label: '左侧加列', icon: <IconColumnInsertLeft size={16} stroke={1.7} />, unavailable: false, action: () => editor.chain().focus().addColumnBefore().run() },
    { key: 'addColumnAfter', label: '右侧加列', icon: <IconColumnInsertRight size={16} stroke={1.7} />, unavailable: false, action: () => editor.chain().focus().addColumnAfter().run() },
    { key: 'deleteRow', label: '删行', icon: <IconRowRemove size={16} stroke={1.7} />, unavailable: state.inHeaderRow, action: () => editor.chain().focus().deleteRow().run() },
    { key: 'deleteColumn', label: '删列', icon: <IconColumnRemove size={16} stroke={1.7} />, unavailable: false, action: () => editor.chain().focus().deleteColumn().run() },
    { key: 'toggleHeaderRow', label: '切换表头', icon: <IconTableRow size={16} stroke={1.7} />, unavailable: false, action: () => editor.chain().focus().toggleHeaderRow().run() },
    { key: 'deleteTable', label: '删除表格', icon: <IconTrash size={16} stroke={1.7} />, unavailable: false, action: () => editor.chain().focus().deleteTable().run() },
  ];

  const handleCopy = async () => {
    const text = editor.state.doc.textBetween(
      editor.state.selection.$from.before(),
      editor.state.selection.$from.after(),
      '\n',
      '\n',
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: '复制失败',
        message: error instanceof Error ? error.message : '无法访问剪贴板',
      });
    }
  };

  return createPortal(
    <div
      ref={layerRef}
      className={classes.floatLayer}
      role="toolbar"
      aria-label={state.kind === 'table' ? '表格操作' : '代码块操作'}
      data-zcollab-block-tools={state.kind}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        visibility: position ? 'visible' : 'hidden',
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {state.kind === 'table' ? (
        tableActions.map((item) => (
          <ActionIcon
            key={item.key}
            size="compact-md"
            variant="subtle"
            color="gray"
            disabled={item.unavailable}
            title={item.label}
            aria-label={item.label}
            onClick={item.action}
          >
            {item.icon}
          </ActionIcon>
        ))
      ) : (
        <>
          <Menu position="bottom-start" withinPortal>
            <Menu.Target>
              <Button
                variant="subtle"
                color="gray"
                size="compact-sm"
                className={classes.languageButton}
                rightSection={<IconChevronDown size={14} />}
                leftSection={<IconCode size={14} />}
              >
                <span>{languageLabel(state.language)}</span>
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              {CODE_LANGUAGES.map(({ value, label }) => (
                <Menu.Item
                  key={value}
                  leftSection={value === state.language ? <IconCheck size={14} /> : null}
                  onClick={() => {
                    editor.chain().focus().updateAttributes('codeBlock', { language: value }).run();
                    scheduleMeasure();
                  }}
                >
                  {label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
          <Button
            variant="subtle"
            color="gray"
            size="compact-sm"
            leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            onClick={() => void handleCopy()}
          >
            {copied ? '已复制' : '复制'}
          </Button>
        </>
      )}
    </div>,
    document.body,
  );
}
