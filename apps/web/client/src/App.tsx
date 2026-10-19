import { Center, Loader, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SignedOut, type Api } from './api.js';
import { ChartPage, ChartsPage } from './Charts.js';
import { NodePage } from './Node.js';
import { hrefFor, useRoute, type Route, type SearchRoute } from './route.js';
import { SearchPage } from './Search.js';
import { explain, SignInProblem, type Session } from './session.js';
import { Shell, type NavItem } from './Shell.js';
import { SignIn } from './SignIn.js';

/** The role of the Data Team, from its Role Group `datahub-datateam@` (Naming Convention). */
const DATA_TEAM = 'datateam';

export function App({ api, session, semgraphUrl }: { api: Api; session: Pick<Session, 'signOut'>; semgraphUrl: string }) {
  const me = useQuery({ queryKey: ['me'], queryFn: api.me });
  const route = useRoute();

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

  const dataTeam = me.data.roles.includes(DATA_TEAM);
  const charts = route.page === 'charts' || route.page === 'chart' || !dataTeam;
  const nav: NavItem[] = [
    ...(dataTeam ? [{ label: 'dbt projects', href: hrefFor({ page: 'search', query: '' }), active: !charts }] : []),
    { label: 'Charts', href: hrefFor({ page: 'charts' }), active: charts },
  ];

  return (
    <Shell me={me.data} nav={nav} onSignOut={signOut}>
      <Page api={api} route={route} dataTeam={dataTeam} semgraphUrl={semgraphUrl} />
    </Shell>
  );
}

/** The page for the address: the charts for everyone; searching the dbt projects for the Data Team. */
function Page({ api, route, dataTeam, semgraphUrl }: { api: Api; route: Route; dataTeam: boolean; semgraphUrl: string }) {
  // A Node leads back to the results it was found in, within the same dbt project.
  const [lastSearch, setLastSearch] = useState<Omit<SearchRoute, 'page'>>({ query: '' });
  const query = route.page === 'search' ? route.query : undefined;
  const project = route.page === 'search' ? route.project : undefined;
  useEffect(() => {
    if (query !== undefined) {
      setLastSearch({ query, ...(project ? { project } : {}) });
    }
  }, [query, project]);

  switch (route.page) {
    case 'chart':
      return <ChartPage api={api} semgraphUrl={semgraphUrl} id={route.id} />;
    case 'charts':
      return <ChartsPage api={api} semgraphUrl={semgraphUrl} />;
    case 'node':
      return dataTeam ? <NodePage api={api} uniqueId={route.uniqueId} backTo={lastSearch} /> : <DataTeamOnly />;
    case 'search':
      return dataTeam ? <SearchPage api={api} query={route.query} project={route.project} /> : <ChartsPage api={api} semgraphUrl={semgraphUrl} />;
  }
}

function DataTeamOnly() {
  return (
    <Stack gap="xs" maw={640}>
      <Title order={1}>For the Data Team, for now</Title>
      <Text c="dimmed">Reading the dbt projects is for the Data Team for now. The charts are open to everyone.</Text>
    </Stack>
  );
}
