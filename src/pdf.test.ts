import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { Profile } from "./config.js";
import { invoicePdfFilename, renderInvoicePdf } from "./pdf.js";

const profile: Profile = {
  name: "acme-redesign",
  hourlyRate: 150,
  client: {
    name: "Acme Inc",
    address: "1 Market St\nSan Francisco, CA",
  },
  contractor: {
    name: "Jane Doe",
    address: "123 Main St\nAustin, TX",
  },
};

describe("renderInvoicePdf", () => {
  it("writes a PDF for an hourly invoice", async () => {
    const bytes = await renderInvoicePdf({
      invoiceNumber: "INV-0001",
      issuedOn: new Date("2026-09-30T12:00:00Z"),
      profile,
      charge: { mode: "hours", hours: 12.5, hourlyRate: 150, amount: 1875 },
    });

    expect(Buffer.from(bytes.subarray(0, 5)).toString("utf8")).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(500);
    const text = await visibleText(bytes);
    expect(text).toContain("Labor");
    expect(text).not.toContain("PROJECT");
    expect(text).not.toContain(profile.name);
  });

  it("writes a PDF for a manual amount", async () => {
    const bytes = await renderInvoicePdf({
      invoiceNumber: "INV-0002",
      issuedOn: new Date("2026-09-30T12:00:00Z"),
      profile: {
        ...profile,
        client: { name: "Acme Inc" },
      },
      charge: { mode: "manual", amount: 1800 },
    });

    expect(Buffer.from(bytes.subarray(0, 5)).toString("utf8")).toBe("%PDF-");
  });
});

async function visibleText(bytes: Uint8Array): Promise<string> {
  const saved = Buffer.from(await (await PDFDocument.load(bytes)).save({ useObjectStreams: false }));
  const latin = saved.toString("latin1");
  const match = /stream\r?\n([\s\S]*?)\r?\nendstream/.exec(latin);
  const stream = match?.[1];
  if (!stream) return "";
  const decoded = inflateSync(Buffer.from(stream, "latin1")).toString("latin1");
  return [...decoded.matchAll(/<([0-9A-Fa-f]+)> Tj/g)]
    .map((item) => Buffer.from(item[1] ?? "", "hex").toString("utf8"))
    .join("\n");
}

describe("invoicePdfFilename", () => {
  it("slugs the project name", () => {
    expect(invoicePdfFilename("INV-0001", "acme-redesign")).toBe("INV-0001-acme-redesign.pdf");
    expect(invoicePdfFilename("INV-0001", "Invoice / Q1")).toBe("INV-0001-Invoice-Q1.pdf");
  });
});
