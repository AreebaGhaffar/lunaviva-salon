-- CreateTable
CREATE TABLE "WhatsAppTemplates" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "language" TEXT NOT NULL DEFAULT 'en_US',
    "reminder24" TEXT,
    "reminder2" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplates_pkey" PRIMARY KEY ("id")
);
