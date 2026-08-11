import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import logger from "@/shared/config/logger";

const prismaClient = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "error", emit: "stdout" },
    { level: "warn", emit: "stdout" },
  ],
  omit: {
    user: {
      password: true,
      passwordChangedAt: true,
      passwordResetToken: true,
      passwordResetExpires: true,
    },
    profile: {
      userId: true,
    },
  },
});

// Flag anything over 100ms
prismaClient.$on("query", (e) => {
  if (e.duration > 100) {
    logger.warn(
      {
        query: e.query,
        duration: `${e.duration}ms`,
        params: e.params,
      },
      "Slow query detected"
    );
  }
});

const prisma = prismaClient.$extends({
  query: {
    user: {
      async create({ args, query }) {
        const password = args.data.password as string;
        const hashedPassword = await bcrypt.hash(password, 10);
        args.data.password = hashedPassword;
        return query(args);
      },
    },
  },
});

export { prisma };
