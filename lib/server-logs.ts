import { prisma } from "@/lib/prisma";
import type { CallLog } from "@/lib/types";

export async function writeSystemLog(input: {
  userId?: string;
  level?: "INFO" | "WARN" | "ERROR";
  action: string;
  message: string;
  metadata?: unknown;
}) {
  try {
    await prisma.systemLog.create({
      data: {
        userId: input.userId,
        level: input.level || "INFO",
        action: input.action,
        message: input.message,
        metadata: input.metadata == null ? undefined : JSON.parse(JSON.stringify(input.metadata))
      }
    });
  } catch {
  }
}

export async function writeApiLog(userId: string | undefined, action: string, log: CallLog) {
  try {
    await prisma.apiLog.create({
      data: {
        userId,
        endpoint: log.endpoint,
        method: "POST",
        action,
        model: log.model,
        imageType: log.imageType,
        size: log.size,
        status: log.status,
        durationMs: log.durationMs,
        ok: log.ok,
        error: log.error
      }
    });
  } catch {
  }
}
