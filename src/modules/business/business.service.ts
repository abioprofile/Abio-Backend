import { StatusCodes } from "http-status-codes";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { getPagination, getTotalPages } from "@/shared/utils/pagination";
import type {
  TCreateBusinessInquiry,
  TListBusinessInquiriesQuery,
} from "./business.schemas";

const inquiryWithUserInclude = {
  user: { select: { id: true, email: true, name: true } },
} as const;

/** POST /api/v1/user/business-inquiries — "Grow with Abio" form */
export const create = async (userId: string, data: TCreateBusinessInquiry) => {
  const inquiry = await prisma.businessInquiry.create({
    data: {
      userId,
      companyName: data.companyName,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      companySize: data.companySize,
      industry: data.industry,
      features: data.features,
    },
  });

  return ServiceResponse.success(
    "Thanks! Our team will reach out within 24 hours.",
    inquiry,
    StatusCodes.CREATED
  );
};

/** GET /api/v1/admin/business-inquiries */
export const listAll = async (query: TListBusinessInquiriesQuery) => {
  const { page, limit, skip } = getPagination(query as Record<string, unknown>);
  const where: Prisma.BusinessInquiryWhereInput = {};

  if (query.q) {
    where.OR = [
      { companyName: { contains: query.q, mode: "insensitive" } },
      { fullName: { contains: query.q, mode: "insensitive" } },
      { email: { contains: query.q, mode: "insensitive" } },
    ];
  }

  const [total, inquiries] = await Promise.all([
    prisma.businessInquiry.count({ where }),
    prisma.businessInquiry.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: inquiryWithUserInclude,
    }),
  ]);

  return ServiceResponse.success("Business inquiries retrieved successfully", {
    inquiries,
    pagination: {
      page,
      limit,
      total,
      totalPages: getTotalPages(total, limit),
    },
  });
};

/** GET /api/v1/admin/business-inquiries/:id */
export const getById = async (id: string) => {
  const inquiry = await prisma.businessInquiry.findUnique({
    where: { id },
    include: inquiryWithUserInclude,
  });

  if (!inquiry) {
    return ServiceResponse.failure(
      "Business inquiry not found",
      null,
      StatusCodes.NOT_FOUND
    );
  }

  return ServiceResponse.success(
    "Business inquiry retrieved successfully",
    inquiry
  );
};
