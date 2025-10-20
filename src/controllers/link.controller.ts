import { linkService } from "@/service/link.service";
import catchAsync from "@/utils/catchAsync";
import { handleServiceResponse } from "@/utils/httpHandlers";
import type { Response, RequestHandler } from "express";
import { AuthenticatedRequest } from "@/types/express";
import type {
  CreateLinkRequest,
  GetLinkRequest,
  UpdateLinkRequest,
  DeleteLinkRequest,
  ReorderLinksRequest,
  TrackLinkClickRequest,
} from "@/types";

class LinkController {
  public create: RequestHandler = catchAsync(
    async (req: CreateLinkRequest, res: Response) => {
      const serviceResponse = await linkService.create(req.user.id, req.body);
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public getAll: RequestHandler = catchAsync(
    async (req: AuthenticatedRequest, res: Response) => {
      const serviceResponse = await linkService.getAllByUserId(req.user.id);
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public getById: RequestHandler = catchAsync(
    async (req: GetLinkRequest, res: Response) => {
      const serviceResponse = await linkService.getById(
        req.params.id,
        req.user.id
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public update: RequestHandler = catchAsync(
    async (req: UpdateLinkRequest, res: Response) => {
      const serviceResponse = await linkService.update(
        req.params.id,
        req.user.id,
        req.body
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public delete: RequestHandler = catchAsync(
    async (req: DeleteLinkRequest, res: Response) => {
      const serviceResponse = await linkService.delete(
        req.params.id,
        req.user.id
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public reorder: RequestHandler = catchAsync(
    async (req: ReorderLinksRequest, res: Response) => {
      const serviceResponse = await linkService.reorder(req.user.id, req.body);
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public trackClick: RequestHandler = catchAsync(
    async (req: TrackLinkClickRequest, res: Response) => {
      const serviceResponse = await linkService.trackClick(req.params.id);
      return handleServiceResponse(serviceResponse, res);
    }
  );
}

export default new LinkController();
