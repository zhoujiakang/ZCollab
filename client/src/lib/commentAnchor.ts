import type { Node as PMNode } from '@tiptap/pm/model';
import type { DocComment } from '../api/comment';

export interface FlatText {
  text: string;
  positions: number[];
}

export interface CommentRange {
  id: string;
  from: number;
  to: number;
}

/**
 * 把文档拍平成与 `doc.textBetween(from, to, ' ')` 一致的字符串。
 * positions[i] 是 text[i] 在 ProseMirror 文档中的位置；块间补出来的空格
 * 记为 -1，表示它不属于任何原文字符。
 */
export function buildFlatText(doc: PMNode): FlatText {
  const chars: string[] = [];
  const positions: number[] = [];
  let pendingSeparator = false;

  doc.descendants((node, pos) => {
    if (node.isText) {
      if (pendingSeparator) {
        chars.push(' ');
        positions.push(-1);
        pendingSeparator = false;
      }
      const text = node.text ?? '';
      for (let i = 0; i < text.length; i += 1) {
        chars.push(text[i]);
        positions.push(pos + i);
      }
      return;
    }
    // 连续空块只留一个待分隔标记，真正遇到文本时才补一个空格；文档开头不补。
    if (chars.length > 0 && node.isBlock && node.type.name !== 'doc') pendingSeparator = true;
  });

  return { text: chars.join(''), positions };
}

/** 在当前扁平文本里按 quote 回查位置；失败返回 null，交给上层降级。 */
export function locateQuote(
  flat: FlatText,
  quote: string,
  anchorFrom?: number | null,
): { from: number; to: number } | null {
  if (!quote) return null;

  let best: { from: number; to: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let start = flat.text.indexOf(quote);

  while (start !== -1) {
    const slice = flat.positions.slice(start, start + quote.length);
    if (slice.length === quote.length) {
      let firstReal = -1;
      let lastReal = -1;
      let valid = true;
      for (let i = 0; i < slice.length; i += 1) {
        if (slice[i] >= 0) {
          if (firstReal === -1) firstReal = slice[i];
          lastReal = slice[i];
        } else if (quote[i] !== ' ') {
          // 跨到块间分隔符但 quote 对应位置不是空格：不是同一次引用，换下一个起点。
          valid = false;
          break;
        }
      }
      // quote 自身含块间空格时，用首尾真实字符位置圈定跨段范围。
      if (valid && firstReal !== -1) {
        const from = firstReal;
        const to = lastReal + 1;
        const distance = typeof anchorFrom === 'number' && Number.isFinite(anchorFrom)
          ? Math.abs(from - anchorFrom)
          : 0;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { from, to };
          if (distance === 0 && typeof anchorFrom === 'number') break;
        }
      }
    }
    start = flat.text.indexOf(quote, start + 1);
  }

  return best;
}

/** 只算未解决且有引用文字的评论；同一篇文档的 flat 只建一次。 */
export function computeCommentRanges(doc: PMNode, comments: DocComment[]): CommentRange[] {
  const quoted = comments.filter((comment) => !comment.resolvedAt && comment.quote);
  if (quoted.length === 0) return [];

  const flat = buildFlatText(doc);
  const ranges: CommentRange[] = [];
  for (const comment of quoted) {
    const range = locateQuote(flat, comment.quote as string, comment.anchorFrom);
    if (range) ranges.push({ id: comment.id, ...range });
  }
  return ranges;
}
