import { useState } from 'react';
import { Avatar, Button, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconChevronRight } from '@tabler/icons-react';
import type { CreateCommentInput, DocComment } from '../../api/comment';
import { formatRelativeTime } from '../../lib/relativeTime';
import type { CommentDraft } from '../layout/CommentDraftContext';
import classes from './CommentPanel.module.css';

interface CommentPanelProps {
  docId: string;
  comments: DocComment[];
  draft: CommentDraft | null;
  setDraft: (draft: CommentDraft | null) => void;
  create: (input: CreateCommentInput) => Promise<void>;
  resolve: (id: string, resolved: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

interface ItemProps {
  comment: DocComment;
  isReply?: boolean;
  replyOpen: boolean;
  replyText: string;
  replySubmitting: boolean;
  onReplyClick: (id: string) => void;
  onReplyTextChange: (value: string) => void;
  onReplyCancel: () => void;
  onReplySubmit: (id: string) => void;
  onResolve: (comment: DocComment) => void;
  onDelete: (comment: DocComment) => void;
}

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

function CommentItem({
  comment, isReply, replyOpen, replyText, replySubmitting,
  onReplyClick, onReplyTextChange, onReplyCancel, onReplySubmit, onResolve, onDelete,
}: ItemProps) {
  return (
    <div className={`${classes.item} ${isReply ? classes.reply : ''}`}>
      <div className={classes.head}>
        <Avatar src={comment.author.avatarUrl ?? undefined} name={comment.author.name} size="xs" radius="xl" />
        <span className={classes.name}>{comment.author.name}</span>
        <span className={classes.time}>{formatRelativeTime(comment.createdAt)}</span>
      </div>
      {comment.quote && <div className={classes.quote}>{comment.quote}</div>}
      <div className={classes.body}>{comment.body}</div>
      <div className={classes.actions}>
        {!isReply && (
          <button type="button" className={classes.action} onClick={() => onReplyClick(comment.id)}>回复</button>
        )}
        {!isReply && (
          <button type="button" className={classes.action} onClick={() => onResolve(comment)}>
            {comment.resolvedAt ? '重新打开' : '解决'}
          </button>
        )}
        {comment.canDelete && (
          <button type="button" className={classes.action} onClick={() => onDelete(comment)}>删除</button>
        )}
      </div>
      {!isReply && replyOpen && (
        <div className={classes.replyComposer}>
          <Textarea
            autosize
            minRows={1}
            maxRows={6}
            size="xs"
            value={replyText}
            disabled={replySubmitting}
            placeholder="写下你的回复…"
            onChange={(event) => onReplyTextChange(event.currentTarget.value)}
          />
          <div className={classes.actions}>
            <Button size="compact-xs" loading={replySubmitting} disabled={!replyText.trim()} onClick={() => onReplySubmit(comment.id)}>
              回复
            </Button>
            <Button size="compact-xs" variant="subtle" disabled={replySubmitting} onClick={onReplyCancel}>取消</Button>
          </div>
        </div>
      )}
      {comment.replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          isReply
          replyOpen={false}
          replyText=""
          replySubmitting={false}
          onReplyClick={onReplyClick}
          onReplyTextChange={onReplyTextChange}
          onReplyCancel={onReplyCancel}
          onReplySubmit={onReplySubmit}
          onResolve={onResolve}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default function CommentPanel({
  docId, comments, draft, setDraft, create, resolve, remove,
}: CommentPanelProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const submitComment = async () => {
    const body = text.trim();
    if (!body) return;
    setSubmitting(true);
    try {
      await create({
        docId,
        parentId: null,
        body,
        quote: draft?.quote ?? null,
        anchorFrom: draft?.from ?? null,
        anchorTo: draft?.to ?? null,
      });
      setText('');
      setDraft(null);
    } catch (error) {
      notifyError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const submitReply = async (parentId: string) => {
    const body = replyText.trim();
    if (!body) return;
    setReplySubmitting(true);
    try {
      await create({ docId, parentId, body, quote: null, anchorFrom: null, anchorTo: null });
      setReplyText('');
      setReplyTo(null);
    } catch (error) {
      notifyError(error);
    } finally {
      setReplySubmitting(false);
    }
  };

  const openComments = comments.filter((comment) => !comment.resolvedAt);
  const resolvedComments = comments.filter((comment) => !!comment.resolvedAt);

  const renderItem = (comment: DocComment) => (
    <CommentItem
      key={comment.id}
      comment={comment}
      replyOpen={replyTo === comment.id}
      replyText={replyText}
      replySubmitting={replySubmitting}
      onReplyClick={(id) => {
        setReplyTo((current) => (current === id ? null : id));
        setReplyText('');
      }}
      onReplyTextChange={setReplyText}
      onReplyCancel={() => {
        setReplyTo(null);
        setReplyText('');
      }}
      onReplySubmit={(id) => void submitReply(id)}
      onResolve={(item) => {
        void resolve(item.id, !item.resolvedAt).catch(notifyError);
      }}
      onDelete={(item) => {
        void remove(item.id).catch(notifyError);
      }}
    />
  );

  return (
    <div className={classes.panel}>
      {draft && (
        <div className={classes.composer}>
          <div className={classes.quote}>{draft.quote}</div>
          <Textarea
            autosize
            minRows={2}
            maxRows={6}
            size="xs"
            value={text}
            disabled={submitting}
            placeholder="写下你的评论…"
            onChange={(event) => setText(event.currentTarget.value)}
          />
          <div className={classes.actions}>
            <Button size="compact-xs" loading={submitting} disabled={!text.trim()} onClick={() => void submitComment()}>评论</Button>
            <Button
              size="compact-xs"
              variant="subtle"
              disabled={submitting}
              onClick={() => {
                setDraft(null);
                setText('');
              }}
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {comments.length === 0 ? (
        <Text size="xs" c="dimmed" p="md">还没有评论，选中一段文字试试</Text>
      ) : (
        <div className={classes.list}>
          {openComments.map(renderItem)}
          {resolvedComments.length > 0 && (
            <div className={classes.resolvedGroup}>
              <button type="button" className={classes.groupToggle} onClick={() => setShowResolved((value) => !value)}>
                <IconChevronRight
                  size={14}
                  stroke={1.7}
                  className={showResolved ? classes.chevronOpen : undefined}
                />
                已解决（{resolvedComments.length}）
              </button>
              {showResolved && resolvedComments.map(renderItem)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
