import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import App from './App';
import SharePage, { shareTokenFromPath } from './components/SharePage';

const shareToken = shareTokenFromPath(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={{ primaryColor: 'teal' }}>
      <Notifications />
      {shareToken ? <SharePage token={shareToken} /> : <App />}
    </MantineProvider>
  </React.StrictMode>,
);
