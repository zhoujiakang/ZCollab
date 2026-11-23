import { Extension } from '@tiptap/core';
import { NodeSelection, Plugin, PluginKey, TextSelection, type Selection } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';

export const blockHandlePluginKey = new PluginKey('blockHandle');

const HANDLE_WIDTH = 28;
const HANDLE_HEIGHT = 26;
const HIDE_DELAY = 120;
const SCROLL_HIDE_RATIO = 0.5;
const SLASH_MENU_EVENT = 'zcollab:slash-menu';

interface BlockInfo {
  from: number;
  size: number;
  node: PMNode;
  dom: HTMLElement;
  rect: DOMRect;
}

interface DropTarget {
  pos: number;
  lineY: number;
}

interface DragState {
  from: number;
  to: number;
  node: PMNode;
  savedSelection: Selection;
  target: DropTarget | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createHandle() {
  const root = document.createElement('div');
  Object.assign(root.style, {
    position: 'fixed',
    zIndex: '900',
    display: 'none',
    boxSizing: 'border-box',
    width: `${HANDLE_WIDTH}px`,
    height: `${HANDLE_HEIGHT}px`,
    padding: '0',
    border: '1px solid var(--zc-border)',
    borderRadius: '5px',
    background: 'var(--mantine-color-default)',
    boxShadow: '0 1px 5px rgba(0, 0, 0, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    userSelect: 'none',
  });
  root.setAttribute('aria-label', '块操作');

  const makeButton = (label: string, title: string, fontSize: string) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = title;
    button.setAttribute('aria-label', title);
    Object.assign(button.style, {
      flex: '1 1 0',
      minWidth: '0',
      width: '13px',
      height: '100%',
      padding: '0',
      border: '0',
      background: 'transparent',
      color: 'var(--mantine-color-dimmed)',
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize,
      letterSpacing: '-2px',
      lineHeight: '1',
    });
    button.addEventListener('mouseenter', () => {
      button.style.background = 'var(--zc-hover)';
      button.style.color = 'var(--mantine-primary-color-filled)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'transparent';
      button.style.color = 'var(--mantine-color-dimmed)';
    });
    root.appendChild(button);
    return button;
  };

  const plus = makeButton('+', '在下方插入空段落', '14px');
  const drag = makeButton('⋮⋮', '拖动整个块', '10px');
  return { root, plus, drag };
}

function createIndicator() {
  const line = document.createElement('div');
  Object.assign(line.style, {
    position: 'fixed',
    zIndex: '901',
    display: 'none',
    height: '2px',
    background: 'var(--mantine-primary-color-filled)',
    pointerEvents: 'none',
  });
  return line;
}

export const BlockHandle = Extension.create({
  name: 'blockHandle',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: blockHandlePluginKey,
        view(view: EditorView) {
          const { root: handle, plus, drag: dragButton } = createHandle();
          const indicator = createIndicator();
          document.body.appendChild(handle);
          document.body.appendChild(indicator);

          let currentBlock: BlockInfo | null = null;
          let lastBlockTop = 0;
          let visible = false;
          let hideTimer = 0;
          let pendingFrame = 0;
          let pointer = { x: 0, y: 0 };
          let menuOpen = false;
          let lastLayoutAt = 0;
          let dragState: DragState | null = null;
          let dragCursor = '';
          let dragUserSelect = '';

          const preventDragStart = (event: Event) => event.preventDefault();

          function topBlocks(): BlockInfo[] {
            const blocks: BlockInfo[] = [];
            view.state.doc.forEach((node, offset) => {
              const dom = view.nodeDOM(offset);
              if (dom instanceof HTMLElement) {
                blocks.push({ from: offset, size: node.nodeSize, node, dom, rect: dom.getBoundingClientRect() });
              }
            });
            return blocks;
          }

          function blockFromPos(pos: number, y: number): BlockInfo | null {
            const doc = view.state.doc;
            const $pos = doc.resolve(clamp(pos, 0, doc.content.size));
            let from = -1;
            if ($pos.depth >= 1) {
              from = $pos.before(1);
            } else {
              const blocks = topBlocks();
              if (!blocks.length) return null;
              let best = blocks[0];
              let bestDistance = Infinity;
              for (const block of blocks) {
                const distance = y < block.rect.top
                  ? block.rect.top - y
                  : y > block.rect.bottom
                    ? y - block.rect.bottom
                    : 0;
                if (distance < bestDistance) {
                  bestDistance = distance;
                  best = block;
                }
              }
              from = best.from;
            }
            const node = doc.nodeAt(from);
            const dom = view.nodeDOM(from);
            if (!node || node.isText || !(dom instanceof HTMLElement)) return null;
            return { from, size: node.nodeSize, node, dom, rect: dom.getBoundingClientRect() };
          }

          function topBlockAt(x: number, y: number): BlockInfo | null {
            const coords = view.posAtCoords({ left: x, top: y });
            if (!coords) return null;
            return blockFromPos(coords.pos, y);
          }

          function hideHandle() {
            visible = false;
            handle.style.display = 'none';
          }

          function showHandle() {
            if (
              !view.editable
              || view.state.doc.childCount <= 1
              || menuOpen
              || document.querySelector('[data-zcollab-slash-menu]')
            ) {
              hideHandle();
              return;
            }
            visible = true;
            handle.style.display = 'flex';
          }

          function cancelHide() {
            if (hideTimer) {
              window.clearTimeout(hideTimer);
              hideTimer = 0;
            }
          }

          function scheduleHide() {
            cancelHide();
            hideTimer = window.setTimeout(() => {
              hideTimer = 0;
              hideHandle();
            }, HIDE_DELAY);
          }

          function positionHandle(block: BlockInfo) {
            const rect = block.rect;
            let centerY = Number.NaN;
            if (!block.node.isAtom) {
              try {
                const caret = view.coordsAtPos(block.from + 1);
                if (caret && caret.top >= rect.top - 2 && caret.bottom <= rect.bottom + 4) {
                  centerY = (caret.top + caret.bottom) / 2;
                }
              } catch {
                // 没有可定位的文本位置时，回退到块首行行高。
              }
            }
            if (!Number.isFinite(centerY)) {
              const style = window.getComputedStyle(block.dom);
              const parsedLineHeight = Number.parseFloat(style.lineHeight);
              const fontSize = Number.parseFloat(style.fontSize) || 16;
              const lineHeight = Number.isFinite(parsedLineHeight) ? parsedLineHeight : fontSize * 1.5;
              centerY = rect.top + Math.min(lineHeight / 2, rect.height / 2);
            }

            handle.style.left = `${Math.max(0, rect.left - HANDLE_WIDTH)}px`;
            handle.style.top = `${clamp(centerY - HANDLE_HEIGHT / 2, 4, window.innerHeight - HANDLE_HEIGHT - 4)}px`;
            lastBlockTop = rect.top;
            showHandle();
          }

          function updateHover(x: number, y: number) {
            if (menuOpen || dragState || document.querySelector('[data-zcollab-slash-menu]')) {
              hideHandle();
              return;
            }
            if (!view.editable || view.state.doc.childCount <= 1) {
              hideHandle();
              return;
            }
            const editorRect = view.dom.getBoundingClientRect();
            if (!editorRect.width || !editorRect.height) {
              hideHandle();
              return;
            }
            const nearEditor = x >= editorRect.left - HANDLE_WIDTH - 8
              && x <= editorRect.right + 8
              && y >= editorRect.top - 8
              && y <= editorRect.bottom + 8;
            if (!nearEditor) {
              scheduleHide();
              return;
            }
            const block = topBlockAt(
              clamp(x, editorRect.left + 1, editorRect.right - 1),
              clamp(y, editorRect.top + 1, editorRect.bottom - 1),
            );
            if (!block) {
              scheduleHide();
              return;
            }
            cancelHide();
            currentBlock = block;
            positionHandle(block);
          }

          function insertParagraphBelow() {
            if (!currentBlock || !view.editable) return;
            const { state } = view;
            const insertAt = currentBlock.from + currentBlock.size;
            const paragraph = state.schema.nodes.paragraph.create();
            if (!paragraph || insertAt > state.doc.content.size) return;

            const tr = state.tr.insert(insertAt, paragraph);
            tr.setSelection(TextSelection.create(tr.doc, insertAt + 1));
            tr.scrollIntoView();
            view.dispatch(tr);
            view.focus();
            hideHandle();
          }

          function showIndicator(lineY: number) {
            const editorRect = view.dom.getBoundingClientRect();
            indicator.style.left = `${editorRect.left}px`;
            indicator.style.width = `${editorRect.width}px`;
            indicator.style.top = `${lineY - 1}px`;
            indicator.style.display = 'block';
          }

          function clearIndicator() {
            indicator.style.display = 'none';
            if (dragState) dragState.target = null;
          }

          function updateDrag(x: number, y: number) {
            if (!dragState) return;
            const doc = view.state.doc;
            const blocks = topBlocks();
            if (!blocks.length) {
              clearIndicator();
              return;
            }

            const first = blocks[0];
            const last = blocks[blocks.length - 1];
            if (y < first.rect.top) {
              dragState.target = { pos: 0, lineY: first.rect.top };
              showIndicator(first.rect.top);
              return;
            }
            if (y > last.rect.bottom) {
              dragState.target = { pos: doc.content.size, lineY: last.rect.bottom };
              showIndicator(last.rect.bottom);
              return;
            }

            const editorRect = view.dom.getBoundingClientRect();
            const block = topBlockAt(clamp(x, editorRect.left + 1, editorRect.right - 1), y);
            if (!block || block.from === dragState.from) {
              clearIndicator();
              return;
            }
            const before = y < block.rect.top + block.rect.height / 2;
            const pos = before ? block.from : block.from + block.size;
            dragState.target = { pos, lineY: before ? block.rect.top : block.rect.bottom };
            showIndicator(dragState.target.lineY);
          }

          function restoreSelection(selection: Selection) {
            const tr = view.state.tr;
            tr.setSelection(selection.map(tr.doc, tr.mapping));
            view.dispatch(tr);
          }

          function cleanupDrag() {
            if (!dragState) return;
            dragState = null;
            document.body.style.cursor = dragCursor;
            document.body.style.userSelect = dragUserSelect;
            document.removeEventListener('dragstart', preventDragStart);
            indicator.style.display = 'none';
          }

          function cancelDrag() {
            if (!dragState) return;
            const { savedSelection } = dragState;
            cleanupDrag();
            restoreSelection(savedSelection);
          }

          function startDrag(event: MouseEvent, block: BlockInfo) {
            if (!view.editable || view.state.doc.childCount <= 1) return;
            const node = view.state.doc.nodeAt(block.from);
            if (!node || node.nodeSize !== block.size) return;

            hideHandle();
            cancelHide();
            const savedSelection = view.state.selection;
            const tr = view.state.tr.setSelection(NodeSelection.create(view.state.doc, block.from));
            view.dispatch(tr);

            dragCursor = document.body.style.cursor;
            dragUserSelect = document.body.style.userSelect;
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
            document.addEventListener('dragstart', preventDragStart);
            dragState = {
              from: block.from,
              to: block.from + block.size,
              node,
              savedSelection,
              target: null,
            };
            updateDrag(event.clientX, event.clientY);
          }

          function finishDrag() {
            if (!dragState) return;
            const { from, to, node, savedSelection, target } = dragState;
            cleanupDrag();
            if (!target) {
              restoreSelection(savedSelection);
              return;
            }

            const current = view.state.doc.nodeAt(from);
            if (!current || current !== node || current.nodeSize !== node.nodeSize) {
              restoreSelection(savedSelection);
              return;
            }
            if (target.pos === from || target.pos === to) {
              restoreSelection(savedSelection);
              return;
            }

            const tr = view.state.tr;
            tr.delete(from, to);
            const mapped = tr.mapping.map(target.pos);
            tr.insert(mapped, node);
            tr.setSelection(NodeSelection.create(tr.doc, mapped));
            tr.scrollIntoView();
            view.dispatch(tr);
            view.focus();
          }

          function onMouseMove(event: MouseEvent) {
            pointer = { x: event.clientX, y: event.clientY };
            if (pendingFrame) return;
            pendingFrame = window.requestAnimationFrame(() => {
              pendingFrame = 0;
              if (dragState) updateDrag(pointer.x, pointer.y);
              else updateHover(pointer.x, pointer.y);
            });
          }

          function onEditorLeave() {
            if (dragState || performance.now() - lastLayoutAt < 200) return;
            scheduleHide();
          }

          function onMouseOut(event: MouseEvent) {
            if (dragState && event.relatedTarget === null) cancelDrag();
          }

          function onKeyDown(event: KeyboardEvent) {
            if (dragState && event.key === 'Escape') {
              event.preventDefault();
              cancelDrag();
            }
          }

          function onScroll() {
            lastLayoutAt = performance.now();
            if (dragState || !visible || !currentBlock) return;
            const blocks = topBlocks();
            const block = blocks.find((item) => item.from === currentBlock?.from);
            if (!block) {
              currentBlock = null;
              hideHandle();
              return;
            }
            if (Math.abs(block.rect.top - lastBlockTop) > window.innerHeight * SCROLL_HIDE_RATIO) {
              hideHandle();
              return;
            }
            currentBlock = block;
            positionHandle(block);
          }

          function onResize() {
            lastLayoutAt = performance.now();
            if (dragState || !visible || !currentBlock) return;
            const blocks = topBlocks();
            const block = blocks.find((item) => item.from === currentBlock?.from);
            if (!block) {
              currentBlock = null;
              hideHandle();
              return;
            }
            currentBlock = block;
            positionHandle(block);
          }

          function onSlashMenu(event: Event) {
            menuOpen = Boolean((event as CustomEvent<{ open: boolean }>).detail?.open);
            if (menuOpen) {
              cancelHide();
              hideHandle();
            } else {
              updateHover(pointer.x, pointer.y);
            }
          }

          plus.addEventListener('mousedown', (event) => event.preventDefault());
          plus.addEventListener('click', insertParagraphBelow);
          dragButton.addEventListener('mousedown', (event) => {
            event.preventDefault();
            if (!currentBlock) return;
            startDrag(event, currentBlock);
          });
          dragButton.addEventListener('mouseenter', cancelHide);
          dragButton.addEventListener('mouseleave', onEditorLeave);
          handle.addEventListener('mouseenter', cancelHide);
          handle.addEventListener('mouseleave', onEditorLeave);

          view.dom.addEventListener('mouseleave', onEditorLeave);
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseout', onMouseOut);
          document.addEventListener('keydown', onKeyDown);
          window.addEventListener(SLASH_MENU_EVENT, onSlashMenu);
          window.addEventListener('scroll', onScroll, true);
          window.addEventListener('resize', onResize);
          window.addEventListener('blur', cancelDrag);
          document.addEventListener('mouseup', finishDrag);

          return {
            update() {
              if (!visible || !currentBlock) return;
              const node = view.state.doc.nodeAt(currentBlock.from);
              if (!node || node !== currentBlock.node || view.state.doc.childCount <= 1) {
                currentBlock = null;
                hideHandle();
              }
            },
            destroy() {
              if (pendingFrame) window.cancelAnimationFrame(pendingFrame);
              cancelHide();
              cleanupDrag();
              handle.remove();
              indicator.remove();
              view.dom.removeEventListener('mouseleave', onEditorLeave);
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseout', onMouseOut);
              document.removeEventListener('keydown', onKeyDown);
              window.removeEventListener(SLASH_MENU_EVENT, onSlashMenu);
              document.removeEventListener('mouseup', finishDrag);
              window.removeEventListener('scroll', onScroll, true);
              window.removeEventListener('resize', onResize);
              window.removeEventListener('blur', cancelDrag);
            },
          };
        },
      }),
    ];
  },
});
