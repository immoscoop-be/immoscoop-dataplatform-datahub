import type { WorkspaceGroup } from './workspace.js';

/**
 * Which groups count, and what they mean (Naming Convention, FR-UM-05): only Google groups of the
 * own domain whose address starts with `datahub-`. `datahub-owner-<name>@` is an Owner Unit;
 * any other `datahub-<role>@` is a Role Group, which gives its members the role `<role>`.
 */
export function applyNamingConvention(groups: WorkspaceGroup[], domain: string): { groups: string[]; roles: string[] } {
  const suffix = `@${domain}`.toLowerCase();
  const matching = groups.filter((group) => {
    const email = group.email.toLowerCase();
    return email.startsWith('datahub-') && email.endsWith(suffix);
  });
  const roles = matching
    .map((group) => group.email.toLowerCase().slice('datahub-'.length, -suffix.length))
    .filter((name) => name.length > 0 && !name.startsWith('owner-'));

  return {
    groups: [...new Set(matching.map((group) => group.id))].sort(),
    roles: [...new Set(roles)].sort(),
  };
}
