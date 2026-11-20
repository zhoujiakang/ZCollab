import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import './lib/collab/url';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={{ primaryColor: 'teal' }}>
      <Notifications />
      <App />
    </MantineProvider>
  </React.StrictMode>,
);
