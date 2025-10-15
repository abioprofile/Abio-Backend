import { prisma } from "@/server";
import { TCreateWaitlist } from "@/schemas/waitlist.schema";
import { ServiceResponse } from "@/utils/serviceResponse";
import { StatusCodes } from "http-status-codes";

export class WaitlistService {
  async create(data: TCreateWaitlist) {
    const existingEntry = await prisma.waitlist.findUnique({
      where: { email: data.email },
    });

    if (existingEntry) {
      return ServiceResponse.failure(
        "Email already registered on waitlist",
        null,
        StatusCodes.CONFLICT
      );
    }

    const waitlistEntry = await prisma.waitlist.create({
      data: {
        email: data.email,
      },
    });

    return ServiceResponse.success(
      "Successfully joined waitlist",
      waitlistEntry,
      StatusCodes.CREATED
    );
  }

  async getAll() {
    const waitlist = await prisma.waitlist.findMany({
      orderBy: { createdAt: "desc" },
    });

    return ServiceResponse.success("Waitlist retrieved successfully", waitlist);
  }
}

export const waitlistService = new WaitlistService();
