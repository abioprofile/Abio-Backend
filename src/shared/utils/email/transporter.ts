import nodemailer from "nodemailer";
import axios from "axios";
import { convert } from "html-to-text";
import env from "@/env";
import AppError from "@/shared/utils/appError";
import { StatusCodes } from "http-status-codes";
import logger from "@/shared/config/logger";

let smtpTransporter: nodemailer.Transporter | null = null;

const getSmtpTransporter = () => {
  if (!smtpTransporter) {
    if (!env.SMTP_HOST || !env.SMTP_USERNAME || !env.SMTP_PASSWORD) {
      throw new AppError(
        "SMTP is not configured (SMTP_HOST / SMTP_USERNAME / SMTP_PASSWORD)",
        StatusCodes.INTERNAL_SERVER_ERROR
      );
    }

    smtpTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: (env.SMTP_PORT ?? 587) === 465,
      auth: {
        user: env.SMTP_USERNAME,
        pass: env.SMTP_PASSWORD,
      },
    });
  }
  return smtpTransporter;
};

const sendViaSmtp = async (input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) => {
  const from = `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`;
  await getSmtpTransporter().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
};

/** Brevo Transactional HTTP API — preferred on Railway (avoids SMTP timeouts). */
const sendViaBrevoApi = async (input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) => {
  if (!env.BREVO_API_KEY) {
    throw new AppError(
      "BREVO_API_KEY is required when EMAIL_PROVIDER=brevo",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }

  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: env.EMAIL_FROM_NAME,
          email: env.EMAIL_FROM,
        },
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.html,
        textContent: input.text,
      },
      {
        headers: {
          "api-key": env.BREVO_API_KEY,
          "content-type": "application/json",
          accept: "application/json",
        },
        timeout: 20_000,
      }
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail =
        typeof error.response?.data === "object"
          ? JSON.stringify(error.response.data)
          : error.message;
      logger.error(
        { status: error.response?.status, detail },
        "Brevo API email send failed"
      );
      throw new AppError(
        `Brevo email failed: ${detail}`,
        StatusCodes.BAD_GATEWAY
      );
    }
    throw error;
  }
};

export const sendMail = async (input: {
  to: string;
  subject: string;
  html: string;
}) => {
  const text = convert(input.html);
  const payload = { ...input, text };

  if (env.EMAIL_PROVIDER === "brevo") {
    logger.debug({ to: input.to }, "Sending email via Brevo API");
    await sendViaBrevoApi(payload);
    return;
  }

  logger.debug({ to: input.to }, "Sending email via SMTP");
  await sendViaSmtp(payload);
};
