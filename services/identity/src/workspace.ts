const DIRECTORY_USERS = 'https://admin.googleapis.com/admin/directory/v1/users/';
const TRANSITIVE_GROUPS = 'https://cloudidentity.googleapis.com/v1/groups/-/memberships:searchTransitiveGroups';
const METADATA_TOKEN = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

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

/** An access token for Google's APIs, as the service account of identity. */
export type AccessTokenSource = (scopes: string[]) => Promise<string>;

/**
 * Asks Workspace as the service account of identity, which has the Groups Reader and Data Hub
 * user reader admin roles (OP-UM-03, TR-PF-26).
 */
export function createWorkspace(token: AccessTokenSource = metadataAccessToken(), request: typeof fetch = fetch): Workspace {
  async function get(url: URL | string, scope: string): Promise<Response> {
    return request(url, { headers: { authorization: `Bearer ${await token([scope])}` } });
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
        throw await failure('Workspace did not say whether the account is active', response);
      }
      const user = (await response.json()) as { suspended?: boolean; archived?: boolean };
      return !user.suspended && !user.archived;
    },

    async groups(email) {
      const groups: WorkspaceGroup[] = [];
      let pageToken: string | undefined;
      do {
        const url = new URL(TRANSITIVE_GROUPS);
        url.searchParams.set('query', `member_key_id == '${email.replaceAll("'", '')}' && 'cloud_identity_googlegroup' in labels`);
        if (pageToken) {
          url.searchParams.set('pageToken', pageToken);
        }
        const response = await get(url, 'https://www.googleapis.com/auth/cloud-identity.groups.readonly');
        if (!response.ok) {
          throw await failure('Workspace did not return the groups', response);
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
    },
  };
}

/** An error with Google's own reason in it, such as an API that is not enabled; for the log. */
async function failure(what: string, response: Response): Promise<Error> {
  let reason = '';
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    reason = body.error?.message ?? '';
  } catch {
    // No JSON: the status says enough.
  }
  return new Error(`${what}: ${response.status}${reason ? ` ${reason}` : ''}`);
}

/**
 * Access tokens from the metadata server of Cloud Run, for the service account the service runs
 * as, kept until shortly before they expire.
 */
export function metadataAccessToken(request: typeof fetch = fetch, now: () => number = Date.now): AccessTokenSource {
  const cache = new Map<string, { token: string; expiresAt: number }>();
  return async (scopes) => {
    const key = scopes.join(',');
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now()) {
      return cached.token;
    }
    const response = await request(`${METADATA_TOKEN}?scopes=${encodeURIComponent(key)}`, {
      headers: { 'metadata-flavor': 'Google' },
    });
    if (!response.ok) {
      throw new Error(`The metadata server gave no access token: ${response.status}`);
    }
    const { access_token: token, expires_in: expiresIn } = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    cache.set(key, { token, expiresAt: now() + (expiresIn - 60) * 1000 });
    return token;
  };
}
