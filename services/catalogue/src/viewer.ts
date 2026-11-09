import { can, canWith, NO_PERMISSIONS, type PermissionKey, PERMISSIONS, type Permissions, reach, sees } from '@datahub/contracts';

/** Who asks, as their Access Token says (TR-PL-05). */
export interface Viewer {
  /** The fixed Google ID of the User. */
  id: string;
  name: string;
  /** The fixed IDs of every group the User is in (TR-PF-02): their Owner Units are among them. */
  groups: readonly string[];
  /** The Permissions of their Permission group, complete: what they may do is decided by these, never by a role (TR-PL-06). */
  permissions: Permissions;
}

/** A Viewer that may do nothing but see what is theirs: what a request without a User gets. */
export const NOBODY: Viewer = { id: '', name: '', groups: [], permissions: NO_PERMISSIONS };

/** The attributes of a Resource that are described one by one (DEC-PL-03). */
export const ATTRIBUTES = PERMISSIONS['resources.describe'].values.attributes.options;
export type Attribute = (typeof ATTRIBUTES)[number];

/** Whether an asset of this Owner Unit is theirs: the Owner Unit is one of their groups (DEC-PL-01). */
export function theirs(viewer: Viewer, ownerUnitId: string | null | undefined): boolean {
  return ownerUnitId !== null && ownerUnitId !== undefined && viewer.groups.includes(ownerUnitId);
}

/** Whether they see all of the catalogue: the private Collections of others, Resources without a Collection, withdrawn ones (DEC-PL-02). */
export function seesAll(viewer: Viewer): boolean {
  return sees(viewer.permissions) === 'all';
}

/** Whether they see every public Collection, besides those of their Owner Units (DEC-PL-02). */
export function seesPublic(viewer: Viewer): boolean {
  return sees(viewer.permissions) !== 'theirs';
}

/**
 * Whether they see everything in a Collection they see, also what is not published or withdrawn: its Owner Unit, and
 * whoever sees all (FR-SR-31, DEC-PL-02). Others see what is published in it.
 */
export function seesInside(viewer: Viewer, ownerUnitId: string): boolean {
  return theirs(viewer, ownerUnitId) || seesAll(viewer);
}

/** Whether a Permission with a reach reaches an asset of this Owner Unit: every asset, or only theirs. */
export function reaches(viewer: Viewer, key: PermissionKey, ownerUnitId: string | null | undefined): boolean {
  const how = reach(viewer.permissions, key);
  return how === 'every' || (how === 'theirs' && theirs(viewer, ownerUnitId));
}

/** Whether they may describe this attribute of a Resource of this Owner Unit (DEC-PL-03). */
export function describes(viewer: Viewer, ownerUnitId: string | null | undefined, attribute: Attribute): boolean {
  return reaches(viewer, 'resources.describe', ownerUnitId) && canWith(viewer.permissions, 'resources.describe', 'attributes', attribute);
}

/** Every attribute, with whether they may describe it on a Resource of this Owner Unit: the flags the web app reads (TR-PL-06). */
export function describable(viewer: Viewer, ownerUnitId: string | null | undefined): Record<Attribute, boolean> {
  return Object.fromEntries(ATTRIBUTES.map((attribute) => [attribute, describes(viewer, ownerUnitId, attribute)])) as Record<Attribute, boolean>;
}

/** Whether a Permission is yes for them, or always on. */
export function may(viewer: Viewer, key: PermissionKey): boolean {
  return can(viewer.permissions, key);
}

/** What a route answers when the User lacks a Permission: 403, with the key of the Permission it needs (TR-PL-06, EC-PL-01). */
export function forbidden(permission: PermissionKey, message: string): { error: 'forbidden'; message: string; permission: PermissionKey } {
  return { error: 'forbidden', message, permission };
}
