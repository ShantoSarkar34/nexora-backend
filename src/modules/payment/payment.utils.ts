export const calculateFeeSplit = (grossAmount: number, feePercent: number) => {
  const grossCents = Math.round(grossAmount * 100);
  const feeCents = Math.round((grossCents * feePercent) / 100);

  return {
    feeAmount: feeCents / 100,
    netAmount: (grossCents - feeCents) / 100,
  };
};
