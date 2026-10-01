import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { allocateInvoiceNumber, formatInvoiceNumber, readState } from "./state.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("invoice numbers", () => {
  it("pads the sequence", () => {
    expect(formatInvoiceNumber(1)).toBe("INV-0001");
    expect(formatInvoiceNumber(42)).toBe("INV-0042");
  });

  it("reserves the next number", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "invoice-state-"));
    directories.push(directory);
    const filePath = path.join(directory, "state.json");

    expect(allocateInvoiceNumber(filePath)).toBe("INV-0001");
    expect(allocateInvoiceNumber(filePath)).toBe("INV-0002");
    expect(readState(filePath)).toEqual({ nextInvoiceNumber: 3 });
  });
});
