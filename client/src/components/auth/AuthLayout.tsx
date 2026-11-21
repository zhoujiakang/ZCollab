import type { ReactNode } from 'react';
import { Group, Text } from '@mantine/core';
import classes from './auth.module.css';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className={classes.root}>
      <Group justify="center" gap={8} className={classes.logo}>
        <span className={classes.logoMark}>Z</span>
        <Text size="28px" fw={700} className={classes.logoText}>ZCollab</Text>
      </Group>
      <main className={classes.main}>{children}</main>
    </div>
  );
}
