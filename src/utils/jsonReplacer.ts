import { Prisma } from "../../generated/prisma";

export function decimalReplacer(
  this: Record<string, unknown>,
  key: string,
  value: unknown,
): unknown {
  const original = this[key];
  return Prisma.Decimal.isDecimal(original) ? original.toNumber() : value;
}
