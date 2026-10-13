import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../common/logger.js';
import { emailQueue } from '../../queues/index.js';
import { templates } from './templates.js';

// Without SMTP configured, the "jsonTransport" renders the message and we just log it.
const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

/** Called by the worker. Renders the template and sends it. */
export async function sendTemplatedEmail({ template, to, data, attachments }) {
  const build = templates[template];
  if (!build) throw new Error(`Unknown email template: ${template}`);
  const { subject, html } = build(data);
  const info = await transporter.sendMail({ from: env.MAIL_FROM, to, subject, html, attachments });
  if (!env.SMTP_HOST) logger.info({ to, subject, attachments: attachments?.map((a) => a.filename) }, 'email rendered (no SMTP configured, not delivered)');
  return info.messageId;
}

/**
 * Queues an email. Callers never wait on SMTP, and a mail outage never fails a request.
 * `attachments` use file paths so the job payload stays small.
 */
export async function enqueueEmail(template, to, data, attachments) {
  try {
    await emailQueue.add(template, { template, to, data, attachments });
  } catch (err) {
    logger.error({ err: err.message, template, to }, 'could not enqueue email');
  }
}
