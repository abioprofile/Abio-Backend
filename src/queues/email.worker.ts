import type { Job } from "bull";
import logger from "@/shared/config/logger";
import {
  sendEmailVerification,
  sendPasswordReset,
  sendWaitlistConfirmation,
  sendWelcome,
} from "@/shared/utils/email";
import { emailQueue, type EmailJob } from "./queue";

emailQueue.process(async (job: Job<EmailJob>) => {
  const { type } = job.data;
  logger.info({ type, to: job.data.to, jobId: job.id }, "Processing email job");

  switch (job.data.type) {
    case "VERIFY_EMAIL":
      await sendEmailVerification({
        to: job.data.to,
        name: job.data.name,
        verifyUrl: job.data.verifyUrl,
      });
      break;
    case "RESET_PASSWORD":
      await sendPasswordReset({
        to: job.data.to,
        name: job.data.name,
        resetUrl: job.data.resetUrl,
      });
      break;
    case "WELCOME":
      await sendWelcome({
        to: job.data.to,
        name: job.data.name,
        url: job.data.url,
      });
      break;
    case "WAITLIST_CONFIRMATION":
      await sendWaitlistConfirmation({
        to: job.data.to,
        name: job.data.name,
      });
      break;
    default:
      logger.warn({ type }, "Unknown email job type");
  }
});

emailQueue.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, type: job?.data?.type, err },
    "Email job failed"
  );
});

emailQueue.on("completed", (job) => {
  logger.info(
    { jobId: job.id, type: job.data.type },
    "Email job completed successfully"
  );
});

logger.info("Email worker registered");
