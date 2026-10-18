// Poppins from the app's own address, in the weights and the Latin scripts the app uses.
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-ext-400.css';
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-ext-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-ext-600.css';
import '@mantine/core/styles.css';
import { cssVariablesResolver, theme } from '@datahub/ui';
import { MantineProvider } from '@mantine/core';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createApi, ServiceError, SignedOut } from './api.js';
import { App } from './App.js';
import { readConfig } from './config.js';
import { createSession } from './session.js';

const config = readConfig(document);
const session = createSession();
const api = createApi(config, session);

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // A session that ends while the User works: ask identity again, which then shows the sign-in.
    onError: (error, query) => {
      if (error instanceof SignedOut && query.queryKey[0] !== 'me') {
        void queryClient.invalidateQueries({ queryKey: ['me'] });
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Only a failure that may pass is tried again: not a missing session, nor a refusal.
      retry: (failures, error) => failures < 2 && !(error instanceof SignedOut) && !(error instanceof ServiceError && error.status < 500),
      refetchOnWindowFocus: false,
    },
  },
});

const root = document.getElementById('root');
if (!root) {
  throw new Error('The page has no element #root.');
}
createRoot(root).render(
  <StrictMode>
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} forceColorScheme="light" getStyleNonce={() => config.styleNonce}>
      <QueryClientProvider client={queryClient}>
        <App api={api} session={session} semgraphUrl={config.semgraphUrl} />
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
