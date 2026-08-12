import Bull from "bull";
import env from "@/env";

/**
 * Discriminated job payloads — worker switches on `type`.
 * Keep this Abio-only (no foreign appointment jobs).
 */
export type EmailJob =
  | {
      type: "VERIFY_EMAIL";
      to: string;
      name: string;
      verifyUrl: string;
    }
  | {
      type: "RESET_PASSWORD";
      to: string;
      name: string;
      resetUrl: string;
    }
  | {
      type: "WELCOME";
      to: string;
      name: string;
      url: string;
    }
  | {
      type: "WAITLIST_CONFIRMATION";
      to: string;
      name: string;
    };

/** Pass the full Redis URL — Bull parses host/port/db from it. */
export const emailQueue = new Bull<EmailJob>("email", env.REDIS_URL, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const enqueueVerificationEmail = (
  data: Omit<Extract<EmailJob, { type: "VERIFY_EMAIL" }>, "type">
) => emailQueue.add({ type: "VERIFY_EMAIL", ...data });

export const enqueuePasswordResetEmail = (
  data: Omit<Extract<EmailJob, { type: "RESET_PASSWORD" }>, "type">
) => emailQueue.add({ type: "RESET_PASSWORD", ...data });

export const enqueueWelcomeEmail = (
  data: Omit<Extract<EmailJob, { type: "WELCOME" }>, "type">
) => emailQueue.add({ type: "WELCOME", ...data });

export const enqueueWaitlistConfirmationEmail = (
  data: Omit<Extract<EmailJob, { type: "WAITLIST_CONFIRMATION" }>, "type">
) => emailQueue.add({ type: "WAITLIST_CONFIRMATION", ...data });
