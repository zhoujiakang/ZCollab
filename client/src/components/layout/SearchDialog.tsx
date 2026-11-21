import { useEffect, useState } from 'react';
import { Center, Loader, Modal, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { searchDocs, type DocSearchResult } from '../../api/doc';
import classes from './SearchDialog.module.css';

interface SearchDialogProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (docId: string) => void;
}

function SnippetText({ snippet }: { snippet: string }) {
  const parts = snippet.split('\u0001');
  return (
    <span className={classes.snippet}>
      {parts.map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : part))}
    </span>
  );
}

export default function SearchDialog({ opened, onClose, onSelect }: SearchDialogProps) {
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<DocSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

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
          notifications.show({
            color: 'red',
            title: '搜索失败',
            message: error instanceof Error ? error.message : '未知错误',
          });
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
    }
  }, [opened]);

  return (
    <Modal opened={opened} onClose={onClose} title="搜索文档" centered size="lg">
      <TextInput
        autoFocus
        aria-label="搜索文档"
        placeholder="输入关键词搜索文档"
        value={input}
        onChange={(event) => setInput(event.currentTarget.value)}
      />
      <div className={classes.results}>
        {!term ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            输入关键词开始搜索
          </Text>
        ) : searching || input.trim() !== term ? (
          <Center py="xl"><Loader size="sm" /></Center>
        ) : results.length ? (
          results.map((result) => (
            <button
              type="button"
              key={result.id}
              className={classes.result}
              onClick={() => {
                onSelect(result.id);
                onClose();
              }}
            >
              {result.title || '无标题'}
              <SnippetText snippet={result.snippet || '（无正文）'} />
            </button>
          ))
        ) : (
          <Text size="sm" c="dimmed" ta="center" py="xl">没有匹配的文档</Text>
        )}
      </div>
    </Modal>
  );
}
