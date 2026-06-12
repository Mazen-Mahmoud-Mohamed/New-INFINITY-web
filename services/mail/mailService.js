const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST || "smtp-relay.brevo.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "INFINITY Total-Com Solutions";
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const EMAIL_LOGO_URL = process.env.EMAIL_LOGO_URL || "";

const LOGO_CID = "infinity-brand-logo";
const LOGO_FILE = path.join(__dirname, "../../assets/images/infinity-logo1.png");

let transporter = null;

function isMailConfigured() {
    return Boolean(SMTP_USER && SMTP_PASS);
}

function isPublicHttpUrl(url) {
    if (!url || typeof url !== "string") return false;
    try {
        const parsed = new URL(url);
        if (!/^https?:$/i.test(parsed.protocol)) return false;
        const host = parsed.hostname.toLowerCase();
        return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local");
    } catch (_err) {
        return false;
    }
}

function resolveEmailLogo() {
    if (EMAIL_LOGO_URL && isPublicHttpUrl(EMAIL_LOGO_URL)) {
        return { src: EMAIL_LOGO_URL, attachments: [] };
    }

    const publicAppLogo = `${APP_BASE_URL.replace(/\/$/, "")}/assets/images/infinity-logo1.png`;
    if (isPublicHttpUrl(publicAppLogo)) {
        return { src: publicAppLogo, attachments: [] };
    }

    if (fs.existsSync(LOGO_FILE)) {
        return {
            src: `cid:${LOGO_CID}`,
            attachments: [{
                filename: "infinity-logo.png",
                path: LOGO_FILE,
                cid: LOGO_CID,
            }],
        };
    }

    return { src: publicAppLogo, attachments: [] };
}

function getTransporter() {
    if (!isMailConfigured()) {
        throw new Error("SMTP is not configured. Set SMTP_USER and SMTP_PASS in .env");
    }
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_PORT === 465,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS,
            },
        });
    }
    return transporter;
}

function buildPasswordResetHtml({ name, otp, logoSrc }) {
    const greeting = name ? `Hello ${name},` : "Hello,";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Infinity Password</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0c4a6e,#0284c7);padding:28px 24px;text-align:center;">
              <img src="${logoSrc}" alt="INFINITY" width="72" height="72" style="display:block;margin:0 auto 12px;border-radius:12px;border:0;outline:none;text-decoration:none;">
              <h1 style="margin:0;color:#ffffff;font-size:1.35rem;font-weight:700;">INFINITY Total-Com Solutions</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 12px;color:#0f172a;font-size:1rem;line-height:1.6;">
              <p style="margin:0 0 12px;">${greeting}</p>
              <p style="margin:0 0 20px;color:#475569;">We received a request to reset your password. Use the verification code below to continue:</p>
              <div style="text-align:center;margin:24px 0;">
                <span style="display:inline-block;padding:16px 28px;font-size:2rem;font-weight:700;letter-spacing:0.35em;color:#0369a1;background:#e0f2fe;border-radius:12px;border:1px solid #bae6fd;">${otp}</span>
              </div>
              <p style="margin:0 0 8px;color:#475569;">This code expires in <strong>10 minutes</strong>.</p>
              <p style="margin:0;color:#64748b;font-size:0.92rem;">If you didn't request a password reset, you can safely ignore this email. Your password will not change.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 28px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:0.82rem;line-height:1.5;text-align:center;">
              <p style="margin:0;">© ${new Date().getFullYear()} INFINITY Total-Com Solutions</p>
              <p style="margin:6px 0 0;">GPS tracking &amp; fleet management · Egypt</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendPasswordResetEmail({ to, name, otp }) {
    const transport = getTransporter();
    const logo = resolveEmailLogo();
    const html = buildPasswordResetHtml({ name, otp, logoSrc: logo.src });
    await transport.sendMail({
        from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
        to,
        subject: "Reset Your Infinity Password",
        html,
        attachments: logo.attachments,
        text: [
            "Reset Your Infinity Password",
            "",
            name ? `Hello ${name},` : "Hello,",
            "",
            `Your verification code is: ${otp}`,
            "",
            "This code expires in 10 minutes.",
            "",
            "If you didn't request this, ignore this email.",
        ].join("\n"),
    });
}

module.exports = {
    isMailConfigured,
    sendPasswordResetEmail,
    resolveEmailLogo,
};
