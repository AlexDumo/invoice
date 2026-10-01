import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { parseHourlyRate, parseProfileName, runOnboarding, type Prompter } from "./onboard.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

function scripted(answers: Record<string, string[]>): Prompter {
  const remaining = Object.fromEntries(
    Object.entries(answers).map(([prompt, values]) => [prompt, [...values]]),
  );
  return async (prompt) => {
    const next = remaining[prompt]?.shift();
    if (next === undefined) {
      throw new Error(`No scripted answer for prompt: ${prompt}`);
    }
    return next;
  };
}

describe("onboarding parsers", () => {
  it("parses rates and profile names", () => {
    expect(parseHourlyRate("150")).toBe(150);
    expect(parseProfileName("acme-redesign")).toBe("acme-redesign");
  });

  it("rejects reserved names and non-positive rates", () => {
    expect(() => parseProfileName("onboard")).toThrow(/reserved/);
    expect(() => parseHourlyRate("0")).toThrow(/positive number/);
  });
});

describe("runOnboarding", () => {
  it("writes a profile", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "invoice-onboard-"));
    directories.push(directory);
    const configPath = path.join(directory, "config.json");

    await runOnboarding({
      configPath,
      log: () => undefined,
      ask: scripted({
        "Profile name: ": ["onboard", "acme-redesign"],
        "Hourly rate (USD): ": ["150"],
        "Client name: ": ["Acme Inc"],
        "Client address (optional): ": [""],
        "Contractor name: ": ["Jane Doe"],
        "Contractor address: ": ["123 Main St"],
        "Another address line (blank to finish): ": ["Austin, TX", ""],
        "Add another profile? (y/N): ": ["n"],
      }),
    });

    expect(loadConfig(configPath)).toEqual({
      profiles: [
        {
          name: "acme-redesign",
          hourlyRate: 150,
          client: { name: "Acme Inc" },
          contractor: { name: "Jane Doe", address: "123 Main St\nAustin, TX" },
        },
      ],
    });
  });

  it("adds a profile and can replace an existing one", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "invoice-onboard-"));
    directories.push(directory);
    const configPath = path.join(directory, "config.json");

    await runOnboarding({
      configPath,
      log: () => undefined,
      ask: scripted({
        "Profile name: ": ["acme-redesign", "beta-site"],
        "Hourly rate (USD): ": ["150", "200"],
        "Client name: ": ["Acme Inc", "Beta Co"],
        "Client address (optional): ": ["1 Market St", ""],
        "Contractor name: ": ["Jane Doe", "Jane Doe"],
        "Contractor address: ": ["123 Main St", "123 Main St"],
        "Another address line (blank to finish): ": ["", "", ""],
        "Add another profile? (y/N): ": ["y", "n"],
      }),
    });

    await runOnboarding({
      configPath,
      log: () => undefined,
      ask: scripted({
        "Profile name: ": ["acme-redesign"],
        "Hourly rate (USD): ": ["175"],
        "Client name: ": ["Acme Inc"],
        "Client address (optional): ": [""],
        "Contractor name: ": ["Jane Doe"],
        "Contractor address: ": ["9 Oak St"],
        "Another address line (blank to finish): ": [""],
        'Replace existing profile "acme-redesign"? (y/N): ': ["y"],
        "Add another profile? (y/N): ": ["n"],
      }),
    });

    const config = loadConfig(configPath);
    expect(config.profiles.map((profile) => profile.name)).toEqual(["acme-redesign", "beta-site"]);
    expect(config.profiles[0]).toMatchObject({
      hourlyRate: 175,
      contractor: { address: "9 Oak St" },
    });
    expect(config.profiles[1]?.hourlyRate).toBe(200);
  });
});
