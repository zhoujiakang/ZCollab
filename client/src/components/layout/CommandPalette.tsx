import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Center, Loader, Modal, ScrollArea, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconFileText,
  IconHistory,
  IconHome,
  IconLink,
  IconPlus,
  IconSearch,
} from '@tabler/icons-react';
import { searchDocs, type DocSearchResult, type DocSummary } from '../../api/doc';
import type { WorkspaceContextValue } from '../../context/WorkspaceContext';
import { DOC_TEMPLATES, type DocTemplate } from '../../lib/docTemplates';
import classes from './CommandPalette.module.css';

interface CommandPaletteProps {
  opened: boolean;
  onClose: () => void;
  workspaceId?: string;
  docs?: DocSummary[];
  currentDocId?: string;
  workspace?: WorkspaceContextValue | null;
}

interface PaletteItem {
  id: string;
  label: string;
  description?: ReactNode;
  icon: ReactNode;
  disabled?: boolean;
  run: () => void | Promise<void>;
}

function notifyError(error: unknown) {
  notifications.show({
    color: 'red',
    title: '操作失败',
    message: error instanceof Error ? error.message : '未知错误',
  });
}

function SnippetText({ snippet }: { snippet: string }) {
  const parts = snippet.split('\u0001');
  return (
    <span className={classes.snippet}>
      {parts.map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part))}
    </span>
  );
}

export default function CommandPalette({
  opened,
  onClose,
  workspaceId,
  currentDocId,
  workspace,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<DocSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const query = input.trim();

  useEffect(() => {
    const next = input.trim();
    if (!next) {
      setTerm('');
      return;
    }
    const timer = window.setTimeout(() => setTerm(next), 300);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (!opened || !term) {
      setResults([]);
      setSearching(false);
      return;
    }
    let active = true;
    setResults([]);
    setSearching(true);
    searchDocs(term)
      .then((items) => {
        if (active) setResults(items);
      })
      .catch((error) => {
        if (active) {
          setResults([]);
          notifyError(error);
        }
      })
      .finally(() => {
        if (active) setSearching(false);
      });
    return () => {
      active = false;
    };
  }, [opened, term]);

  useEffect(() => {
    if (!opened) {
      setInput('');
      setTerm('');
      setResults([]);
      setSearching(false);
      setHighlighted(0);
    }
  }, [opened]);

  useEffect(() => {
    if (!opened) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [opened]);

  const recent = (workspace?.recent ?? []).slice(0, 5);

  const openDoc = useCallback((docId: string) => {
    if (!workspaceId) return;
    const target = `/w/${workspaceId}/p/${docId}`;
    onClose();
    if (workspace?.flushPendingSave) {
      void workspace.flushPendingSave().catch(() => undefined).finally(() => navigate(target));
    } else {
      navigate(target);
    }
  }, [navigate, onClose, workspace, workspaceId]);

  const createPage = useCallback(async (parentDocId: string | null) => {
    if (!workspaceId) return;
    if (!workspace) {
      onClose();
      navigate(`/w/${workspaceId}`);
      return;
    }
    try {
      const doc = await workspace.create(parentDocId);
      onClose();
      navigate(`/w/${workspaceId}/p/${doc.id}`);
    } catch (error) {
      notifyError(error);
    }
  }, [navigate, onClose, workspace, workspaceId]);

  const createFromTemplate = useCallback(async (template: DocTemplate) => {
    if (!workspaceId || !workspace) return;
    try {
      const doc = await workspace.createFromTemplate(template, null);
      onClose();
      navigate(`/w/${workspaceId}/p/${doc.id}`);
    } catch (error) {
      notifyError(error);
    }
  }, [navigate, onClose, workspace, workspaceId]);

  const copyCurrentLink = useCallback(async () => {
    if (!currentDocId || !workspaceId) return;
    const link = `${window.location.origin}/w/${workspaceId}/p/${currentDocId}`;
    try {
      await navigator.clipboard.writeText(link);
      notifications.show({ color: 'green', title: '链接已复制', message: link });
      onClose();
    } catch (error) {
      notifyError(error);
    }
  }, [currentDocId, onClose, workspaceId]);

  const operations = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      {
        id: 'new-page',
        label: '新建页面',
        description: '在当前工作区创建根页面',
        icon: <IconPlus size={16} stroke={1.7} />,
        run: () => createPage(null),
      },
    ];
    if (currentDocId) {
      items.push({
        id: 'new-child',
        label: '新建子页面',
        description: '以当前文档为父级创建页面',
        icon: <IconPlus size={16} stroke={1.7} />,
        run: () => createPage(currentDocId),
      });
    }
    items.push(
      {
        id: 'overview',
        label: '打开概览',
        description: '回到当前工作区概览',
        icon: <IconHome size={16} stroke={1.7} />,
        run: () => {
          if (workspaceId) navigate(`/w/${workspaceId}`);
          onClose();
        },
      },
      {
        id: 'copy-current',
        label: '复制当前文档链接',
        description: currentDocId ? '复制当前页面的完整地址' : '当前没有打开的文档',
        icon: <IconLink size={16} stroke={1.7} />,
        disabled: !currentDocId,
        run: () => copyCurrentLink(),
      },
    );
    for (const template of DOC_TEMPLATES) {
      items.push({
        id: `new-from-template-${template.id}`,
        label: `从模板新建：${template.name}`,
        description: template.description,
        icon: <IconFileText size={16} stroke={1.7} />,
        run: () => createFromTemplate(template),
      });
    }
    return items;
  }, [copyCurrentLink, createFromTemplate, createPage, currentDocId, navigate, onClose, workspaceId]);

  const recentItems = useMemo<PaletteItem[]>(() => recent.map((doc) => ({
    id: `recent-${doc.id}`,
    label: doc.title || '无标题',
    description: '最近打开',
    icon: <IconHistory size={16} stroke={1.7} />,
    run: () => openDoc(doc.id),
  })), [openDoc, recent]);

  const visibleResults = useMemo(() => results.slice(0, 8), [results]);
  const searchItems = useMemo<PaletteItem[]>(() => visibleResults.map((result) => ({
    id: `search-${result.id}`,
    label: result.title || '无标题',
    description: <SnippetText snippet={result.snippet || '（无正文）'} />,
    icon: <IconFileText size={16} stroke={1.7} />,
    run: () => openDoc(result.id),
  })), [openDoc, visibleResults]);

  const filteredOperations = useMemo<PaletteItem[]>(() => {
    if (!query) return [];
    const needle = query.toLowerCase();
    return operations.filter((item) => (
      item.label.toLowerCase().includes(needle)
      || (typeof item.description === 'string' && item.description.toLowerCase().includes(needle))
    ));
  }, [operations, query]);

  const items = query ? [...filteredOperations, ...searchItems] : [...operations, ...recentItems];

  useEffect(() => {
    setHighlighted(0);
  }, [input, opened, term]);

  useEffect(() => {
    if (highlighted >= items.length) setHighlighted(0);
  }, [highlighted, items.length]);

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (items.length) setHighlighted((current) => (current + 1) % items.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (items.length) setHighlighted((current) => (current - 1 + items.length) % items.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[highlighted];
      if (item && !item.disabled) void item.run();
    }
  };

  const renderItem = (item: PaletteItem, index: number) => (
    <button
      type="button"
      key={item.id}
      className={`${classes.item} ${index === highlighted ? classes.itemActive : ''} ${item.disabled ? classes.itemDisabled : ''}`}
      onMouseEnter={() => setHighlighted(index)}
      onClick={() => {
        if (!item.disabled) void item.run();
      }}
    >
      <span className={classes.itemIcon}>{item.icon}</span>
      <span className={classes.itemBody}>
        <span className={classes.itemLabel}>{item.label}</span>
        {item.description && <span className={classes.itemDescription}>{item.description}</span>}
      </span>
    </button>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      yOffset="12vh"
      size={620}
      withCloseButton={false}
      padding={0}
      classNames={{ content: classes.modal }}
    >
      <div className={classes.inputWrap}>
        <TextInput
          ref={(inputElement) => { inputRef.current = inputElement; }}
          autoFocus
          aria-label="命令面板"
          placeholder="搜索文档或输入命令…"
          value={input}
          onChange={(event) => setInput(event.currentTarget.value)}
          onKeyDown={handleInputKeyDown}
          leftSection={<IconSearch size={17} stroke={1.7} />}
          classNames={{ input: classes.searchInput }}
        />
      </div>

      <ScrollArea.Autosize mah={320} className={classes.results}>
        {!query ? (
          <>
            <div className={classes.groupLabel}>操作</div>
            {operations.map(renderItem)}
            {recentItems.length > 0 && (
              <>
                <div className={classes.groupLabel}>最近打开</div>
                {recentItems.map((item, index) => renderItem(item, operations.length + index))}
              </>
            )}
          </>
        ) : (
          <>
            {filteredOperations.length > 0 && (
              <>
                <div className={classes.groupLabel}>操作</div>
                {filteredOperations.map(renderItem)}
              </>
            )}
            {searching || input.trim() !== term ? (
              <Center py="xl"><Loader size="sm" /></Center>
            ) : searchItems.length ? (
              <>
                <div className={classes.groupLabel}>搜索结果</div>
                {searchItems.map((item, index) => renderItem(item, filteredOperations.length + index))}
              </>
            ) : filteredOperations.length === 0 ? (
              <Text className={classes.empty} size="sm">没有匹配的文档</Text>
            ) : null}
          </>
        )}
      </ScrollArea.Autosize>
    </Modal>
  );
}
