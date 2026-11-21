import { useEffect, useState } from 'react';
import { Center, Container, Loader, Stack, Text } from '@mantine/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { getPublicShare, type PublicShareDoc } from '../api/share';
import { parseDocContent } from '../lib/docContent';
import editorClasses from './page/Editor.module.css';
import classes from './SharePage.module.css';

function ReadOnlyBody({ content }: { content: string }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: parseDocContent(content),
    editable: false,
    editorProps: {
      attributes: { class: 'zcollab-editor', 'aria-label': '文档正文', tabindex: '-1' },
    },
  });
  return <div className={`${editorClasses.editor} ${editorClasses.readonly}`}><EditorContent editor={editor} /></div>;
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
    <div className={classes.page}>
      <Container className={classes.inner} p={0}>
        <div className={classes.card}>
          {failed ? (
            <Center py={80}>
              <Text c="dimmed">链接已失效</Text>
            </Center>
          ) : !doc ? (
            <Center py={80}>
              <Loader />
            </Center>
          ) : (
            <Stack gap="lg">
              <h1 className={classes.title}>{doc.title || '无标题'}</h1>
              <ReadOnlyBody content={doc.content} />
              <Text size="sm" c="dimmed" ta="center" pt="sm">来自 ZCollab</Text>
            </Stack>
          )}
        </div>
      </Container>
    </div>
  );
}
