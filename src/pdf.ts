import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatHours, formatUsd, type Charge } from "./amount.js";
import type { Profile } from "./config.js";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const RIGHT = PAGE_WIDTH - MARGIN;

const ink = rgb(0.12, 0.12, 0.12);
const muted = rgb(0.38, 0.38, 0.38);
const rule = rgb(0.82, 0.82, 0.82);
const headerFill = rgb(0.94, 0.94, 0.94);

export type InvoicePdfInput = {
  invoiceNumber: string;
  issuedOn: Date;
  profile: Profile;
  charge: Charge;
};

export function invoicePdfFilename(invoiceNumber: string, projectName: string): string {
  const slug = projectName
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${invoiceNumber}-${slug || "project"}.pdf`;
}

export async function renderInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${input.invoiceNumber}`);
  pdf.setAuthor(input.profile.contractor.name);
  pdf.setSubject(input.profile.name);
  pdf.setCreationDate(input.issuedOn);

  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const leftBottom = drawPartyBlock(page, {
    name: input.profile.contractor.name,
    address: input.profile.contractor.address,
    top: PAGE_HEIGHT - MARGIN,
    regular,
    bold,
  });
  const rightBottom = drawInvoiceMeta(page, input, bold, regular);
  let y = Math.min(leftBottom, rightBottom) - 18;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: RIGHT, y },
    thickness: 1,
    color: rule,
  });
  y -= 28;

  y = drawLabeledBlock(page, {
    label: "Bill to",
    name: input.profile.client.name,
    address: input.profile.client.address,
    y,
    regular,
    bold,
  });
  y -= 22;

  drawChargeTable(page, {
    y,
    charge: input.charge,
    regular,
    bold,
  });

  return pdf.save();
}

function drawPartyBlock(
  page: PDFPage,
  input: {
    name: string;
    address: string;
    top: number;
    regular: PDFFont;
    bold: PDFFont;
  },
): number {
  let y = input.top - 16;
  page.drawText(input.name, {
    x: MARGIN,
    y,
    size: 16,
    font: input.bold,
    color: ink,
  });
  y -= 18;
  return drawWrapped(page, input.address, MARGIN, y, 280, 10, input.regular, muted, 14);
}

function drawInvoiceMeta(
  page: PDFPage,
  input: InvoicePdfInput,
  bold: PDFFont,
  regular: PDFFont,
): number {
  let y = PAGE_HEIGHT - MARGIN - 16;
  drawRight(page, "INVOICE", RIGHT, y, 18, bold, ink);
  y -= 20;
  drawRight(page, input.invoiceNumber, RIGHT, y, 11, regular, ink);
  y -= 16;
  drawRight(page, formatIssuedOn(input.issuedOn), RIGHT, y, 11, regular, muted);
  return y;
}

function drawLabeledBlock(
  page: PDFPage,
  input: {
    label: string;
    name: string;
    address?: string;
    y: number;
    regular: PDFFont;
    bold: PDFFont;
  },
): number {
  let y = input.y;
  page.drawText(input.label.toUpperCase(), {
    x: MARGIN,
    y,
    size: 9,
    font: input.bold,
    color: muted,
  });
  y -= 16;
  page.drawText(input.name, {
    x: MARGIN,
    y,
    size: 12,
    font: input.bold,
    color: ink,
  });
  y -= 16;
  if (!input.address) return y;
  return drawWrapped(page, input.address, MARGIN, y, 320, 10, input.regular, ink, 14);
}

function drawChargeTable(
  page: PDFPage,
  input: {
    y: number;
    charge: Charge;
    regular: PDFFont;
    bold: PDFFont;
  },
): void {
  const descriptionWidth = input.charge.mode === "hours" ? 250 : 380;
  const headerY = input.y;
  page.drawRectangle({
    x: MARGIN,
    y: headerY - 6,
    width: RIGHT - MARGIN,
    height: 20,
    color: headerFill,
  });

  page.drawText("Description", {
    x: MARGIN + 6,
    y: headerY,
    size: 9,
    font: input.bold,
    color: muted,
  });

  if (input.charge.mode === "hours") {
    drawRight(page, "Hours", 400, headerY, 9, input.bold, muted);
    drawRight(page, "Rate", 480, headerY, 9, input.bold, muted);
  }
  drawRight(page, "Amount", RIGHT - 6, headerY, 9, input.bold, muted);

  const rowTop = headerY - 24;
  const descriptionLines = wrapLine("Labor", input.regular, 11, descriptionWidth);
  descriptionLines.forEach((line, index) => {
    page.drawText(line, {
      x: MARGIN + 6,
      y: rowTop - index * 14,
      size: 11,
      font: input.regular,
      color: ink,
    });
  });

  if (input.charge.mode === "hours") {
    drawRight(page, formatHours(input.charge.hours), 400, rowTop, 11, input.regular, ink);
    drawRight(page, formatUsd(input.charge.hourlyRate), 480, rowTop, 11, input.regular, ink);
  }
  drawRight(page, formatUsd(input.charge.amount), RIGHT - 6, rowTop, 11, input.regular, ink);

  const rowBottom = rowTop - Math.max(descriptionLines.length, 1) * 14 - 8;
  page.drawLine({
    start: { x: MARGIN, y: rowBottom },
    end: { x: RIGHT, y: rowBottom },
    thickness: 1,
    color: rule,
  });

  const totalY = rowBottom - 22;
  drawRight(page, "Total", RIGHT - 90, totalY, 12, input.bold, ink);
  drawRight(page, formatUsd(input.charge.amount), RIGHT - 6, totalY, 12, input.bold, ink);
}

function drawRight(
  page: PDFPage,
  text: string,
  rightEdge: number,
  y: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
): void {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightEdge - width, y, size, font, color });
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
  lineHeight: number,
): number {
  let cursor = y;
  for (const paragraph of text.split(/\r?\n/)) {
    for (const line of wrapLine(paragraph, font, size, maxWidth)) {
      page.drawText(line, { x, y: cursor, size, font, color });
      cursor -= lineHeight;
    }
  }
  return cursor;
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
}

function formatIssuedOn(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
