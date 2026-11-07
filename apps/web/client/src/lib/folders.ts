import { t } from '@datahub/ui/foundations/texts.svelte.js';
import type { Collection, CollectionItem, Folder, MovableKind } from './catalogue.js';
import type { LensItem } from './query.js';

/** What a folder of a Collection holds, or its top: its folders, then its Resources and Lenses, each A to Z (FR-CO-38). */
export interface Contents {
  folders: Folder[];
  resources: CollectionItem[];
  lenses: LensItem[];
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** The folder a Lens of the Collection sits in, or null at its top. */
export const lensFolder = (collection: Collection, lensId: string): string | null => {
  const folderId = collection.lensFolders[lensId];
  return folderId !== undefined && collection.folders.some((folder) => folder.id === folderId) ? folderId : null;
};

/**
 * What sits in a folder of a Collection, or at its top with null: only the Resources and Lenses the User sees,
 * which the Collection and the Lenses given already hold to.
 */
export function contents(collection: Collection, lenses: readonly LensItem[], folderId: string | null): Contents {
  return {
    folders: collection.folders.filter((folder) => folder.parentId === folderId).toSorted((a, b) => byName(a.name, b.name)),
    resources: collection.resources.filter((item) => (item.folderId ?? null) === folderId).toSorted((a, b) => byName(a.displayName, b.displayName)),
    lenses: lenses
      .filter((lens) => lens.collectionId === collection.id && lensFolder(collection, lens.id) === folderId)
      .toSorted((a, b) => byName(a.name, b.name)),
  };
}

/** How many it holds: its folders, Resources and Lenses, not what is in its folders. */
export const counted = (inside: Contents): number => inside.folders.length + inside.resources.length + inside.lenses.length;

/** The folders from the top of the Collection down to this one, itself last; empty when it is not in it. */
export function pathTo(collection: Collection, folderId: string): Folder[] {
  const path: Folder[] = [];
  for (let at: string | null = folderId; at !== null; ) {
    const folder = collection.folders.find((candidate) => candidate.id === at);
    // A folder that is not there, or a loop, which catalogue never makes: no path.
    if (!folder || path.includes(folder)) return [];
    path.unshift(folder);
    at = folder.parentId;
  }
  return path;
}

/** Whether `folderId` is the folder `outer` or inside it: a folder does not go there (FR-CO-40). */
export function within(collection: Collection, folderId: string | null, outer: string): boolean {
  return folderId !== null && pathTo(collection, folderId).some((folder) => folder.id === outer);
}

/** Something of a Collection that moves between its folders, with where it sits now. */
export interface Movable {
  kind: MovableKind;
  id: string;
  name: string;
  collectionId: string;
  /** The folder it sits in, or null at the top. */
  from: string | null;
}

/** What it holds in words, such as "1 folder · 3 Resources · 2 Lenses", or "Empty". */
export function holdsText(inside: Contents): string {
  const parts = [
    inside.folders.length > 0 ? t('folder.folders', { count: inside.folders.length }) : '',
    inside.resources.length > 0 ? t('folder.resources', { count: inside.resources.length }) : '',
    inside.lenses.length > 0 ? t('folder.lenses', { count: inside.lenses.length }) : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : t('folder.empty');
}
