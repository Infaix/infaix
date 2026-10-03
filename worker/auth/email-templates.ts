// Transactional email copy. Security mail stays free of marketing.
// HTML is table-based and inlined so it survives common clients; every
// message also has a plain-text body. No remote images.

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(heading: string, paragraphs: string[], action?: { href: string; label: string }): string {
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.55;color:#f0edf5;">${escapeHtml(p)}</p>`
    )
    .join("");
  const button = action
    ? `<p style="margin:0 0 16px;"><a href="${escapeHtml(action.href)}" style="display:inline-block;min-height:44px;padding:12px 18px;background:#9146ff;color:#ffffff;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.2;text-decoration:none;">${escapeHtml(action.label)}</a></p>
       <p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.5;color:#9b96a5;">If the button does not work, copy this address into your browser:<br><span style="color:#e8c4f6;word-break:break-all;">${escapeHtml(action.href)}</span></p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#08070c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#08070c;">
<tr><td style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#111019;border:1px solid #302a3d;">
<tr><td style="padding:28px 28px 4px;font-family:Georgia,'Times New Roman',serif;font-size:12px;letter-spacing:0.22em;text-transform:uppercase;color:#e8c4f6;">INFAIX</td></tr>
<tr><td style="padding:12px 28px 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:#f0edf5;">${escapeHtml(heading)}</td></tr>
<tr><td style="padding:8px 28px 28px;">${body}${button}
<p style="margin:8px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:12px;line-height:1.5;color:#9b96a5;">INFAIX identity mail. This message is about your account, not a promotion.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderVerificationEmail(link: string): RenderedEmail {
  const subject = "Verify your INFAIX account";
  const text = [
    "Verify your INFAIX account",
    "",
    "Confirm this email address to activate your INFAIX account.",
    "An INFAIX account is your identity. It does not grant access to private products.",
    "",
    `Verification link (expires in 24 hours, one use):`,
    link,
    "",
    "If you did not create an INFAIX account, you can ignore this email.",
  ].join("\n");
  const html = layout(
    subject,
    [
      "Confirm this email address to activate your INFAIX account.",
      "An INFAIX account is your identity. It does not grant access to private products.",
      "This link expires in 24 hours and works once. If you did not create an INFAIX account, you can ignore this email.",
    ],
    { href: link, label: "Verify email" }
  );
  return { subject, text, html };
}

export function renderWelcomeEmail(loginUrl: string): RenderedEmail {
  const subject = "Welcome to INFAIX";
  const text = [
    "Welcome to INFAIX",
    "",
    "Your email address is confirmed and your account is active.",
    "An INFAIX account is your identity. It does not grant access to private products. Each product decides access on its own.",
    "",
    `Log in: ${loginUrl}`,
    "",
    "If you did not create this account, reset your password from the login page.",
  ].join("\n");
  const html = layout(
    subject,
    [
      "Your email address is confirmed and your account is active.",
      "An INFAIX account is your identity. It does not grant access to private products. Each product decides access on its own.",
      "If you did not create this account, reset your password from the login page.",
    ],
    { href: loginUrl, label: "Log in" }
  );
  return { subject, text, html };
}

export function renderPasswordResetEmail(link: string): RenderedEmail {
  const subject = "Reset your INFAIX password";
  const text = [
    "Reset your INFAIX password",
    "",
    "We received a request to choose a new password for this INFAIX account.",
    "This link expires in 1 hour and works once. Choosing a new password signs out other sessions.",
    "",
    link,
    "",
    "If you did not request this, you can ignore this email. Your password will stay the same.",
  ].join("\n");
  const html = layout(
    subject,
    [
      "We received a request to choose a new password for this INFAIX account.",
      "This link expires in 1 hour and works once. Choosing a new password signs out other sessions.",
      "If you did not request this, you can ignore this email. Your password will stay the same.",
    ],
    { href: link, label: "Choose a new password" }
  );
  return { subject, text, html };
}

export function renderPasswordChangedEmail(resetUrl: string): RenderedEmail {
  const subject = "Your INFAIX password was changed";
  const text = [
    "Your INFAIX password was changed",
    "",
    "The password for this INFAIX account was just changed.",
    "If you made this change, no further action is needed.",
    "If you did not, request a new password from the link below. That signs out existing sessions.",
    "",
    resetUrl,
  ].join("\n");
  const html = layout(
    subject,
    [
      "The password for this INFAIX account was just changed.",
      "If you made this change, no further action is needed.",
      "If you did not, request a new password. That signs out existing sessions.",
    ],
    { href: resetUrl, label: "Request a password reset" }
  );
  return { subject, text, html };
}

/** Security notice for a future email-address change. Not sent today: Core has no email-change endpoint. */
export function renderEmailChangedEmail(previousMasked: string, supportUrl: string): RenderedEmail {
  const subject = "Your INFAIX email address was changed";
  const text = [
    "Your INFAIX email address was changed",
    "",
    `The email address on an INFAIX account previously using ${previousMasked} was changed.`,
    "If you made this change, no further action is needed.",
    "If you did not, reset the password for the account you still control.",
    "",
    supportUrl,
  ].join("\n");
  const html = layout(
    subject,
    [
      `The email address on an INFAIX account previously using ${previousMasked} was changed.`,
      "If you made this change, no further action is needed.",
      "If you did not, reset the password for the account you still control.",
    ],
    { href: supportUrl, label: "Reset password" }
  );
  return { subject, text, html };
}
