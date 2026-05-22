import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("未配置 DATABASE_URL，请在 .env 中填写 PostgreSQL 连接串。");
  }
  return value;
}

const adapter = new PrismaPg({
  connectionString: databaseUrl()
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
