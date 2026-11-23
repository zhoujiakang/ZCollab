import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { CommentRange } from '../../lib/commentAnchor';

interface CommentAnchorsState {
  ranges: CommentRange[];
  activeId: string | null;
}

const ACTIVE_META_KEY = 'commentAnchorsActive';

export const commentAnchorsPluginKey = new PluginKey<CommentAnchorsState>('commentAnchors');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentAnchors: {
      updateCommentAnchors: (ranges: CommentRange[]) => ReturnType;
      clearCommentAnchors: () => ReturnType;
      setActiveCommentAnchor: (id: string | null) => ReturnType;
    };
  }
}

export const CommentAnchors = Extension.create({
  name: 'commentAnchors',

  addProseMirrorPlugins() {
    return [
      new Plugin<CommentAnchorsState>({
        key: commentAnchorsPluginKey,
        state: {
          init: () => ({ ranges: [], activeId: null }),
          apply(tr, prev) {
            const activeId = tr.getMeta(ACTIVE_META_KEY) as string | null | undefined;
            const meta = tr.getMeta(commentAnchorsPluginKey) as CommentRange[] | undefined;

            if (meta === undefined && activeId === undefined) {
              if (!tr.docChanged) return prev;
              const ranges: CommentRange[] = [];
              for (const range of prev.ranges) {
                const from = tr.mapping.map(range.from);
                const to = tr.mapping.map(range.to, -1);
                if (from < to) ranges.push({ ...range, from, to });
              }
              return { ...prev, ranges };
            }

            return {
              ranges: meta === undefined ? prev.ranges : meta,
              activeId: activeId === undefined ? prev.activeId : activeId,
            };
          },
        },
        props: {
          decorations(state) {
            const pluginState = commentAnchorsPluginKey.getState(state);
            if (!pluginState?.ranges.length) return DecorationSet.empty;
            // PM 会把完全重合的 inline decoration 合并成一个 span，导致后者的
            // data-comment-id 覆盖前者。同一句有多条评论时把范围均分成不重叠的段，
            // 每条评论各自保留一处可点击高亮。
            const groups = new Map<string, CommentRange[]>();
            for (const range of pluginState.ranges) {
              const key = `${range.from}:${range.to}`;
              const group = groups.get(key) ?? [];
              group.push(range);
              groups.set(key, group);
            }
            const decorations = pluginState.ranges.map((range) => {
              const group = groups.get(`${range.from}:${range.to}`)!;
              const index = group.indexOf(range);
              const step = (range.to - range.from) / group.length;
              const from = range.from + Math.floor(index * step);
              const to = index === group.length - 1
                ? range.to
                : range.from + Math.floor((index + 1) * step);
              return Decoration.inline(
                from,
                Math.max(to, from + 1),
                {
                  class: 'comment-highlight',
                  'data-comment-id': range.id,
                  ...(pluginState.activeId === range.id ? { 'data-active': 'true' } : {}),
                },
              );
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      updateCommentAnchors: (ranges) => ({ tr, dispatch }) => {
        if (dispatch) tr.setMeta(commentAnchorsPluginKey, ranges);
        return true;
      },
      clearCommentAnchors: () => ({ tr, dispatch }) => {
        if (dispatch) tr.setMeta(commentAnchorsPluginKey, []);
        return true;
      },
      setActiveCommentAnchor: (id) => ({ tr, dispatch }) => {
        if (dispatch) tr.setMeta(ACTIVE_META_KEY, id);
        return true;
      },
    };
  },
});
