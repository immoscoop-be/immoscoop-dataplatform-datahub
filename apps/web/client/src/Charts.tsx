import { Anchor, Box, Code, Group, List, Paper, SegmentedControl, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Api, ChartCatalog, ChartDetail, ChartExample } from './api.js';
import { plural } from './format.js';
import { BackIcon } from './icons.js';
import { hrefFor } from './route.js';
import { Loading, Problem } from './Search.js';

// The values of `theme` and `size` that semgraph takes when it draws an example (REQ-107 of semgraph).
const THEMES = ['light', 'dark'] as const;
const SIZES = ['card', 'default', 'large', 'xl'] as const;
type Theme = (typeof THEMES)[number];
type Size = (typeof SIZES)[number];

/** Where semgraph draws an example; without a theme or size, as the example itself asks. */
export function exampleImage(semgraphUrl: string, example: ChartExample, look: { theme?: Theme; size?: Size } = {}): string {
  const url = new URL(example.href, semgraphUrl);
  if (look.theme) {
    url.searchParams.set('theme', look.theme);
  }
  if (look.size) {
    url.searchParams.set('size', look.size);
  }
  return url.toString();
}

/** `compareWithLastYear` → `Compare with last year`. */
export function intentInWords(intent: string): string {
  const words = intent.replace(/([A-Z])/g, ' $1').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Every chart semgraph offers; for those outside the Data Team, the start page. */
export function ChartsPage({ api, semgraphUrl }: { api: Api; semgraphUrl: string }) {
  const catalog = useQuery({ queryKey: ['charts'], queryFn: api.charts, staleTime: 5 * 60_000 });
  if (catalog.isPending) {
    return <Loading rows={3} />;
  }
  if (catalog.isError) {
    return <Problem title="semgraph did not answer">{catalog.error.message}</Problem>;
  }
  return <ChartList catalog={catalog.data} semgraphUrl={semgraphUrl} />;
}

export function ChartList({ catalog, semgraphUrl }: { catalog: ChartCatalog; semgraphUrl: string }) {
  return (
    <Stack gap={40}>
      <Stack gap="xs" maw={720}>
        <Title order={1}>Charts</Title>
        <Text c="dimmed">
          Every chart semgraph draws, chosen by the question it answers rather than by its shape. Open one to see its examples, light and dark, in every size.
        </Text>
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {catalog.semgraphs.map((chart) => {
          const first = chart.examples[0];
          return (
            <Paper key={chart.id} component="a" href={hrefFor({ page: 'chart', id: chart.id })} withBorder radius="lg" p="md" style={{ textDecoration: 'none', color: 'inherit' }}>
              {first && (
                <Box bg="gray.0" mb="md" style={{ borderRadius: 'var(--mantine-radius-md)', overflow: 'hidden' }}>
                  <img src={exampleImage(semgraphUrl, first)} alt="" loading="lazy" style={{ display: 'block', width: '100%', height: 'auto' }} />
                </Box>
              )}
              <Text fw={600}>{chart.title}</Text>
              <Text size="sm" c="dimmed" mt={4}>
                {chart.answers}
              </Text>
              <Text size="xs" c="dimmed" mt="sm">
                {plural(chart.examples.length, 'example')}
              </Text>
            </Paper>
          );
        })}
      </SimpleGrid>
      {catalog.planned.length > 0 && (
        <Text size="sm" c="dimmed">
          Still to come: {catalog.planned.join(', ')}.
        </Text>
      )}
    </Stack>
  );
}

/** One chart: what it answers, when another fits better, and all its examples. */
export function ChartPage({ api, semgraphUrl, id }: { api: Api; semgraphUrl: string; id: string }) {
  const chart = useQuery({ queryKey: ['chart', id], queryFn: () => api.chart(id), staleTime: 5 * 60_000 });
  // The titles of the other charts, for "use … instead".
  const catalog = useQuery({ queryKey: ['charts'], queryFn: api.charts, staleTime: 5 * 60_000 });
  const titles = new Map(catalog.data?.semgraphs.map((other) => [other.id, other.title]) ?? []);
  return (
    <Stack gap="xl">
      <Anchor href={hrefFor({ page: 'charts' })} size="sm" c="dimmed">
        <Group gap={6}>
          <BackIcon size={16} />
          All charts
        </Group>
      </Anchor>
      {chart.isPending ? (
        <Loading rows={3} />
      ) : chart.isError ? (
        <Problem title="This chart could not be read">{chart.error.message}</Problem>
      ) : (
        <ChartView chart={chart.data} titles={titles} semgraphUrl={semgraphUrl} refusal={api.refusal} />
      )}
    </Stack>
  );
}

export interface ChartViewProps {
  chart: ChartDetail;
  /** The title of every chart, by ID. */
  titles: ReadonlyMap<string, string>;
  semgraphUrl: string;
  refusal: Api['refusal'];
}

export function ChartView({ chart, titles, semgraphUrl, refusal }: ChartViewProps) {
  // semgraph draws a chart in every size when its contract takes a size; the KPI tile has one.
  const sized = 'size' in (chart.schema.properties ?? {});
  const [theme, setTheme] = useState<Theme | 'own'>('own');
  const [size, setSize] = useState<Size | 'own'>('own');
  const look = { ...(theme === 'own' ? {} : { theme }), ...(size === 'own' || !sized ? {} : { size }) };

  return (
    <Stack gap="xl">
      <Stack gap="xs" maw={760}>
        <Title order={1}>{chart.title}</Title>
        <Text size="lg">{chart.answers}</Text>
        <Group gap="lg" mt="xs">
          {chart.links.learning && <ExternalLink href={chart.links.learning}>Reading card</ExternalLink>}
          {chart.links.figma && <ExternalLink href={chart.links.figma}>Figma</ExternalLink>}
          <ExternalLink href={new URL(`/semgraphs/${encodeURIComponent(chart.id)}`, semgraphUrl).toString()}>Contract (JSON)</ExternalLink>
          <Code>{chart.id}</Code>
        </Group>
      </Stack>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" maw={980}>
        {chart.exampleQuestions.length > 0 && (
          <Box>
            <Text fw={600} mb="xs">
              Answers questions such as
            </Text>
            <List size="sm" spacing={4}>
              {chart.exampleQuestions.map((question) => (
                <List.Item key={question}>{question}</List.Item>
              ))}
            </List>
          </Box>
        )}
        {chart.doNotUseWhen.length > 0 && (
          <Box>
            <Text fw={600} mb="xs">
              Better with another chart
            </Text>
            <List size="sm" spacing={4}>
              {chart.doNotUseWhen.map((rule) => (
                <List.Item key={rule.intent}>
                  {intentInWords(rule.intent)}: <Anchor href={hrefFor({ page: 'chart', id: rule.use })}>{titles.get(rule.use) ?? rule.use}</Anchor>
                </List.Item>
              ))}
            </List>
          </Box>
        )}
      </SimpleGrid>
      <Group justify="space-between" align="flex-end" gap="md">
        <Box>
          <Title order={2} size="h3">
            Examples
          </Title>
          <Text size="sm" c="dimmed">
            Click an example to open the chart itself, with hover and working links.
          </Text>
        </Box>
        <Group gap="sm">
          <SegmentedControl
            aria-label="Theme"
            value={theme}
            onChange={(value) => setTheme(value as Theme | 'own')}
            data={[{ value: 'own', label: 'Original' }, ...THEMES.map((value) => ({ value, label: value === 'light' ? 'Light' : 'Dark' }))]}
          />
          {sized && (
            <SegmentedControl
              aria-label="Size"
              value={size}
              onChange={(value) => setSize(value as Size | 'own')}
              data={[{ value: 'own', label: 'Original' }, ...SIZES.map((value) => ({ value, label: value === 'xl' ? 'XL' : value.charAt(0).toUpperCase() + value.slice(1) }))]}
            />
          )}
        </Group>
      </Group>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        {chart.examples.map((example) => {
          const src = exampleImage(semgraphUrl, example, look);
          // A new picture starts over: a refusal belongs to one picture.
          return <ExampleCard key={src} example={example} src={src} refusal={refusal} />;
        })}
      </SimpleGrid>
    </Stack>
  );
}

/** One example, as semgraph draws it; semgraph refuses some on purpose, and then says why. */
function ExampleCard({ example, src, refusal }: { example: ChartExample; src: string; refusal: Api['refusal'] }) {
  const [refused, setRefused] = useState(false);
  const reason = useQuery({ queryKey: ['refusal', src], queryFn: () => refusal(src.slice(new URL(src).origin.length)), enabled: refused, staleTime: Infinity });
  return (
    <Paper withBorder radius="lg" p="md">
      {refused ? (
        <Box bg="gray.0" p="lg" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
          <Text size="sm" fw={600}>
            semgraph refuses to draw this example
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            {reason.data ?? 'It would mislead the reader.'}
          </Text>
        </Box>
      ) : (
        <Anchor href={src} target="_blank" rel="noopener" display="block">
          <img src={src} alt={example.title} loading="lazy" onError={() => setRefused(true)} style={{ display: 'block', width: '100%', height: 'auto' }} />
        </Anchor>
      )}
      <Text size="sm" mt="sm">
        {example.title}
      </Text>
      <Code fz="xs">{example.name}</Code>
    </Paper>
  );
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <Anchor href={href} target="_blank" rel="noopener" size="sm">
      {children} ↗
    </Anchor>
  );
}
