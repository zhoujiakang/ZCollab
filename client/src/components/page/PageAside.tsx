import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { ActionIcon, CopyButton, ScrollArea, Tabs, Text, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { getDocPath } from '../../lib/docTree';
import { useAside } from '../layout/AsideContext';
import classes from './PageAside.module.css';

function formatRelativeTime(value: string | null) {
  if (!value) return '—';
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '—';
  const diff = Math.max(0, Date.now() - timestamp);
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={classes.row}>
      <div className={classes.label}>{label}</div>
      <div className={classes.value}>{children}</div>
    </div>
  );
}

export default function PageAside() {
  const { data } = useAside();
  const { docs } = useWorkspace();
  const { docId } = useParams();
  const path = getDocPath(docs, docId);
  const location = path.length
    ? path.map((item) => item.title || '无标题').join(' / ')
    : data?.title || '无标题';

  return (
    <Tabs
      defaultValue="toc"
      classNames={{ root: classes.root, list: classes.list, panel: classes.panel }}
    >
      <Tabs.List>
        <Tabs.Tab value="toc">目录</Tabs.Tab>
        <Tabs.Tab value="detail">详情</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="toc">
        <ScrollArea h="100%" type="auto" className={classes.scroll}>
          {data?.headings.length ? (
            <div className={classes.toc}>
              {data.headings.map((heading) => (
                <button
                  key={heading.id}
                  type="button"
                  title={heading.text}
                  className={`${classes.tocItem} ${data.activeHeadingId === heading.id ? classes.active : ''}`}
                  style={{ paddingLeft: `${Math.max(0, heading.level - 1) * 12}px` }}
                  onClick={() => data.onJump(heading.id)}
                >
                  <span className={classes.tocText}>{heading.text}</span>
                </button>
              ))}
            </div>
          ) : (
            <Text size="xs" c="dimmed" p="md">这篇还没有标题</Text>
          )}
        </ScrollArea>
      </Tabs.Panel>

      <Tabs.Panel value="detail">
        <ScrollArea h="100%" type="auto" className={classes.scroll}>
          <div className={classes.details}>
            <DetailRow label="所在位置">{location}</DetailRow>
            <DetailRow label="字数">{data?.meta.chars ?? 0}</DetailRow>
            <DetailRow label="字符数">{data?.meta.charsWithSpace ?? 0}</DetailRow>
            <DetailRow label="段落数">{data?.meta.paragraphs ?? 0}</DetailRow>
            <DetailRow label="最后编辑">{formatRelativeTime(data?.updatedAt ?? null)}</DetailRow>
            <DetailRow label="在线人数">{data?.meta.online ?? 0}</DetailRow>
            <DetailRow label="文档 id">
              <div className={classes.idRow}>
                <span className={classes.idText} title={docId}>{docId || '—'}</span>
                <CopyButton value={docId ?? ''}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? '已复制' : '复制文档 id'} withArrow>
                      <ActionIcon
                        size="compact-xs"
                        variant="subtle"
                        aria-label="复制文档 id"
                        onClick={copy}
                      >
                        {copied ? <IconCheck size={14} stroke={1.7} /> : <IconCopy size={14} stroke={1.7} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </div>
            </DetailRow>
          </div>
        </ScrollArea>
      </Tabs.Panel>
    </Tabs>
  );
}
