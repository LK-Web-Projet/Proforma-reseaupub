import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === "true",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function sendEmail({ to, cc, subject, html }: SendEmailOptions) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: Array.isArray(to) ? to.join(", ") : to,
    cc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : undefined,
    subject,
    html,
  });
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
