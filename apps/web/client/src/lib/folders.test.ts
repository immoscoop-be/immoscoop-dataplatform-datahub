import { describe, expect, it } from 'vitest';
import type { Collection } from './catalogue.js';
import { contents, counted, lensFolder, pathTo, within } from './folders.js';
import type { LensItem } from './query.js';

const folder = (id: string, name: string, parentId: string | null) => ({ id, name, parentId, createdBy: 'An', createdAt: '2026-10-31T08:00:00Z' });
const item = (id: string, displayName: string, folderId: string | null) => ({ id, key: id, displayName, level: 2, published: true, deprecated: false, withdrawn: false, folderId });

const COLLECTION = {
  id: 'c1',
  folders: [folder('f2', 'by source', 'f1'), folder('f1', 'Leads in', null), folder('f3', 'Archive', null)],
  resources: [item('r1', 'Weekly', 'f1'), item('r2', 'credit simulations', null), item('r3', 'Agents', null)],
  lensFolders: { l1: 'f2', l2: 'gone' },
} as unknown as Collection;
const LENSES = [
  { id: 'l1', name: 'Per source', collectionId: 'c1' },
  { id: 'l2', name: 'Orphan', collectionId: 'c1' },
  { id: 'l3', name: 'Elsewhere', collectionId: 'c2' },
] as LensItem[];

describe('the folders of a Collection (FR-CO-38, FR-CO-40)', () => {
  it('lists what sits in a folder or at the top: folders, then Resources and Lenses, each A to Z', () => {
    const top = contents(COLLECTION, LENSES, null);
    expect(top.folders.map((one) => one.name)).toEqual(['Archive', 'Leads in']);
    expect(top.resources.map((one) => one.displayName)).toEqual(['Agents', 'credit simulations']);
    // A Lens in a folder that is not there sits at the top; a Lens of another Collection is not here.
    expect(top.lenses.map((one) => one.name)).toEqual(['Orphan']);
    expect(counted(contents(COLLECTION, LENSES, 'f1'))).toBe(2);
    expect(lensFolder(COLLECTION, 'l1')).toBe('f2');
  });

  it('knows the path to a folder, and never lets a folder go into itself', () => {
    expect(pathTo(COLLECTION, 'f2').map((one) => one.id)).toEqual(['f1', 'f2']);
    expect(pathTo(COLLECTION, 'nope')).toEqual([]);
    expect(within(COLLECTION, 'f2', 'f1')).toBe(true);
    expect(within(COLLECTION, 'f1', 'f1')).toBe(true);
    expect(within(COLLECTION, 'f3', 'f1')).toBe(false);
    expect(within(COLLECTION, null, 'f1')).toBe(false);
  });
});
