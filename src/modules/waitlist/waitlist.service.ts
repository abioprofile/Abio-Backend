import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";
import { ConflictError } from "@/shared/utils/errors";
import { enqueueWaitlistConfirmationEmail } from "@/queues/queue";
import type { TCreateWaitlist } from "./waitlist.schemas";

export const create = async (data: TCreateWaitlist) => {
  const existingEntry = await prisma.waitlist.findUnique({
    where: { email: data.email },
  });

  if (existingEntry) {
    throw new ConflictError("Email already registered on waitlist");
  }

  const waitlistEntry = await prisma.waitlist.create({
    data: {
      name: data.name,
      email: data.email,
    },
  });

  try {
    await enqueueWaitlistConfirmationEmail({
      to: data.email,
      name: data.name,
    });
  } catch (error) {
    console.error("Failed to enqueue waitlist confirmation email:", error);
  }

  return ServiceResponse.success(
    "Successfully joined waitlist",
    waitlistEntry,
    StatusCodes.CREATED
  );
};

export const getAll = async () => {
  const waitlist = await prisma.waitlist.findMany({
    orderBy: { createdAt: "desc" },
  });

  return ServiceResponse.success("Waitlist retrieved successfully", waitlist);
};
