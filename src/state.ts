import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

const stateSchema = z.object({
  nextInvoiceNumber: z.number().int().positive(),
});

export type AppState = z.infer<typeof stateSchema>;

export function formatInvoiceNumber(value: number): string {
  return `INV-${String(value).padStart(4, "0")}`;
}

export function readState(filePath: string): AppState {
  if (!existsSync(filePath)) {
    return { nextInvoiceNumber: 1 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  } catch {
    throw new Error(`Could not parse ${filePath} as JSON.`);
  }

  const result = stateSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid ${filePath}. Expected nextInvoiceNumber.`);
  }
  return result.data;
}

export function writeState(filePath: string, state: AppState): void {
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`);
}

export function allocateInvoiceNumber(filePath: string): string {
  const state = readState(filePath);
  const invoiceNumber = formatInvoiceNumber(state.nextInvoiceNumber);
  writeState(filePath, {
    ...state,
    nextInvoiceNumber: state.nextInvoiceNumber + 1,
  });
  return invoiceNumber;
}
