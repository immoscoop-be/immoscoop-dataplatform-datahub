import { type AccessTokenSource, googleApiError, metadataAccessToken } from '@datahub/google';

const DIRECTORY_USERS = 'https://admin.googleapis.com/admin/directory/v1/users/';
const USERS_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly';

/**
 * What identity asks Google Workspace about a User: only whether their account is still active (DEC-UM-12).
 * Groups are kept in Data Hub since DEC-UM-10; Workspace is no longer asked for them.
 */
export interface Workspace {
  /** Whether the account still exists and is not suspended (FR-UM-10, TR-PF-26). */
  isActive(googleId: string): Promise<boolean>;
}

/** Asks Workspace as the service account of identity, which has the Data Hub user reader admin role (TR-PF-26). */
export function createWorkspace(token: AccessTokenSource = metadataAccessToken(), request: typeof fetch = fetch): Workspace {
  return {
    async isActive(googleId) {
      const url = new URL(encodeURIComponent(googleId), DIRECTORY_USERS);
      url.search = 'projection=basic&viewType=admin_view';
      const response = await request(url, { headers: { authorization: `Bearer ${await token([USERS_SCOPE])}` } });
      if (response.status === 404) {
        return false;
      }
      if (!response.ok) {
        throw await googleApiError('Workspace did not say whether the account is active', response);
      }
      const user = (await response.json()) as { suspended?: boolean; archived?: boolean };
      return !user.suspended && !user.archived;
    },
  };
}
