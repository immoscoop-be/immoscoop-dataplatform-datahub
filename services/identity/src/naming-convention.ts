import type { WorkspaceGroup } from './workspace.js';

/**
 * The groups of a User that Data Hub knows (FR-UM-11, DEC-UM-07): every group of the own domain,
 * any of which can be an Owner Unit (DEC-CO-09), sorted by name.
 */
export function ownDomainGroups(groups: WorkspaceGroup[], domain: string): WorkspaceGroup[] {
  const suffix = `@${domain}`.toLowerCase();
  const own = new Map(groups.filter((group) => group.email.toLowerCase().endsWith(suffix)).map((group) => [group.id, group]));
  return [...own.values()].sort((a, b) => a.name.localeCompare(b.name, 'en') || a.email.localeCompare(b.email, 'en'));
}

/**
 * What goes into the Access Token: the fixed IDs of every group of the own domain, and the roles of
 * the Naming Convention. Only a Role Group, `datahub-<role>@`, gives the role `<role>`; the old form
 * `datahub-owner-<name>@` of an Owner Unit gives none.
 */
export function applyNamingConvention(groups: WorkspaceGroup[], domain: string): { groups: string[]; roles: string[] } {
  const suffix = `@${domain}`.toLowerCase();
  const own = ownDomainGroups(groups, domain);
  const roles = own
    .map((group) => group.email.toLowerCase())
    .filter((email) => email.startsWith('datahub-'))
    .map((email) => email.slice('datahub-'.length, -suffix.length))
    .filter((name) => name.length > 0 && !name.startsWith('owner-'));

  return {
    groups: own.map((group) => group.id).sort(),
    roles: [...new Set(roles)].sort(),
  };
}
