import { AuthenticatedRequest } from "@/types/express";
import { TCreateLink, TUpdateLink, TReorderLinks } from "@/schemas/link.schema";

export interface CreateLinkRequest extends AuthenticatedRequest {
  body: TCreateLink;
}

export interface GetLinkRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
}

export interface UpdateLinkRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
  body: TUpdateLink;
}

export interface DeleteLinkRequest extends AuthenticatedRequest {
  params: {
    id: string;
  };
}

export interface ReorderLinksRequest extends AuthenticatedRequest {
  body: TReorderLinks;
}

export interface TrackLinkClickRequest {
  params: {
    id: string;
  };
}

export interface UpdateLinkIconRequest extends AuthenticatedRequest {
  params: {
    id: string,
  }
}