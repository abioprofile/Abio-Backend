import { AuthenticatedRequest } from "@/types/express";
import { TCreatePartner } from "@/schemas/partner.schema";


export interface CreatePartnerRequest extends AuthenticatedRequest {
  body: TCreatePartner;
}

export interface UpdatePartnerRequest extends AuthenticatedRequest {
  params: TPartnerParams;
  body: TUpdatePartner;
}

export interface DeletePartnerRequest extends AuthenticatedRequest {
  params: TPartnerParams;
}