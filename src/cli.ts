#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { Command, CommanderError } from "commander";
import { resolveCharge } from "./amount.js";
import { findProfile, loadConfig } from "./config.js";
import { runOnboarding } from "./onboard.js";
import { projectPaths } from "./paths.js";
import { invoicePdfFilename, renderInvoicePdf } from "./pdf.js";
import { allocateInvoiceNumber } from "./state.js";

const paths = projectPaths();

async function createInvoice(
  profileName: string,
  hours: string | undefined,
  manual: string | undefined,
): Promise<void> {
  const preview = resolveCharge({ hours, manual, hourlyRate: 1 });
  const config = loadConfig(paths.config);
  const profile = findProfile(config, profileName);
  const charge =
    preview.mode === "manual"
      ? preview
      : resolveCharge({
          hours,
          manual,
          hourlyRate: profile.hourlyRate,
        });
  const invoiceNumber = allocateInvoiceNumber(paths.state);
  const pdfBytes = await renderInvoicePdf({
    invoiceNumber,
    issuedOn: new Date(),
    profile,
    charge,
  });
  const filename = invoicePdfFilename(invoiceNumber, profile.name);
  const outputPath = path.join(paths.outDir, filename);
  await mkdir(paths.outDir, { recursive: true });
  await writeFile(outputPath, pdfBytes);

  console.log(`Invoice ${invoiceNumber}`);
  console.log(`PDF: ${outputPath}`);
}

async function main(): Promise<void> {
  const program = new Command();
  program.name("invoice").description("Create a PDF invoice from a local profile.");

  program
    .command("onboard")
    .description("Write profile values to config.json")
    .action(async () => {
      const prompts = createInterface({ input, output });
      try {
        await runOnboarding({
          configPath: paths.config,
          ask: (prompt) => prompts.question(prompt),
        });
      } finally {
        prompts.close();
      }
    });

  program
    .argument("<profile>", "Profile name from config.json")
    .argument("[hours]", "Hours worked")
    .option("-m, --manual <amount>", "Charge this amount instead of hours times the profile rate")
    .action(async (profile: string, hours: string | undefined, options: { manual?: string }) => {
      await createInvoice(profile, hours, options.manual);
    });

  program.addHelpText(
    "after",
    `
Examples:
  $ invoice onboard
  $ invoice acme-redesign 12.5
  $ invoice acme-redesign --manual 1800
`,
  );

  program.exitOverride();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode;
      return;
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

await main();
