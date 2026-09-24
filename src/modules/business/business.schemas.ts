import z from "zod";
import { zPhone } from "@/shared/utils/zod/phone";

export const createBusinessInquirySchema = z.object({
  body: z.object({
    companyName: z
      .string({ required_error: "Company name is required" })
      .trim()
      .min(1, "Company name is required")
      .max(200),
    fullName: z
      .string({ required_error: "Full name is required" })
      .trim()
      .min(1, "Full name is required")
      .max(200),
    email: z
      .string({ required_error: "Email is required" })
      .email("Invalid email address"),
    phone: zPhone,
    companySize: z
      .string({ required_error: "Company size is required" })
      .trim()
      .min(1, "Company size is required")
      .max(100),
    industry: z
      .string({ required_error: "Industry is required" })
      .trim()
      .min(1, "Industry is required")
      .max(100),
    features: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  }),
});

export const listBusinessInquiriesSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export type TCreateBusinessInquiry = z.infer<
  typeof createBusinessInquirySchema
>["body"];
export type TListBusinessInquiriesQuery = z.infer<
  typeof listBusinessInquiriesSchema
>["query"];
