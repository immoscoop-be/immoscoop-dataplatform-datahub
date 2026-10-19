import { COLLECTION_COLOURS, type CollectionColour, type CollectionVisibility } from '@datahub/contracts/collections';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  CheckIcon,
  ColorSwatch,
  DataList,
  EmptyState,
  Group,
  Input,
  Modal,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { type Api, type Collection, type CollectionFields, type Group as WorkspaceGroup, type LogEntry, ServiceError } from './api.js';
import { formatMoment } from './format.js';
import { BackIcon } from './icons.js';
import { Detail } from './Node.js';
import { hrefFor } from './route.js';
import { Loading, Problem } from './Search.js';

const COLOURS = Object.keys(COLLECTION_COLOURS) as CollectionColour[];
/** The light colours of the palette, on which a mark is drawn dark rather than white. */
const LIGHT = new Set<CollectionColour>(['sand', 'cyan']);

/** `rose` → `Rose`. */
export function colourName(colour: CollectionColour): string {
  return colour.charAt(0).toUpperCase() + colour.slice(1);
}

/** Who sees a Collection, in a sentence (FR-CO-17). */
export function audience(visibility: CollectionVisibility): string {
  return visibility === 'public' ? 'Everyone at Immoscoop sees it.' : 'Only its Owner Unit and the Data Team see it.';
}

function VisibilityBadge({ visibility }: { visibility: CollectionVisibility }) {
  return (
    <Badge variant="light" color={visibility === 'public' ? 'teal' : 'gray'} size="sm">
      {visibility === 'public' ? 'Public' : 'Private'}
    </Badge>
  );
}

/** The Collections the User sees, and the way to create one; for everyone outside the Data Team, the start page. */
export function CollectionsPage({ api }: { api: Api }) {
  const collections = useQuery({ queryKey: ['collections'], queryFn: api.collections });
  const [creating, setCreating] = useState(false);
  return (
    <Stack gap={40}>
      <Group justify="space-between" align="flex-end" gap="lg">
        <Stack gap="xs" maw={720}>
          <Title order={1}>Collections</Title>
          <Text c="dimmed">
            The functional domains of Immoscoop, each cared for by the group that owns it. A private Collection is seen by its Owner Unit and the Data Team, a public one by
            everyone.
          </Text>
        </Stack>
        <Button onClick={() => setCreating(true)}>New Collection</Button>
      </Group>
      {collections.isPending ? (
        <Loading rows={3} />
      ) : collections.isError ? (
        <Problem title="catalogue did not answer">{collections.error.message}</Problem>
      ) : (
        <CollectionList collections={collections.data} onCreate={() => setCreating(true)} />
      )}
      <CollectionForm api={api} opened={creating} onClose={() => setCreating(false)} />
    </Stack>
  );
}

export function CollectionList({ collections, onCreate }: { collections: Collection[]; onCreate?: () => void }) {
  if (collections.length === 0) {
    return (
      <EmptyState title="No Collections yet" description="Create the first one: a functional domain of Immoscoop, owned by one of your groups.">
        {onCreate && <Button onClick={onCreate}>New Collection</Button>}
      </EmptyState>
    );
  }
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
      {collections.map((collection) => (
        <Paper
          key={collection.id}
          component="a"
          href={hrefFor({ page: 'collection', id: collection.id })}
          withBorder
          radius="lg"
          p="lg"
          style={{ textDecoration: 'none', color: 'inherit', borderTop: `4px solid ${COLLECTION_COLOURS[collection.colour]}` }}
        >
          <Group justify="space-between" wrap="nowrap" gap="sm">
            <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
              {collection.name}
            </Text>
            <VisibilityBadge visibility={collection.visibility} />
          </Group>
          <Text size="sm" mt={6} lineClamp={2}>
            {collection.description}
          </Text>
          <Text size="xs" c="dimmed" mt="md">
            Owner Unit: {collection.ownerUnit.name}
          </Text>
        </Paper>
      ))}
    </SimpleGrid>
  );
}

/** One Collection: what it is, who owns it and who sees it, its Resources and its history. */
export function CollectionPage({ api, id }: { api: Api; id: string }) {
  const queryClient = useQueryClient();
  const collection = useQuery({ queryKey: ['collection', id], queryFn: () => api.collection(id) });
  const log = useQuery({ queryKey: ['collection-log', id], queryFn: () => api.collectionLog(id), enabled: collection.isSuccess });
  const [editing, setEditing] = useState(false);
  const [dissolving, setDissolving] = useState(false);
  const dissolve = useMutation({
    mutationFn: () => api.dissolveCollection(id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['collection', id] });
      await queryClient.invalidateQueries({ queryKey: ['collections'] });
      window.location.hash = hrefFor({ page: 'collections' });
    },
  });

  return (
    <Stack gap="xl" maw={980}>
      <Anchor href={hrefFor({ page: 'collections' })} size="sm" c="dimmed">
        <Group gap={6}>
          <BackIcon size={16} />
          All Collections
        </Group>
      </Anchor>
      {collection.isPending ? (
        <Loading rows={3} />
      ) : collection.isError ? (
        collection.error instanceof ServiceError && collection.error.status === 404 ? (
          <Problem title="No such Collection">It does not exist, it was dissolved, or it is private to its Owner Unit.</Problem>
        ) : (
          <Problem title="This Collection could not be read">{collection.error.message}</Problem>
        )
      ) : (
        <>
          <CollectionView collection={collection.data} log={log.data} onEdit={() => setEditing(true)} onDissolve={() => setDissolving(true)} />
          <CollectionForm api={api} opened={editing} onClose={() => setEditing(false)} collection={collection.data} />
          <Modal opened={dissolving} onClose={() => setDissolving(false)} title={`Dissolve ${collection.data.name}?`} centered>
            <Stack gap="lg">
              <Text size="sm">The Collection disappears for everyone, and its name is free again. Its history is kept.</Text>
              {dissolve.isError && <Problem title="Not dissolved">{dissolve.error.message}</Problem>}
              <Group justify="flex-end">
                <Button variant="default" onClick={() => setDissolving(false)}>
                  Keep it
                </Button>
                <Button color="red" loading={dissolve.isPending} onClick={() => dissolve.mutate()}>
                  Dissolve
                </Button>
              </Group>
            </Stack>
          </Modal>
        </>
      )}
    </Stack>
  );
}

export interface CollectionViewProps {
  collection: Collection;
  /** The history, once it is read. */
  log?: LogEntry[];
  onEdit?: () => void;
  onDissolve?: () => void;
}

export function CollectionView({ collection, log, onEdit, onDissolve }: CollectionViewProps) {
  return (
    <Stack gap="xl">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" gap="md">
          <Group gap="sm" wrap="nowrap">
            <ColorSwatch color={COLLECTION_COLOURS[collection.colour]} size={20} withShadow={false} aria-label={`Colour ${colourName(collection.colour)}`} />
            <Title order={1} style={{ overflowWrap: 'anywhere' }}>
              {collection.name}
            </Title>
          </Group>
          {collection.canManage && (
            <Group gap="sm">
              <Button variant="default" onClick={onEdit}>
                Edit
              </Button>
              <Button variant="subtle" color="red" onClick={onDissolve}>
                Dissolve
              </Button>
            </Group>
          )}
        </Group>
        <Text style={{ whiteSpace: 'pre-wrap' }}>{collection.description}</Text>
      </Stack>
      <DataList size="sm" orientation="horizontal" labelWidth={120}>
        <Detail
          label="Owner Unit"
          value={
            <>
              {collection.ownerUnit.name}
              {collection.ownerUnit.name !== collection.ownerUnit.email && (
                <Text span size="sm" c="dimmed">
                  {' '}
                  · {collection.ownerUnit.email}
                </Text>
              )}
            </>
          }
        />
        <Detail
          label="Visibility"
          value={
            <Group gap="xs">
              <VisibilityBadge visibility={collection.visibility} />
              <Text span size="sm" c="dimmed">
                {audience(collection.visibility)}
              </Text>
            </Group>
          }
        />
        <Detail label="Created" value={formatMoment(collection.createdAt)} />
      </DataList>
      <Stack gap="sm">
        <Title order={2} size="h4">
          Resources
        </Title>
        <EmptyState
          title="No Resources yet"
          description="The Data Team adds Resources from the Stacks. Once the Owner Unit publishes one, everyone who sees this Collection sees it too."
        />
      </Stack>
      <Stack gap="sm">
        <Title order={2} size="h4">
          History
        </Title>
        {log === undefined ? (
          <Loading rows={2} />
        ) : (
          <Stack gap={0}>
            {log.map((entry, index) => (
              <Group key={index} justify="space-between" py="xs" gap="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                <Text size="sm">{entry.text}</Text>
                <Text size="xs" c="dimmed">
                  {formatMoment(entry.at)}
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </Stack>
  );
}

/** The choice of colour: the palette as swatches, one of which is chosen (FR-CO-04). */
export function ColourPicker({ value, onChange }: { value?: CollectionColour; onChange: (colour: CollectionColour) => void }) {
  return (
    <Input.Wrapper label="Colour" description="To recognise the Collection by; it may recur." withAsterisk>
      <Group gap="xs" mt={6} role="radiogroup" aria-label="Colour">
        {COLOURS.map((colour) => (
          <ColorSwatch
            key={colour}
            component="button"
            type="button"
            role="radio"
            aria-checked={value === colour}
            aria-label={colourName(colour)}
            title={colourName(colour)}
            color={COLLECTION_COLOURS[colour]}
            size={30}
            withShadow={false}
            onClick={() => onChange(colour)}
            style={{ cursor: 'pointer', color: LIGHT.has(colour) ? 'var(--mantine-color-black)' : 'white', border: 0 }}
          >
            {value === colour && <CheckIcon size={12} />}
          </ColorSwatch>
        ))}
      </Group>
    </Input.Wrapper>
  );
}

type Draft = Omit<CollectionFields, 'colour' | 'ownerUnit'> & { colour?: CollectionColour; ownerUnit: string | null };

function draftOf(collection?: Collection): Draft {
  return collection
    ? { name: collection.name, description: collection.description, colour: collection.colour, ownerUnit: collection.ownerUnit.id, visibility: collection.visibility }
    : { name: '', description: '', ownerUnit: null, visibility: 'private' };
}

/** The Owner Units on offer: the groups of the User, and the current one, which a Data Admin may not be in. */
export function ownerUnitOptions(groups: WorkspaceGroup[], current?: WorkspaceGroup) {
  const all = current && !groups.some((group) => group.id === current.id) ? [current, ...groups] : groups;
  return all.map((group) => ({ value: group.id, label: group.name, email: group.email }));
}

/** Creates a Collection, or changes one when it is given (FR-CO-12, FR-CO-13, FR-CO-15, FR-CO-16). */
export function CollectionForm({ api, opened, onClose, collection }: { api: Api; opened: boolean; onClose: () => void; collection?: Collection }) {
  const queryClient = useQueryClient();
  const groups = useQuery({ queryKey: ['groups'], queryFn: api.groups, enabled: opened, staleTime: 60_000 });
  const [draft, setDraft] = useState<Draft>(() => draftOf(collection));

  const save = useMutation({
    mutationFn: (fields: CollectionFields) => (collection ? api.changeCollection(collection.id, fields) : api.createCollection(fields)),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['collection', saved.id], saved);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['collections'] }), queryClient.invalidateQueries({ queryKey: ['collection-log', saved.id] })]);
      onClose();
      if (!collection) {
        window.location.hash = hrefFor({ page: 'collection', id: saved.id });
      }
    },
  });
  // Every opening starts from the Collection as it is, without the outcome of an earlier save.
  const { reset } = save;
  useEffect(() => {
    if (opened) {
      setDraft(draftOf(collection));
      reset();
    }
  }, [opened, collection, reset]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const ready = draft.name.trim() !== '' && draft.description.trim() !== '' && draft.colour !== undefined && draft.ownerUnit !== null;
  const options = ownerUnitOptions(groups.data ?? [], collection?.ownerUnit);
  const emails = new Map(options.map((option) => [option.value, option.email]));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (ready && draft.colour && draft.ownerUnit) {
      save.mutate({ ...draft, colour: draft.colour, ownerUnit: draft.ownerUnit });
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={collection ? `Edit ${collection.name}` : 'New Collection'} size="lg" centered>
      <form onSubmit={submit}>
        <Stack gap="lg">
          <TextInput label="Name" withAsterisk maxLength={80} value={draft.name} onChange={(event) => set('name', event.currentTarget.value)} data-autofocus />
          <Textarea
            label="Description"
            description="Which functional domain of Immoscoop the Collection covers."
            withAsterisk
            autosize
            minRows={2}
            maxLength={500}
            value={draft.description}
            onChange={(event) => set('description', event.currentTarget.value)}
          />
          <ColourPicker value={draft.colour} onChange={(colour) => set('colour', colour)} />
          <Select
            label="Owner Unit"
            description="One of your Google groups. Its members own the Collection and manage it."
            withAsterisk
            searchable
            nothingFoundMessage="None of your groups is called that."
            placeholder={groups.isPending ? 'Reading your groups…' : 'Choose a group'}
            disabled={groups.isPending}
            data={options}
            value={draft.ownerUnit}
            onChange={(value) => set('ownerUnit', value)}
            renderOption={({ option }) => (
              <Stack gap={0}>
                <Text size="sm">{option.label}</Text>
                <Text size="xs" c="dimmed">
                  {emails.get(option.value)}
                </Text>
              </Stack>
            )}
            error={groups.isError ? `Your groups could not be read: ${groups.error.message}` : undefined}
          />
          <Input.Wrapper label="Visibility" description={audience(draft.visibility)}>
            <Box mt={6}>
              <SegmentedControl
                value={draft.visibility}
                onChange={(value) => set('visibility', value as CollectionVisibility)}
                data={[
                  { value: 'private', label: 'Private' },
                  { value: 'public', label: 'Public' },
                ]}
              />
            </Box>
          </Input.Wrapper>
          {save.isError && (
            <Alert color="magenta" variant="light" title={collection ? 'Not saved' : 'Not created'}>
              {save.error.message}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready} loading={save.isPending}>
              {collection ? 'Save' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
