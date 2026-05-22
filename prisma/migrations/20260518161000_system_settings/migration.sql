CREATE TABLE "SystemSetting" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

INSERT INTO "SystemSetting" ("key", "value", "updatedAt", "createdAt")
VALUES ('loginBonusCredits', '4'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
