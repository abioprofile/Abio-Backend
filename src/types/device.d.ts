import { AuthenticatedRequest } from "@/types/express";
import { TDeviceCreate, TDeviceUpdate, TDeviceGet } from "@/schemas/device.schema";

export interface CreateDeviceRequest extends AuthenticatedRequest {
  body: TDeviceCreate;
}

export interface UpdateDeviceRequest extends AuthenticatedRequest {
  params: TDeviceGet;
  body: TDeviceUpdate;
}

export interface DeleteDeviceRequest extends AuthenticatedRequest {
  params: TDeviceGet;
}

export interface GetDeviceRequest extends AuthenticatedRequest {
  params: TDeviceGet;
}
