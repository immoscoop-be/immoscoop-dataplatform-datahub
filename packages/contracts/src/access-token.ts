import { z } from 'zod';

/**
 * The claims of a Data Hub access token, issued by identity (TR-PF-02) and
 * validated by every service (TR-PF-03).
 */
export const accessTokenClaims = z.object({
  /** The fixed Google ID of the user (FR-UM-03). */
  sub: z.string().min(1),
  email: z.email(),
  name: z.string(),
  /** The convention groups of the user, by their fixed Google ID (FR-UM-05, FR-UM-08). */
  groups: z.array(z.string()),
  /** Roles derived from the role groups, such as the data team. */
  roles: z.array(z.string()),
  iss: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
  iat: z.number().int(),
  exp: z.number().int(),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaims>;
