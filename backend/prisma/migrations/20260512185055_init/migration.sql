-- CreateTable
CREATE TABLE "public"."Flow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nodes" JSONB NOT NULL,
    "edges" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExecutionHistory" (
    "id" TEXT NOT NULL,
    "flowId" TEXT,
    "status" TEXT NOT NULL,
    "input" JSONB,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ExecutionHistory" ADD CONSTRAINT "ExecutionHistory_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "public"."Flow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
