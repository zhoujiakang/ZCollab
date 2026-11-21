import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './styles/global.css';
import App from './App';
import { readStoredColorScheme, theme } from './theme';

createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={theme} defaultColorScheme={readStoredColorScheme()}>
    <Notifications />
    <App />
  </MantineProvider>,
);
