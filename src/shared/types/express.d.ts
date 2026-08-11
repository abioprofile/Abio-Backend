import { Request } from "express";
import { Prisma, Role, User } from "@prisma/client";

const userWithRoles = Prisma.validator<Prisma.UserDefaultArgs>()({
  include: {
    roles: {
      include: {
        role: true,
      },
    },
  },
});

export type UserWithRoles = Prisma.UserGetPayload<typeof userWithRoles>;

export interface AuthenticatedRequest<
  P = {},
  ResBody = any,
  ReqBody = any,
  ReqQuery = any,
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user: UserWithRoles;
}
