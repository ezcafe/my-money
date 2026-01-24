/**
 * Email Service
 * Handles sending emails (currently placeholder implementation with logging)
 * TODO: Integrate with SendGrid/AWS SES/Nodemailer in production
 */

import { logInfo } from '../utils/logger';

/**
 * Send invitation email
 * Currently logs the email content for development
 * @param email - Recipient email address
 * @param invitationToken - Invitation token
 * @param workspaceName - Workspace name
 * @param inviterEmail - Inviter's email address
 */
export function sendInvitationEmail(
  email: string,
  invitationToken: string,
  workspaceName: string,
  inviterEmail: string
): void {
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const invitationUrl = `${frontendUrl}/invite/accept?token=${invitationToken}`;

  // TODO: Integrate with email service (SendGrid/AWS SES/Nodemailer)
  // For now, log the email content
  logInfo('Email invitation (placeholder)', {
    to: email,
    subject: `Invitation to join workspace: ${workspaceName}`,
    invitationUrl,
    workspaceName,
    inviterEmail,
  });

  // In production, implement actual email sending:
  // await emailClient.send({
  //   to: email,
  //   subject: `Invitation to join workspace: ${workspaceName}`,
  //   html: generateInvitationEmailHtml(invitationUrl, workspaceName, inviterEmail),
  //   text: generateInvitationEmailText(invitationUrl, workspaceName, inviterEmail),
  // });
}

/**
 * Generate invitation email HTML content
 * @param invitationUrl - Invitation acceptance URL
 * @param workspaceName - Workspace name
 * @param inviterEmail - Inviter's email address
 * @returns HTML email content
 * @internal - Used in commented-out email sending code
 */
// @ts-expect-error - Function is reserved for future use when email sending is implemented

function _generateInvitationEmailHtml(
  invitationUrl: string,
  workspaceName: string,
  inviterEmail: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Workspace Invitation</title>
      </head>
      <body>
        <h1>You've been invited to join a workspace</h1>
        <p><strong>${inviterEmail}</strong> has invited you to join the workspace: <strong>${workspaceName}</strong></p>
        <p>Click the link below to accept the invitation:</p>
        <p><a href="${invitationUrl}">Accept Invitation</a></p>
        <p>This invitation link will expire in 7 days.</p>
      </body>
    </html>
  `;
}

/**
 * Generate invitation email text content
 * @param invitationUrl - Invitation acceptance URL
 * @param workspaceName - Workspace name
 * @param inviterEmail - Inviter's email address
 * @returns Plain text email content
 * @internal - Used in commented-out email sending code
 */
// @ts-expect-error - Function is reserved for future use when email sending is implemented

function _generateInvitationEmailText(
  invitationUrl: string,
  workspaceName: string,
  inviterEmail: string
): string {
  return `
    You've been invited to join a workspace

    ${inviterEmail} has invited you to join the workspace: ${workspaceName}

    Accept the invitation by visiting:
    ${invitationUrl}

    This invitation link will expire in 7 days.
  `;
}
