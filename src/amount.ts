export type HoursCharge = {
  mode: "hours";
  hours: number;
  hourlyRate: number;
  amount: number;
};

export type ManualCharge = {
  mode: "manual";
  amount: number;
};

export type Charge = HoursCharge | ManualCharge;

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatHours(hours: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(hours);
}

export function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function positiveCents(value: number, label: string): number {
  const amount = roundCents(value);
  if (amount <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return amount;
}

export function resolveCharge(input: {
  hours?: string;
  manual?: string;
  hourlyRate: number;
}): Charge {
  const hoursText = blankToUndefined(input.hours);
  const manualText = blankToUndefined(input.manual);
  const hasHours = hoursText !== undefined;
  const hasManual = manualText !== undefined;

  if (hasHours && hasManual) {
    throw new Error("Pass either hours or --manual, not both.");
  }
  if (manualText !== undefined) {
    return {
      mode: "manual",
      amount: positiveCents(parsePositiveNumber(manualText, "Amount"), "Amount"),
    };
  }
  if (hoursText === undefined) {
    throw new Error("Pass hours worked, or --manual with an amount.");
  }

  const hours = parsePositiveNumber(hoursText, "Hours");
  return {
    mode: "hours",
    hours,
    hourlyRate: input.hourlyRate,
    amount: positiveCents(hours * input.hourlyRate, "Amount"),
  };
}

function blankToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parsePositiveNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }
  return parsed;
}
