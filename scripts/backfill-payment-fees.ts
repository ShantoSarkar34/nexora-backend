// scripts/backfill-payment-fees.ts  (NEW; run once per database, safe to re-run)
import "dotenv/config";
import prisma from "../src/config/prismaClient";
import { env } from "../src/config/env";
import { calculateFeeSplit } from "../src/modules/payment/payment.utils";

const run = async () => {
  // Rows the migration added the fee columns to (netAmount is still the 0 default).
  // A real payment always has a positive net amount, so this never touches new rows.
  const rows = await prisma.payment.findMany({
    where: { netAmount: 0 },
    select: {
      id: true,
      amount: true,
      status: true,
      paidAt: true,
      updatedAt: true,
    },
  });

  for (const row of rows) {
    const { feeAmount, netAmount } = calculateFeeSplit(
      Number(row.amount),
      env.PLATFORM_FEE_PERCENT,
    );

    await prisma.payment.update({
      where: { id: row.id },
      data: {
        feePercent: env.PLATFORM_FEE_PERCENT,
        feeAmount,
        netAmount,
        // updatedAt is the closest record of when an old payment succeeded.
        ...(row.status === "SUCCESS" &&
          !row.paidAt && { paidAt: row.updatedAt }),
      },
    });
  }

  console.log(
    `Backfill done. updated=${rows.length} payments at ${env.PLATFORM_FEE_PERCENT}%`,
  );
};

run()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
