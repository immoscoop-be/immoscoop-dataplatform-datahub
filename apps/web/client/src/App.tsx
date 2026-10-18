import { Center, Loader, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SignedOut, type Api } from './api.js';
import { NodePage } from './Node.js';
import { useRoute } from './route.js';
import { SearchPage } from './Search.js';
import { explain, SignInProblem, type Session } from './session.js';
import { Shell } from './Shell.js';
import { SignIn } from './SignIn.js';

/** The role of the Data Team, from its Role Group `datahub-datateam@` (Naming Convention). */
const DATA_TEAM = 'datateam';

export function App({ api, session }: { api: Api; session: Pick<Session, 'signOut'> }) {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });

  if (me.isPending) {
    return (
      <Center mih="100vh">
        <Loader aria-label="Checking whether you are signed in" />
      </Center>
    );
  }
  if (me.isError) {
    const error = me.error;
    // After a failed sign-in, identity sends the User back with the reason in the address.
    const returned = new URLSearchParams(window.location.search).get('error');
    const problem =
      error instanceof SignedOut ? (returned ? explain(returned) : undefined) : error instanceof SignInProblem ? explain(error.code) : `identity did not accept the Access Token: ${error.message}`;
    return <SignIn problem={problem} />;
  }

  async function signOut() {
    await session.signOut();
    window.location.replace('/');
  }

  return (
    <Shell me={me.data} onSignOut={signOut}>
      {me.data.roles.includes(DATA_TEAM) ? <Registry api={api} /> : <Welcome name={me.data.name} />}
    </Shell>
  );
}

/** What the Data Team can do today: search the dbt projects and read a Node. */
function Registry({ api }: { api: Api }) {
  const route = useRoute();
  // A Node leads back to the results it was found in.
  const [lastQuery, setLastQuery] = useState('');
  const query = route.page === 'search' ? route.query : undefined;
  useEffect(() => {
    if (query !== undefined) {
      setLastQuery(query);
    }
  }, [query]);
  return route.page === 'node' ? <NodePage api={api} uniqueId={route.uniqueId} backTo={lastQuery} /> : <SearchPage api={api} query={route.query} />;
}

function Welcome({ name }: { name: string }) {
  return (
    <Stack gap="xs" maw={640}>
      <Title order={1}>Welcome, {name.split(' ')[0]}</Title>
      <Text c="dimmed">Searching the dbt projects is for the Data Team for now. The rest of Data Hub comes here as it is built.</Text>
    </Stack>
  );
}
