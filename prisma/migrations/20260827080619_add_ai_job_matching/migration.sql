-- CreateTable
CREATE TABLE "job_match_analyses" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "freelancerId" TEXT NOT NULL,
    "matchScore" INTEGER NOT NULL,
    "strengths" TEXT[],
    "missingSkills" TEXT[],
    "recommendation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_match_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_match_analyses_jobId_freelancerId_key" ON "job_match_analyses"("jobId", "freelancerId");

-- AddForeignKey
ALTER TABLE "job_match_analyses" ADD CONSTRAINT "job_match_analyses_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_match_analyses" ADD CONSTRAINT "job_match_analyses_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
