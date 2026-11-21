import { useNavigate, useParams } from 'react-router-dom';
import { Button, Group, Text, Title } from '@mantine/core';
import { IconFileText, IconPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../context/AuthContext';
import { useWorkspace } from '../context/WorkspaceContext';
import classes from './pages.module.css';

export default function WorkspaceOverviewPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const { docs, loadingDocs, create } = useWorkspace();
  const workspace = workspaceId!;

  const handleCreate = async () => {
    try {
      const doc = await create(null);
      navigate(`/w/${workspace}/p/${doc.id}`);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: '操作失败',
        message: error instanceof Error ? error.message : '未知错误',
      });
    }
  };

  return (
    <div className={classes.content}>
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Title order={2}>{user?.activeWorkspace?.name || '工作区'}</Title>
          <Text className={classes.muted}>概览 · 最近文档</Text>
        </div>
        <Button leftSection={<IconPlus size={16} stroke={1.7} />} onClick={() => void handleCreate()}>
          新建页面
        </Button>
      </Group>

      <div className={`${classes.card} ${classes.section}`}>
        {loadingDocs ? (
          <Text className={classes.muted}>正在加载文档…</Text>
        ) : docs.length ? (
          <div className={classes.docList}>
            {[...docs].reverse().map((doc) => (
              <button
                type="button"
                key={doc.id}
                className={classes.docButton}
                onClick={() => navigate(`/w/${workspace}/p/${doc.id}`)}
              >
                <IconFileText size={16} stroke={1.7} />
                {doc.title || '无标题'}
              </button>
            ))}
          </div>
        ) : (
          <Text className={classes.muted}>还没有文档，点击右上角新建一页。</Text>
        )}
      </div>
    </div>
  );
}
