import { type AccessTokenSource, googleApiError, metadataAccessToken } from '@datahub/google';

const DIRECTORY_USERS = 'https://admin.googleapis.com/admin/directory/v1/users/';
const DIRECT_GROUPS = 'https://cloudidentity.googleapis.com/v1/groups/-/memberships:searchDirectGroups';

/** A Group of a User, as Workspace knows it. */
export interface WorkspaceGroup {
  /** The fixed Google ID of the Group (FR-UM-08). */
  id: string;
  email: string;
}

/** What identity asks Google Workspace about a User. */
export interface Workspace {
  /** Whether the account still exists and is not suspended (FR-UM-10, TR-PF-26). */
  isActive(googleId: string): Promise<boolean>;
  /** Every group the User is in, nested groups included (FR-UM-04). */
  groups(email: string): Promise<WorkspaceGroup[]>;
}

/**
 * Asks Workspace as the service account of identity, which has the Groups Reader and Data Hub
 * user reader admin roles (OP-UM-03, TR-PF-26).
 */
export function createWorkspace(token: AccessTokenSource = metadataAccessToken(), request: typeof fetch = fetch): Workspace {
  async function get(url: URL | string, scope: string): Promise<Response> {
    return request(url, { headers: { authorization: `Bearer ${await token([scope])}` } });
  }

  /**
   * The groups a User or group is a direct member of, over every page. The query names the member
   * only, as in Google's own sample: this method refuses the label filter its reference asks for
   * (400), unlike searchTransitiveGroups.
   */
  async function directGroups(member: string): Promise<WorkspaceGroup[]> {
    const groups: WorkspaceGroup[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(DIRECT_GROUPS);
      url.searchParams.set('query', `member_key_id == '${member.replaceAll("'", '')}'`);
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }
      const response = await get(url, 'https://www.googleapis.com/auth/cloud-identity.groups.readonly');
      if (!response.ok) {
        throw await googleApiError('Workspace did not return the groups', response);
      }
      const page = (await response.json()) as {
        memberships?: { group?: string; groupKey?: { id?: string } }[];
        nextPageToken?: string;
      };
      for (const membership of page.memberships ?? []) {
        if (membership.group && membership.groupKey?.id) {
          groups.push({ id: membership.group.replace(/^groups\//, ''), email: membership.groupKey.id });
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
    return groups;
  }

  return {
    async isActive(googleId) {
      const url = new URL(encodeURIComponent(googleId), DIRECTORY_USERS);
      url.search = 'projection=basic&viewType=admin_view';
      const response = await get(url, 'https://www.googleapis.com/auth/admin.directory.user.readonly');
      if (response.status === 404) {
        return false;
      }
      if (!response.ok) {
        throw await googleApiError('Workspace did not say whether the account is active', response);
      }
      const user = (await response.json()) as { suspended?: boolean; archived?: boolean };
      return !user.suspended && !user.archived;
    },

    /**
     * Walks up from the User, one level of nesting at a time: the direct groups of the User, then
     * the groups those groups are in, and so on. Google's search for all groups at once
     * (searchTransitiveGroups) only works on Workspace Enterprise and Cloud Identity Premium.
     */
    async groups(email) {
      const found = new Map<string, WorkspaceGroup>();
      let members = [email];
      while (members.length > 0) {
        const level = (await Promise.all(members.map(directGroups))).flat();
        members = [];
        for (const group of level) {
          if (!found.has(group.id)) {
            found.set(group.id, group);
            members.push(group.email);
          }
        }
      }
      return [...found.values()];
    },
  };
}
