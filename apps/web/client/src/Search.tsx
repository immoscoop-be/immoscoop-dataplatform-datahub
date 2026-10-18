import { Alert, Anchor, Badge, Box, Button, EmptyState, Group, Paper, SimpleGrid, Skeleton, Stack, Text, TextInput, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import type { Api, Project, SearchHit } from './api.js';
import { formatMoment, plural, projectOf } from './format.js';
import { SearchIcon } from './icons.js';
import { hrefFor } from './route.js';

/** The start page of the Data Team: search the dbt projects, or see how fresh they are. */
export function SearchPage({ api, query }: { api: Api; query: string }) {
  const [text, setText] = useState(query);
  useEffect(() => setText(query), [query]);
  const projects = useQuery({ queryKey: ['projects'], queryFn: api.projects, staleTime: 60_000 });
  const hits = useQuery({ queryKey: ['search', query], queryFn: () => api.search(query), enabled: query.length > 0 });

  function submit(event: FormEvent) {
    event.preventDefault();
    const wanted = text.trim();
    if (wanted) {
      window.location.hash = hrefFor({ page: 'search', query: wanted });
    }
  }

  return (
    <Stack gap={40} maw={880}>
      <Stack gap="xs">
        <Title order={1}>Search the dbt projects</Title>
        <Text c="dimmed">Models, sources, seeds, snapshots and exposures of dbt-prod and Colleciónes, as their last run left them. A name with a typo works too.</Text>
      </Stack>
      <form onSubmit={submit} role="search">
        <Group gap="sm" wrap="nowrap">
          <TextInput
            flex={1}
            size="lg"
            radius="xl"
            type="search"
            aria-label="Search text"
            placeholder="A model, source, column or description"
            leftSection={<SearchIcon />}
            value={text}
            onChange={(event) => setText(event.currentTarget.value)}
            maxLength={200}
            autoFocus
          />
          <Button type="submit" size="lg" radius="xl">
            Search
          </Button>
        </Group>
      </form>
      {query ? (
        hits.isPending ? (
          <Loading rows={4} />
        ) : hits.isError ? (
          <Problem title="The search did not work">{hits.error.message}</Problem>
        ) : (
          <SearchResults query={query} hits={hits.data} />
        )
      ) : projects.isPending ? (
        <Loading rows={2} />
      ) : projects.isError ? (
        <Problem title="registry did not answer">{projects.error.message}</Problem>
      ) : (
        <ProjectList projects={projects.data} />
      )}
    </Stack>
  );
}

/** Per dbt project, the run that is its Current Version. */
export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <EmptyState title="No runs yet" description="No run of a Source Job has come in yet." />;
  }
  return (
    <Stack gap="md">
      <Title order={2} size="h4">
        Current Versions
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
        {projects.map((project) => (
          <Paper key={project.projectId} withBorder radius="lg" p="lg">
            <Text fw={600}>{project.name ?? `Project ${project.projectId}`}</Text>
            {project.runId && project.processedAt ? (
              <>
                <Text size="sm" mt={4}>
                  Run {project.runId} · {plural(project.nodeCount, 'Node')}
                </Text>
                <Text size="sm" c="dimmed">
                  Processed {formatMoment(project.processedAt)}
                </Text>
              </>
            ) : (
              <Text size="sm" c="dimmed" mt={4}>
                Nothing processed yet
              </Text>
            )}
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

/** The Nodes found, the best match first. */
export function SearchResults({ query, hits }: { query: string; hits: SearchHit[] }) {
  if (hits.length === 0) {
    return <EmptyState icon={<SearchIcon size={28} />} withIndicatorBackground title={`Nothing found for “${query}”`} description="Try part of the name, or a word from the description." />;
  }
  return (
    <Stack gap={0}>
      <Text size="sm" c="dimmed" mb="xs">
        {plural(hits.length, 'Node')} found for “{query}”
      </Text>
      {hits.map((hit) => (
        <Box key={hit.uniqueId} py="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          <Group gap="xs" wrap="wrap">
            <Anchor href={hrefFor({ page: 'node', uniqueId: hit.uniqueId })} fw={600}>
              {hit.name}
            </Anchor>
            <Badge variant="light" color="teal" size="sm">
              {hit.resourceType}
            </Badge>
            <Text size="sm" c="dimmed">
              {projectOf(hit)}
            </Text>
          </Group>
          {hit.description && (
            <Text size="sm" mt={4} lineClamp={2}>
              {hit.description}
            </Text>
          )}
          {hit.matchedColumns.length > 0 && (
            <Text size="xs" c="dimmed" mt={4}>
              Columns: {hit.matchedColumns.join(', ')}
            </Text>
          )}
        </Box>
      ))}
    </Stack>
  );
}

export function Loading({ rows }: { rows: number }) {
  return (
    <Stack gap="md" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} h={56} radius="md" />
      ))}
    </Stack>
  );
}

export function Problem({ title, children }: { title: string; children: string }) {
  return (
    <Alert color="magenta" variant="light" title={title}>
      {children}
    </Alert>
  );
}
