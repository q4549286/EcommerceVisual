import { prisma } from "@/lib/prisma";
import { getLoginBonusCredits } from "@/lib/settings";

export class CreditError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function beijingDayRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const start = new Date(Date.UTC(year, month - 1, day) - 8 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

async function changeCredits(input: {
  userId: string;
  amount: number;
  type: "LOGIN_BONUS" | "GENERATION_DEBIT" | "GENERATION_REFUND" | "ADMIN_ADJUSTMENT";
  note?: string;
  generationId?: string;
  requireSufficient?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { credits: true }
    });

    if (!user) {
      throw new CreditError("用户不存在。", 404);
    }

    if (input.requireSufficient && user.credits + input.amount < 0) {
      throw new CreditError("积分不足，请登录领取积分或联系管理员。", 402);
    }

    const balanceBefore = user.credits;
    const balanceAfter = balanceBefore + input.amount;

    const updated = await tx.user.update({
      where: { id: input.userId },
      data: { credits: balanceAfter },
      select: { credits: true }
    });

    await tx.creditRecord.create({
      data: {
        userId: input.userId,
        type: input.type,
        amount: input.amount,
        balanceBefore,
        balanceAfter,
        note: input.note,
        generationId: input.generationId
      }
    });

    return updated.credits;
  });
}

export async function grantLoginCredits(userId: string) {
  const amount = await getLoginBonusCredits();
  const { start, end, key } = beijingDayRange();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { credits: true }
    });

    if (!user) {
      throw new CreditError("用户不存在。", 404);
    }

    if (amount <= 0) return user.credits;

    const existing = await tx.creditRecord.findFirst({
      where: {
        userId,
        type: "LOGIN_BONUS",
        createdAt: {
          gte: start,
          lt: end
        }
      },
      select: { id: true }
    });

    if (existing) return user.credits;

    const balanceBefore = user.credits;
    const balanceAfter = balanceBefore + amount;
    const updated = await tx.user.update({
      where: { id: userId },
      data: { credits: balanceAfter },
      select: { credits: true }
    });

    await tx.creditRecord.create({
      data: {
        userId,
        type: "LOGIN_BONUS",
        amount,
        balanceBefore,
        balanceAfter,
        note: `每日登录赠送 ${key}`
      }
    });

    return updated.credits;
  });
}

export async function reserveGenerationCredits(userId: string, generationId: string, amount: number, note: string) {
  if (amount <= 0) return 0;
  return changeCredits({
    userId,
    amount: -amount,
    type: "GENERATION_DEBIT",
    note,
    generationId,
    requireSufficient: true
  });
}

export async function refundGenerationCredits(userId: string, generationId: string, amount: number, note: string) {
  if (amount <= 0) return 0;
  return changeCredits({
    userId,
    amount,
    type: "GENERATION_REFUND",
    note,
    generationId
  });
}

export async function setUserCredits(userId: string, nextCredits: number, adminId: string) {
  if (!Number.isInteger(nextCredits) || nextCredits < 0) {
    throw new CreditError("积分必须是非负整数。");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { credits: true }
    });

    if (!user) {
      throw new CreditError("用户不存在。", 404);
    }

    const balanceBefore = user.credits;
    const amount = nextCredits - balanceBefore;

    const updated = await tx.user.update({
      where: { id: userId },
      data: { credits: nextCredits },
      select: { credits: true }
    });

    await tx.creditRecord.create({
      data: {
        userId,
        type: "ADMIN_ADJUSTMENT",
        amount,
        balanceBefore,
        balanceAfter: nextCredits,
        note: `管理员调整：${adminId}`
      }
    });

    return updated.credits;
  });
}
