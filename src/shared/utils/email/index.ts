import { ORGANIZATION_NAME } from "@/shared/utils/constants";
import { sendMail } from "./transporter";
import {
  firstNameFrom,
  passwordResetEmailHtml,
  verificationEmailHtml,
  waitlistConfirmationHtml,
  welcomeEmailHtml,
} from "./templates";

export type VerificationEmailInput = {
  to: string;
  name: string;
  verifyUrl: string;
};

export type PasswordResetEmailInput = {
  to: string;
  name: string;
  resetUrl: string;
};

export type WelcomeEmailInput = {
  to: string;
  name: string;
  url: string;
};

export type WaitlistEmailInput = {
  to: string;
  name: string;
};

/** Low-level senders used by the email worker (and tests). */
export const sendEmailVerification = async ({
  to,
  name,
  verifyUrl,
}: VerificationEmailInput) => {
  await sendMail({
    to,
    subject: "Verify Your Email Address",
    html: verificationEmailHtml(firstNameFrom(name), verifyUrl),
  });
};

export const sendPasswordReset = async ({
  to,
  name,
  resetUrl,
}: PasswordResetEmailInput) => {
  await sendMail({
    to,
    subject: "Reset Your Password",
    html: passwordResetEmailHtml(firstNameFrom(name), resetUrl),
  });
};

export const sendWelcome = async ({ to, name, url }: WelcomeEmailInput) => {
  await sendMail({
    to,
    subject: `Welcome to ${ORGANIZATION_NAME}!`,
    html: welcomeEmailHtml(firstNameFrom(name), url),
  });
};

export const sendWaitlistConfirmation = async ({
  to,
  name,
}: WaitlistEmailInput) => {
  await sendMail({
    to,
    subject: "You've successfully joined the Waitlist!",
    html: waitlistConfirmationHtml(name),
  });
};
