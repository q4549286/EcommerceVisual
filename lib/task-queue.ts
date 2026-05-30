import { prisma } from "@/lib/prisma";
import { buildImagePlans } from "@/lib/plans";
import { assetToFile, buildTaskTitle, fileToAsset, runGeneration, type GenerationAssetBundle } from "@/lib/generation-service";
import type { ImagePlan, ProductInput, TaskSummary } from "@/lib/types";

const runningTasks = new Set<string>();
const queuedTaskIds: string[] = [];
let workerRunning = false;
const DEFAULT_TASK_CONCURRENCY = 5;

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const TASK_CONCURRENCY = positiveInt(process.env.TASK_CONCURRENCY, DEFAULT_TASK_CONCURRENCY);

type TaskRecord = {
  id: string;
  kind: string;
  title: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress: number;
  totalSteps: number;
  message: string | null;
  error: string | null;
  input: unknown;
  assets: unknown;
  generationId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  generation?: {
    id: string;
    input: unknown;
    productName: string;
    language: string;
    imageCount: number;
    successCount: number;
    failCount: number;
    createdAt: Date;
    images: Array<{
      type: string;
      title: string;
      size: string;
      ok: boolean;
      imageUrl: string | null;
      error: string | null;
      createdAt: Date;
    }>;
  } | null;
};

type TaskGenerationImages = NonNullable<TaskRecord["generation"]>["images"];

export async function readTaskAssets(task: Pick<TaskRecord, "assets">): Promise<GenerationAssetBundle> {
  const assets = task.assets as GenerationAssetBundle | null | undefined;
  return assets || {};
}

export function taskPlansFromGeneration(input: ProductInput, images: TaskGenerationImages) {
  const draftPlans = buildImagePlans(input);
  const imageByType = new Map(images.map((image) => [image.type, image]));
  const plans: ImagePlan[] = draftPlans.map((plan) => {
    const image = imageByType.get(plan.type);
    return {
      ...plan,
      title: image?.title || plan.title,
      size: image?.size || plan.size,
      imageUrl: image?.imageUrl || undefined,
      error: image?.error || undefined
    };
  });
  for (const image of images) {
    if (!plans.some((plan) => plan.type === image.type)) {
      plans.push({
        type: image.type as ImagePlan["type"],
        title: image.title,
        usage: "历史生成图片",
        size: image.size,
        localizedCopy: [],
        designNotes: "",
        prompt: "",
        negativePrompt: "",
        imageUrl: image.imageUrl || undefined,
        error: image.error || undefined
      });
    }
  }
  return plans;
}

function serializeGenerationInput(input: unknown) {
  return input as ProductInput;
}

export function toTaskSummary(task: TaskRecord): TaskSummary {
  const input = serializeGenerationInput(task.input);
  const plans = task.generation ? taskPlansFromGeneration(input, task.generation.images) : undefined;
  return {
    id: task.id,
    kind: task.kind,
    title: task.title,
    status: task.status,
    progress: task.progress,
    totalSteps: task.totalSteps,
    message: task.message,
    error: task.error,
    createdAt: task.createdAt.toISOString(),
    startedAt: task.startedAt ? task.startedAt.toISOString() : null,
    finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
    generationId: task.generationId,
    plans
  };
}

export async function listUserTasks(userId: string, limit = 20) {
  const tasks = await prisma.generationTask.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      generation: {
        include: {
          images: {
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });
  return tasks.map((task) => toTaskSummary(task as unknown as TaskRecord));
}

async function claimTask(taskId: string) {
  const claimed = await prisma.generationTask.updateMany({
    where: {
      id: taskId,
      status: {
        in: ["PENDING", "RUNNING"]
      }
    },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      finishedAt: null,
      error: null,
      message: "准备生成",
      progress: 0
    }
  });
  return claimed.count > 0;
}

export async function enqueueTask(taskId: string) {
  if (runningTasks.has(taskId) || queuedTaskIds.includes(taskId)) return;
  queuedTaskIds.push(taskId);
  void drainQueue();
}

export async function cancelUserTask(userId: string, taskId: string) {
  const task = await prisma.generationTask.findFirst({
    where: { id: taskId, userId },
    select: { status: true }
  });

  if (!task) {
    return { ok: false, status: 404, error: "任务不存在。" };
  }
  if (!["PENDING", "RUNNING"].includes(task.status)) {
    return { ok: false, status: 400, error: "只有等待中或生成中的任务可以终止。" };
  }

  const index = queuedTaskIds.indexOf(taskId);
  if (index >= 0) queuedTaskIds.splice(index, 1);

  await prisma.generationTask.update({
    where: { id: taskId },
    data: {
      status: "CANCELED",
      message: "已终止",
      error: null,
      finishedAt: new Date()
    }
  });

  return { ok: true, status: 200 };
}

export async function resumeIncompleteTasks(userId?: string) {
  const staleBefore = new Date(Date.now() - 2 * 60 * 1000);
  const tasks = await prisma.generationTask.findMany({
    where: {
      ...(userId ? { userId } : {}),
      status: {
        in: ["PENDING", "RUNNING"]
      },
      OR: [
        { status: "PENDING" },
        { updatedAt: { lt: staleBefore } }
      ]
    },
    orderBy: { createdAt: "asc" },
    take: 10,
    select: { id: true }
  });

  for (const task of tasks) {
    await enqueueTask(task.id);
  }
}

async function drainQueue() {
  if (workerRunning) return;
  workerRunning = true;

  try {
    while (queuedTaskIds.length > 0 && runningTasks.size < TASK_CONCURRENCY) {
      const taskId = queuedTaskIds.shift();
      if (!taskId || runningTasks.has(taskId)) continue;
      runningTasks.add(taskId);
      void processTask(taskId)
        .catch(async (error) => {
          const message = error instanceof Error ? error.message : "任务执行失败。";
          await prisma.generationTask.update({
            where: { id: taskId },
            data: {
              status: "FAILED",
              message,
              error: message,
              finishedAt: new Date()
            }
          }).catch(() => undefined);
        })
        .finally(() => {
          runningTasks.delete(taskId);
          void drainQueue();
        });
    }
  } finally {
    workerRunning = false;
    if (queuedTaskIds.length > 0 && runningTasks.size < TASK_CONCURRENCY) {
      void drainQueue();
    }
  }
}

export async function processTask(taskId: string) {
  const claimed = await claimTask(taskId);
  if (!claimed) return;

  const task = await prisma.generationTask.findUnique({
    where: { id: taskId }
  });
  if (!task) return;

  const input = task.input as ProductInput;
  const assets = await readTaskAssets(task);
  const productImage = assets.productImage ? await assetToFile(assets.productImage) : null;
  const referenceImages = [];
  for (const reference of assets.referenceImages || []) {
    referenceImages.push(await assetToFile(reference));
  }

  const result = await runGeneration({
    userId: task.userId,
    input,
    productImage,
    referenceImages,
    taskId,
    existingGenerationId: task.generationId || undefined,
    onProgress: async (update) => {
      await prisma.generationTask.update({
        where: { id: taskId },
        data: {
          message: update.message,
          progress: Math.min(99, Math.round((update.index / Math.max(update.total, 1)) * 100))
        }
      }).catch(() => undefined);
    }
  });

  const currentTask = await prisma.generationTask.findUnique({
    where: { id: taskId },
    select: { status: true }
  }).catch(() => null);
  if (currentTask?.status === "CANCELED") return;

  await prisma.generationTask.update({
    where: { id: taskId },
    data: {
      generationId: result.generationId,
      status: result.ok ? "SUCCEEDED" : "FAILED",
      progress: 100,
      message: result.ok ? `已完成 ${result.plans.filter((plan) => plan.imageUrl).length} 张` : result.error || "生成失败",
      error: result.ok ? null : result.error || null,
      finishedAt: new Date()
    }
  }).catch(() => undefined);
}

export async function createGenerationTask(input: {
  userId: string;
  productImage?: File | null;
  referenceImages?: File[];
  input: ProductInput;
}) {
  const plans = buildImagePlans(input.input);
  const task = await prisma.generationTask.create({
    data: {
      userId: input.userId,
      kind: "generation",
      title: buildTaskTitle(input.input),
      totalSteps: plans.length,
      progress: 0,
      input: JSON.parse(JSON.stringify(input.input)),
      assets: {
        productImage: input.productImage ? await fileToAsset(input.productImage) : null,
        referenceImages: await Promise.all((input.referenceImages || []).slice(0, 6).map((file) => fileToAsset(file)))
      }
    }
  });

  void enqueueTask(task.id);
  return task;
}
