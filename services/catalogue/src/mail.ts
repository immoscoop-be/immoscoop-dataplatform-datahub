import { createTransport } from 'nodemailer';
import type { Email, Mail } from './notifications.js';

export interface MailOptions {
  /** The SMTP relay of Workspace, such as `smtp-relay.gmail.com`, which admits Data Hub by its fixed address (DEC-PF-31). */
  host: string;
  port: number;
  /** Who it comes from, such as `Data Hub <datahub@immoscoop.be>`: an address of a Workspace domain, whose replies are not read. */
  from: string;
}

/**
 * E-mail through the SMTP relay of Workspace (DEC-PF-31): no password, as the relay knows Data Hub by the
 * fixed address its traffic leaves from; TLS always. It says it was sent by a machine, so that nobody's
 * out-of-office answers it (RFC 3834).
 */
export function createMail(options: MailOptions): Mail {
  const domain = /@([^>\s]+)>?\s*$/.exec(options.from)?.[1] ?? 'localhost';
  const transport = createTransport({
    host: options.host,
    port: options.port,
    secure: options.port === 465,
    requireTLS: true,
    // The relay asks who greets it: the domain Data Hub sends for.
    name: domain,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return {
    async send(email: Email) {
      await transport.sendMail({
        from: options.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' },
      });
    },
  };
}
