import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, Group, NavLink, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';

export interface SettingsNavItem {
  key: string;
  label: ReactNode;
  icon: ReactNode;
}

interface SettingsShellProps {
  title: string;
  backTo: string;
  items: SettingsNavItem[];
  active: string;
  onSelect: (key: string) => void;
  children: ReactNode;
}

export default function SettingsShell({
  title,
  backTo,
  items,
  active,
  onSelect,
  children,
}: SettingsShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.key === 'default') navigate(backTo);
    else navigate(-1);
  };

  return (
    <Box style={{ minHeight: '100vh' }}>
      <Group
        gap="sm"
        px="lg"
        style={{ height: 56, borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <Button
          variant="subtle"
          px="xs"
          leftSection={<IconArrowLeft size={18} stroke={1.7} />}
          onClick={handleBack}
        >
          返回
        </Button>
        <Title order={4}>{title}</Title>
      </Group>

      <Group
        align="flex-start"
        gap="xl"
        wrap="nowrap"
        style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}
      >
        <Box style={{ flex: '0 0 180px', width: 180 }}>
          {items.map((item) => (
            <NavLink
              key={item.key}
              label={item.label}
              leftSection={item.icon}
              active={active === item.key}
              onClick={() => onSelect(item.key)}
            />
          ))}
        </Box>

        <Box style={{ flex: 1, minWidth: 0, maxWidth: 720 }}>{children}</Box>
      </Group>
    </Box>
  );
}
