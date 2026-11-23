import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import {
  Suggestion,
  exitSuggestion,
  type SuggestionProps,
} from '@tiptap/suggestion';
import SlashMenu, {
  createSlashCommands,
  filterSlashCommands,
  type SlashCommandItem,
  type SlashMenuHandle,
  type SlashMenuProps,
  type SlashUploadKind,
} from './SlashMenu';

export const slashCommandPluginKey = new PluginKey('slashCommand');

const MENU_WIDTH = 280;
const MENU_MAX_HEIGHT = 320;
const MENU_GAP = 6;
const SLASH_MENU_EVENT = 'zcollab:slash-menu';

export type SlashCommandOptions = {
  onRequestUpload?: (kind: SlashUploadKind, position: number) => void;
};

export const SlashCommand = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return { onRequestUpload: undefined };
  },

  addProseMirrorPlugins() {
    const commands = createSlashCommands((kind, position) => {
      this.options.onRequestUpload?.(kind, position);
    });
    const closeMenu = () => exitSuggestion(this.editor.view, slashCommandPluginKey);

    let renderer: ReactRenderer<SlashMenuHandle, SlashMenuProps> | null = null;
    let latestProps: SuggestionProps<SlashCommandItem, SlashCommandItem> | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const toMenuProps = (
      props: SuggestionProps<SlashCommandItem, SlashCommandItem>,
    ): SlashMenuProps => ({
      items: props.items,
      query: props.query,
      command: props.command,
      onClose: closeMenu,
    });

    const positionMenu = (
      props: SuggestionProps<SlashCommandItem, SlashCommandItem>,
      current: ReactRenderer<SlashMenuHandle, SlashMenuProps>,
    ) => {
      const rect = props.clientRect?.();
      if (!rect) return;

      const element = current.element;
      const width = element.offsetWidth || MENU_WIDTH;
      const height = element.offsetHeight
        || Math.min(MENU_MAX_HEIGHT, props.items.length * 46 + 12);

      let top = rect.bottom + MENU_GAP;
      if (window.innerHeight - rect.bottom < MENU_MAX_HEIGHT) {
        top = rect.top - height - MENU_GAP;
      }
      top = Math.max(MENU_GAP, Math.min(top, window.innerHeight - height - MENU_GAP));

      let left = rect.left;
      if (left + width > window.innerWidth - 12) {
        left = window.innerWidth - width - 12;
      }
      left = Math.max(12, left);

      element.style.top = `${top}px`;
      element.style.left = `${left}px`;
    };

    const schedulePosition = (props: SuggestionProps<SlashCommandItem, SlashCommandItem>) => {
      const current = renderer;
      if (!current) return;
      requestAnimationFrame(() => {
        if (renderer === current) positionMenu(props, current);
      });
    };

    const refreshPosition = () => {
      if (renderer && latestProps) positionMenu(latestProps, renderer);
    };

    return [
      Suggestion<SlashCommandItem, SlashCommandItem>({
        editor: this.editor,
        pluginKey: slashCommandPluginKey,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        allow: ({ editor }) => !editor.isActive('codeBlock') && !editor.isActive('code'),
        items: ({ query }) => filterSlashCommands(commands, query),
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run();
          props.action(editor, range.from);
        },
        render: () => ({
          onStart: (props) => {
            latestProps = props;
            renderer = new ReactRenderer<SlashMenuHandle, SlashMenuProps>(SlashMenu, {
              editor: props.editor,
              props: toMenuProps(props),
            });
            Object.assign(renderer.element.style, {
              position: 'fixed',
              zIndex: '1000',
              width: `${MENU_WIDTH}px`,
            });
            document.body.appendChild(renderer.element);
            renderer.element.dataset.zcollabSlashMenu = '';
            window.dispatchEvent(new CustomEvent(SLASH_MENU_EVENT, { detail: { open: true } }));
            if (typeof ResizeObserver !== 'undefined') {
              resizeObserver = new ResizeObserver(refreshPosition);
              resizeObserver.observe(renderer.element);
            }
            positionMenu(props, renderer);
            schedulePosition(props);
          },
          onUpdate: (props) => {
            if (!renderer) return;
            latestProps = props;
            const current = renderer;
            const menuProps = toMenuProps(props);
            current.updateProps(menuProps);
            current.ref?.update?.(menuProps);
            positionMenu(props, current);
            schedulePosition(props);
          },
          onKeyDown: (props) => renderer?.ref?.onKeyDown?.(props) ?? false,
          onExit: () => {
            const current = renderer;
            renderer = null;
            latestProps = null;
            resizeObserver?.disconnect();
            resizeObserver = null;
            current?.destroy();
            if (current?.element.parentNode) {
              current.element.parentNode.removeChild(current.element);
            }
            window.dispatchEvent(new CustomEvent(SLASH_MENU_EVENT, { detail: { open: false } }));
          },
        }),
      }),
    ];
  },
});
