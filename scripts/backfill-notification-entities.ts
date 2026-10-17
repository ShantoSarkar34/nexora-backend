import "dotenv/config";
import prisma from "../src/config/prismaClient";
import { NotificationEntityType, Prisma } from "../generated/prisma";

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

interface Resolved {
  entityType: NotificationEntityType;
  entityId: string;
  meta?: Record<string, string>;
}

interface PendingNotification {
  id: string;
  type: string;
  link: string | null;
  userId: string;
  createdAt: Date;
}

const resolveNotification = async (
  n: PendingNotification,
): Promise<Resolved | null> => {
  const linkId = n.link?.match(UUID_PATTERN)?.[0];
  if (!linkId) return null;

  switch (n.type) {
    case "NEW_APPLICATION": {
      const candidates = await prisma.application.findMany({
        where: {
          jobId: linkId,
          createdAt: {
            gte: new Date(n.createdAt.getTime() - 60_000),
            lte: new Date(n.createdAt.getTime() + 5_000),
          },
        },
        select: { id: true, createdAt: true },
      });
      const distance = (date: Date) =>
        Math.abs(date.getTime() - n.createdAt.getTime());
      const closest = candidates.sort(
        (a, b) => distance(a.createdAt) - distance(b.createdAt),
      )[0];

      if (closest)
        return {
          entityType: "APPLICATION",
          entityId: closest.id,
          meta: { jobId: linkId },
        };
      // No match: point at the job so the UI can still navigate somewhere useful.
      return { entityType: "JOB", entityId: linkId };
    }

    case "APPLICATION_SHORTLISTED":
    case "APPLICATION_REJECTED": {
      const application = await prisma.application.findUnique({
        where: { id: linkId },
        select: { jobId: true },
      });
      return {
        entityType: "APPLICATION",
        entityId: linkId,
        ...(application && { meta: { jobId: application.jobId } }),
      };
    }

    case "PAYMENT_SUCCESSFUL": {
      const [payment, contract] = await Promise.all([
        prisma.payment.findFirst({
          where: { contractId: linkId, status: "SUCCESS" },
          select: { id: true },
        }),
        prisma.contract.findUnique({
          where: { id: linkId },
          select: { jobId: true },
        }),
      ]);
      if (payment) {
        return {
          entityType: "PAYMENT",
          entityId: payment.id,
          meta: {
            contractId: linkId,
            ...(contract && { jobId: contract.jobId }),
          },
        };
      }
      return {
        entityType: "CONTRACT",
        entityId: linkId,
        ...(contract && { meta: { jobId: contract.jobId } }),
      };
    }

    case "NEW_REVIEW": {
      const review = await prisma.review.findFirst({
        where: { contractId: linkId, revieweeId: n.userId },
        select: { id: true },
      });
      if (review)
        return {
          entityType: "REVIEW",
          entityId: review.id,
          meta: { contractId: linkId },
        };
      return { entityType: "CONTRACT", entityId: linkId };
    }

    default: {
      // FREELANCER_HIRED, CONTRACT_ACTIVATED, WORK_SUBMITTED, CONTRACT_COMPLETED
      const contract = await prisma.contract.findUnique({
        where: { id: linkId },
        select: { jobId: true },
      });
      return {
        entityType: "CONTRACT",
        entityId: linkId,
        ...(contract && { meta: { jobId: contract.jobId } }),
      };
    }
  }
};

const run = async () => {
  const pending = await prisma.notification.findMany({
    where: { entityType: null },
    select: { id: true, type: true, link: true, userId: true, createdAt: true },
  });

  let updated = 0;
  let unresolved = 0;

  for (const notification of pending) {
    const resolved = await resolveNotification(notification);
    if (!resolved) {
      unresolved++;
      continue;
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        entityType: resolved.entityType,
        entityId: resolved.entityId,
        ...(resolved.meta && { meta: resolved.meta as Prisma.InputJsonValue }),
      },
    });
    updated++;
  }

  console.log(
    `Backfill done. updated=${updated} unresolved=${unresolved} (of ${pending.length} rows without an entity)`,
  );
};

run()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
