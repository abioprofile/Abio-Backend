import { linkService } from "@/service/link.service";
import catchAsync from "@/utils/catchAsync";
import { handleServiceResponse } from "@/utils/httpHandlers";
import type { Request, Response, RequestHandler } from "express";
import type {
  TCreateLink,
  TUpdateLink,
  TReorderLinks,
} from "@/schemas/link.schema";

class LinkController {
  public create: RequestHandler = catchAsync(
    async (req: Request<{}, {}, TCreateLink>, res: Response) => {
      const serviceResponse = await linkService.create(req.user!.id, req.body);
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public getAll: RequestHandler = catchAsync(
    async (req: Request, res: Response) => {
      const serviceResponse = await linkService.getAllByUserId(req.user!.id);
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public getById: RequestHandler = catchAsync(
    async (req: Request<{ id: string }>, res: Response) => {
      const serviceResponse = await linkService.getById(
        req.params.id,
        req.user!.id
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public update: RequestHandler = catchAsync(
    async (req: Request<{ id: string }, {}, TUpdateLink>, res: Response) => {
      const serviceResponse = await linkService.update(
        req.params.id,
        req.user!.id,
        req.body
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public delete: RequestHandler = catchAsync(
    async (req: Request<{ id: string }>, res: Response) => {
      const serviceResponse = await linkService.delete(
        req.params.id,
        req.user!.id
      );
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public reorder: RequestHandler = catchAsync(
    async (req: Request<{}, {}, TReorderLinks>, res: Response) => {
      const serviceResponse = await linkService.reorder(req.user!.id, req.body);
      return handleServiceResponse(serviceResponse, res);
    }
  );

  public trackClick: RequestHandler = catchAsync(
    async (req: Request<{ id: string }>, res: Response) => {
      const serviceResponse = await linkService.trackClick(req.params.id);
      return handleServiceResponse(serviceResponse, res);
    }
  );
}

export default new LinkController();
