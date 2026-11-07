import type { WorkspaceGroup } from './workspace.js';

/** The domain of an address, in lower case. */
const domainOf = (email: string): string => email.slice(email.lastIndexOf('@') + 1).toLowerCase();

/**
 * The groups of a User that Data Hub knows (FR-UM-11, DEC-UM-07): every group of the own domains
 * (DEC-UM-09), any of which can be an Owner Unit (DEC-CO-09), sorted by name.
 */
export function ownDomainGroups(groups: WorkspaceGroup[], domains: string[]): WorkspaceGroup[] {
  const own = new Map(groups.filter((group) => domains.includes(domainOf(group.email))).map((group) => [group.id, group]));
  return [...own.values()].sort((a, b) => a.name.localeCompare(b.name, 'en') || a.email.localeCompare(b.email, 'en'));
}

/**
 * What goes into the Access Token: the fixed IDs of every group of the own domains, and the roles of
 * the Naming Convention. Only a Role Group, `datahub-<role>@`, gives the role `<role>`, in either
 * domain; the old form `datahub-owner-<name>@` of an Owner Unit gives none.
 */
export function applyNamingConvention(groups: WorkspaceGroup[], domains: string[]): { groups: string[]; roles: string[] } {
  const own = ownDomainGroups(groups, domains);
  const roles = own
    .map((group) => group.email.toLowerCase())
    .filter((email) => email.startsWith('datahub-'))
    .map((email) => email.slice('datahub-'.length, email.lastIndexOf('@')))
    .filter((name) => name.length > 0 && !name.startsWith('owner-'));

  return {
    groups: own.map((group) => group.id).sort(),
    roles: [...new Set(roles)].sort(),
  };
}
