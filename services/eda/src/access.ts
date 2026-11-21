import { can, NO_PERMISSIONS, type Permissions } from '@datahub/contracts';
import type { Who } from '@datahub/contracts/eda';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** The Permissions of the User from their Access Token (TR-PL-06); without one, none. */
export const permissionsOf = (request: FastifyRequest): Permissions => request.user?.permissions ?? NO_PERMISSIONS;

/** Whether the User may explore Resources (`eda.use`, TR-ED-06, DEC-ED-25). */
export const explores = (request: FastifyRequest): boolean => can(permissionsOf(request), 'eda.use');

/** A refusal for want of `eda.use`: 403 with the key the User needs (TR-ED-06, TR-PL-06). */
export const forbidden = (reply: FastifyReply, message: string): FastifyReply => reply.code(403).send({ error: 'forbidden', message, permission: 'eda.use' });

/** The User, by the fixed Google ID and their name now. */
export const whoOf = (request: FastifyRequest): Who => ({ id: request.user?.sub ?? '', name: request.user?.name || request.user?.email || '' });
