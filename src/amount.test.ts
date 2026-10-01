import { describe, expect, it } from "vitest";
import { formatHours, formatUsd, resolveCharge } from "./amount.js";

describe("resolveCharge", () => {
  it("multiplies hours by the hourly rate and rounds to cents", () => {
    expect(
      resolveCharge({
        hours: "2.5",
        hourlyRate: 80,
      }),
    ).toEqual({
      mode: "hours",
      hours: 2.5,
      hourlyRate: 80,
      amount: 200,
    });
  });

  it("rounds a fractional cent total", () => {
    expect(
      resolveCharge({
        hours: "1",
        hourlyRate: 10.015,
      }).amount,
    ).toBe(10.02);
  });

  it("uses a manual amount and ignores the hourly rate", () => {
    expect(
      resolveCharge({
        manual: "1800.5",
        hourlyRate: 80,
      }),
    ).toEqual({
      mode: "manual",
      amount: 1800.5,
    });
  });

  it("rejects hours together with a manual amount", () => {
    expect(() =>
      resolveCharge({
        hours: "3",
        manual: "100",
        hourlyRate: 80,
      }),
    ).toThrow("Pass either hours or --manual, not both.");
  });

  it("rejects a missing amount", () => {
    expect(() => resolveCharge({ hourlyRate: 80 })).toThrow(
      "Pass hours worked, or --manual with an amount.",
    );
  });

  it("rejects non-positive hours and amounts", () => {
    expect(() => resolveCharge({ hours: "0", hourlyRate: 80 })).toThrow(
      "Hours must be a positive number.",
    );
    expect(() => resolveCharge({ hours: "-2", hourlyRate: 80 })).toThrow(
      "Hours must be a positive number.",
    );
    expect(() => resolveCharge({ hours: "nope", hourlyRate: 80 })).toThrow(
      "Hours must be a positive number.",
    );
    expect(() => resolveCharge({ manual: "0", hourlyRate: 80 })).toThrow(
      "Amount must be a positive number.",
    );
    expect(() => resolveCharge({ manual: "0.001", hourlyRate: 80 })).toThrow(
      "Amount must be a positive number.",
    );
    expect(() => resolveCharge({ hours: "0.004", hourlyRate: 1 })).toThrow(
      "Amount must be a positive number.",
    );
  });
});

describe("money formatting", () => {
  it("formats USD and hours", () => {
    expect(formatUsd(1800)).toBe("$1,800.00");
    expect(formatHours(2.5)).toBe("2.5");
    expect(formatHours(2)).toBe("2");
  });
});
