import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
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
}).$extends({
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
