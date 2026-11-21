import { useEffect, useState } from 'react';
import { Box, Center, Container, Loader, Paper, Stack, Text, Title } from '@mantine/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { getPublicShare, type PublicShareDoc } from '../api/share';
import { editorStyles, parseDocContent } from '../lib/docContent';
import { pageStyle } from './pageStyle';

const readonlyStyles = `
.zcollab-editor[contenteditable="false"] { cursor: default; caret-color: transparent; }
.zcollab-editor[contenteditable="false"] * { cursor: inherit; }
`;

export function shareTokenFromPath(pathname: string): string | null {
  const match = /^\/s\/([^/?#]+)\/?$/.exec(pathname);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function ReadOnlyBody({ content }: { content: string }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: parseDocContent(content),
    editable: false,
    editorProps: {
      attributes: { class: 'zcollab-editor', 'aria-label': '文档正文', tabindex: '-1' },
    },
  });
  return <EditorContent editor={editor} />;
}

export default function SharePage({ token }: { token: string }) {
  const [doc, setDoc] = useState<PublicShareDoc | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDoc(null);
    setFailed(false);
    getPublicShare(token)
      .then((result) => {
        if (active) setDoc(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <Box mih="100vh" p={{ base: 'md', sm: 'xl' }} style={pageStyle}>
      <style>{editorStyles}</style>
      <style>{readonlyStyles}</style>
      <Container size="md" py="xl">
        <Paper shadow="sm" radius="lg" withBorder p={{ base: 'md', sm: 'xl' }}>
          {failed ? (
            <Center py={80}>
              <Text c="dimmed">链接已失效</Text>
            </Center>
          ) : !doc ? (
            <Center py={80}>
              <Loader color="teal" />
            </Center>
          ) : (
            <Stack gap="lg">
              <Title order={1} style={{ fontSize: 34, fontWeight: 700, wordBreak: 'break-word' }}>
                {doc.title || '无标题'}
              </Title>
              <ReadOnlyBody content={doc.content} />
              <Text size="sm" c="dimmed" ta="center" pt="sm">来自 ZCollab</Text>
            </Stack>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
