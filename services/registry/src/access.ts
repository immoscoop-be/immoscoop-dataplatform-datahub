import { canWith, NO_PERMISSIONS, type PermissionKey, type Permissions } from '@datahub/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** The Permissions of the User from their Access Token (TR-PL-06); without one, none. */
export const permissionsOf = (request: FastifyRequest): Permissions => request.user?.permissions ?? NO_PERMISSIONS;

/** Whether the User opens the Webhooks of Admin: the Source Jobs, the deliveries and processing a run again (`admin.open`). */
export const opensWebhooks = (request: FastifyRequest): boolean => canWith(permissionsOf(request), 'admin.open', 'tools', 'webhooks');

/** A refusal for want of a Permission: 403 with the key the User needs (TR-PL-06, EC-PL-01). */
export const forbidden = (reply: FastifyReply, permission: PermissionKey, message: string): FastifyReply =>
  reply.code(403).send({ error: 'forbidden', message, permission });
