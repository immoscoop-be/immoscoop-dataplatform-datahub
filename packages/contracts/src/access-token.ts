import { z } from 'zod';
import { completePermissions } from './permissions.js';

/**
 * The claims of a Data Hub access token, issued by identity (TR-PF-02) and
 * validated by every service (TR-PF-03).
 */
export const accessTokenClaims = z.object({
  /** The fixed Google ID of the user (FR-UM-03). */
  sub: z.string().min(1),
  email: z.email(),
  name: z.string(),
  /** Every group of the own domain the user is in, by its fixed Google ID (FR-UM-08, FR-UM-11). */
  groups: z.array(z.string()),
  /** The Permission group of the User, by its id and name (FR-PL-04). */
  permissionGroup: z.object({ id: z.string().min(1), name: z.string() }),
  /** The Permissions of their Permission group, completed so that a key it lacks is no (TR-PL-05). */
  permissions: z.unknown().transform((value) => completePermissions(value)),
  /** The channel the User came through when it is not the web app: Claude, through the MCP (DEC-CL-11, OP-CL-10). */
  client: z.literal('claude').optional(),
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaims>;
