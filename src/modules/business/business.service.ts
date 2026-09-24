import { StatusCodes } from "http-status-codes";
import { prisma } from "@/shared/config/database";
import { ServiceResponse } from "@/shared/utils/serviceResponse";
import { getPagination, getTotalPages } from "@/shared/utils/pagination";
import type {
  TCreateBusinessInquiry,
  TListBusinessInquiriesQuery,
} from "./business.schemas";

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

  const [total, inquiries] = await Promise.all([
    prisma.businessInquiry.count(),
    prisma.businessInquiry.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
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
