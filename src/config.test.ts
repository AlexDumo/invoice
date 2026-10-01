import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findProfile, loadConfig, parseConfig, type Profile } from "./config.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    name: "acme-redesign",
    hourlyRate: 150,
    client: { name: "Acme Inc" },
    contractor: { name: "Jane Doe", address: "123 Main St" },
    ...overrides,
  };
}

describe("parseConfig", () => {
  it("accepts a profile without a client address", () => {
    const config = parseConfig({ profiles: [profile()] });
    expect(config.profiles[0]?.client.address).toBeUndefined();
    expect(config.profiles[0]?.contractor.address).toBe("123 Main St");
  });

  it("requires a contractor address", () => {
    expect(() =>
      parseConfig({
        profiles: [profile({ contractor: { name: "Jane Doe", address: "  " } })],
      }),
    ).toThrow(/Contractor address is required/);
  });

  it("rejects duplicate profile names", () => {
    expect(() => parseConfig({ profiles: [profile(), profile()] })).toThrow(
      /Duplicate profile name "acme-redesign"/,
    );
  });

  it("names the available profiles when one is missing", () => {
    const config = parseConfig({ profiles: [profile()] });
    expect(() => findProfile(config, "other")).toThrow(/Available profiles: acme-redesign/);
  });
});

describe("loadConfig", () => {
  it("reads a config file from disk", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "invoice-config-"));
    directories.push(directory);
    const filePath = path.join(directory, "config.json");
    await writeFile(filePath, JSON.stringify({ profiles: [profile()] }));

    expect(loadConfig(filePath).profiles).toHaveLength(1);
  });

  it("explains a missing config file", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "invoice-config-"));
    directories.push(directory);
    expect(() => loadConfig(path.join(directory, "config.json"))).toThrow(/Missing/);
  });
});
