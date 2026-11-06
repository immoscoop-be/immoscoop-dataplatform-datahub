import { NO_PERMISSIONS, type PermissionKey, type Permissions } from '@datahub/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** The Permissions of the User from their Access Token (TR-PL-06); without one, none. */
export const permissionsOf = (request: FastifyRequest): Permissions => request.user?.permissions ?? NO_PERMISSIONS;

/**
 * The groups of the User, their Owner Units among them: where a Permission reaches "their Owner Units", the
 * Collections whose Owner Unit is one of these are theirs (DEC-PL-01, FR-PL-05).
 */
export const ownerUnitsOf = (request: FastifyRequest): readonly string[] => request.user?.groups ?? [];

/** A refusal for want of a Permission: 403 with the key the User needs (TR-PL-06, EC-PL-01). */
export const forbidden = (reply: FastifyReply, permission: PermissionKey, message: string): FastifyReply =>
  reply.code(403).send({ error: 'forbidden', message, permission });
