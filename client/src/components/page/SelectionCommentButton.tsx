import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@mantine/core';
import type { Editor } from '@tiptap/react';
import { useAside } from '../layout/AsideContext';
import { useCommentDraft } from '../layout/CommentDraftContext';
import classes from './SelectionCommentButton.module.css';

const MAX_QUOTE_LENGTH = 500;
const BUTTON_WIDTH = 68;
const EDGE = 12;

interface SelectionState {
  top: number;
  left: number;
  quote: string;
  from: number;
  to: number;
}

export default function SelectionCommentButton({ editor }: { editor: Editor | null }) {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const { open } = useAside();
  const { setDraft } = useCommentDraft();

  const measure = useCallback(() => {
    if (!editor || !editor.isEditable || !editor.isFocused) {
      setSelection(null);
      return;
    }
    const { selection: current } = editor.state;
    if (current.empty) {
      setSelection(null);
      return;
    }
    const quote = editor.state.doc.textBetween(current.from, current.to, ' ');
    if (!quote || quote.length > MAX_QUOTE_LENGTH) {
      setSelection(null);
      return;
    }
    try {
      const start = editor.view.coordsAtPos(current.from);
      const end = editor.view.coordsAtPos(current.to);
      setSelection({
        top: Math.max(EDGE, Math.min(start.top, end.top) - 40),
        left: Math.max(EDGE, Math.min(start.left, window.innerWidth - BUTTON_WIDTH - EDGE)),
        quote,
        from: current.from,
        to: current.to,
      });
    } catch {
      setSelection(null);
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const hide = () => setSelection(null);
    editor.on('selectionUpdate', measure);
    editor.on('focus', measure);
    editor.on('blur', hide);
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      editor.off('selectionUpdate', measure);
      editor.off('focus', measure);
      editor.off('blur', hide);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [editor, measure]);

  if (!editor || !selection) return null;

  const handleClick = () => {
    const { quote, from, to } = selection;
    setDraft({ quote, from, to, key: Date.now() });
    open();
    setSelection(null);
    editor.chain().setTextSelection(to).run();
  };

  return createPortal(
    <div
      className={classes.layer}
      style={{ top: selection.top, left: selection.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <Button size="compact-xs" variant="filled" onClick={handleClick}>
        评论
      </Button>
    </div>,
    document.body,
  );
}
