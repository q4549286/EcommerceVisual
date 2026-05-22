import { NextResponse } from "next/server";
import { AuthError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const records = await prisma.creditRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50
    });
    return NextResponse.json({
      ok: true,
      records: records.map((record) => ({
        ...record,
        createdAt: record.createdAt.toISOString()
      }))
    });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 500;
    const message = error instanceof Error ? error.message : "读取失败。";
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
