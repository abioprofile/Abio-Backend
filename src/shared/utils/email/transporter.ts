import nodemailer from "nodemailer";
import { convert } from "html-to-text";
import env from "@/env";

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
      auth: {
        user: env.SMTP_USERNAME,
        pass: env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
};

export const sendMail = async (input: {
  to: string;
  subject: string;
  html: string;
}) => {
  const from = `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`;
  await getTransporter().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: convert(input.html),
  });
};
