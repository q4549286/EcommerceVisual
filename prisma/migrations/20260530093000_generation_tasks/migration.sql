-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "GenerationTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'generation',
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "input" JSONB NOT NULL,
    "assets" JSONB,
    "generationId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationTask_userId_createdAt_idx" ON "GenerationTask"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationTask_status_createdAt_idx" ON "GenerationTask"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
