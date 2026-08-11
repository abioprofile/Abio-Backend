import { Request, Response, NextFunction } from "express";
import logger from "@/shared/config/logger";
import { v4 as uuidv4 } from "uuid";

export const requestLogger = (req: Request & { requestId: string }, res: Response, next: NextFunction) => {
    const requestId = uuidv4()
    const start = Date.now()
  
    req.requestId = requestId
  
    res.on("finish", () => {
      const responseTime = Date.now() - start
  
      const logData = {
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        userId: req.user?.id ?? "unauthenticated",
      }
  
      if (res.statusCode >= 500) {
        logger.error(logData, "Request failed")
      } else if (res.statusCode >= 400) {
        logger.warn(logData, "Request error")
      } else {
        logger.info(logData, "Request completed")
      }
    })
  
    next()
  }