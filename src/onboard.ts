import {
  loadConfigOrEmpty,
  profileSchema,
  saveConfig,
  type Config,
  type Profile,
} from "./config.js";

export const RESERVED_PROFILE_NAMES = new Set(["onboard", "help"]);

export type Prompter = (prompt: string) => Promise<string>;

export function parseHourlyRate(raw: string): number {
  const parsed = profileSchema.shape.hourlyRate.safeParse(Number(raw.trim()));
  if (!parsed.success) {
    throw new Error("Hourly rate must be a positive number.");
  }
  return parsed.data;
}

export function parseProfileName(raw: string): string {
  const name = raw.trim();
  if (!name) {
    throw new Error("Profile name is required.");
  }
  if (RESERVED_PROFILE_NAMES.has(name)) {
    throw new Error(`"${name}" is reserved. Choose another profile name.`);
  }
  return name;
}

export async function runOnboarding(options: {
  configPath: string;
  ask: Prompter;
  log?: (message: string) => void;
}): Promise<void> {
  const log = options.log ?? console.log;
  log("Enter the profile for a project you invoice.");

  const existing = loadConfigOrEmpty(options.configPath);
  const drafted: Profile[] = [];
  const replaced = new Map<string, Profile>();

  for (;;) {
    const profile = await promptProfile(options.ask, log, drafted, replaced);
    const alreadySaved = existing.profiles.some((candidate) => candidate.name === profile.name);
    if (alreadySaved) {
      const replace = await askYesNo(
        options.ask,
        `Replace existing profile "${profile.name}"? (y/N): `,
      );
      if (!replace) {
        log("Choose a different profile name.");
        continue;
      }
      replaced.set(profile.name, profile);
    } else {
      drafted.push(profile);
    }

    const another = await askYesNo(options.ask, "Add another profile? (y/N): ");
    if (!another) break;
  }

  const profiles = [
    ...existing.profiles.map((profile) => replaced.get(profile.name) ?? profile),
    ...drafted,
  ];
  const config: Config = { profiles };
  saveConfig(options.configPath, config);
  const count = profiles.length;
  log(`Saved ${count} ${count === 1 ? "profile" : "profiles"} to ${options.configPath}`);
  const sample = profiles[0];
  if (sample) {
    log(`Create an invoice with: invoice ${sample.name} <hours>`);
  }
}

async function promptProfile(
  ask: Prompter,
  log: (message: string) => void,
  drafted: Profile[],
  replaced: Map<string, Profile>,
): Promise<Profile> {
  const draftedNames = new Set([
    ...drafted.map((profile) => profile.name),
    ...replaced.keys(),
  ]);

  const name = await askUntil(ask, log, "Profile name: ", (raw) => {
    const profileName = parseProfileName(raw);
    if (draftedNames.has(profileName)) {
      throw new Error(`Profile "${profileName}" was already entered.`);
    }
    return profileName;
  });
  const hourlyRate = await askUntil(ask, log, "Hourly rate (USD): ", parseHourlyRate);
  const clientName = await askUntil(ask, log, "Client name: ", (raw) => {
    const parsed = profileSchema.shape.client.shape.name.safeParse(raw);
    if (!parsed.success) throw new Error("Client name is required.");
    return parsed.data;
  });
  const clientAddress = await askAddress(ask, log, "Client address (optional): ", false);
  const contractorName = await askUntil(ask, log, "Contractor name: ", (raw) => {
    const parsed = profileSchema.shape.contractor.shape.name.safeParse(raw);
    if (!parsed.success) throw new Error("Contractor name is required.");
    return parsed.data;
  });
  const contractorAddress = await askAddress(ask, log, "Contractor address: ", true);

  const profile: Profile = {
    name,
    hourlyRate,
    client: clientAddress ? { name: clientName, address: clientAddress } : { name: clientName },
    contractor: { name: contractorName, address: contractorAddress },
  };
  return profileSchema.parse(profile);
}

async function askAddress(
  ask: Prompter,
  log: (message: string) => void,
  firstPrompt: string,
  required: true,
): Promise<string>;
async function askAddress(
  ask: Prompter,
  log: (message: string) => void,
  firstPrompt: string,
  required: false,
): Promise<string | undefined>;
async function askAddress(
  ask: Prompter,
  log: (message: string) => void,
  firstPrompt: string,
  required: boolean,
): Promise<string | undefined> {
  for (;;) {
    const first = (await ask(firstPrompt)).trim();
    if (!first) {
      if (!required) return undefined;
      log("Contractor address is required.");
      continue;
    }

    const lines = [first];
    for (;;) {
      const next = (await ask("Another address line (blank to finish): ")).trim();
      if (!next) break;
      lines.push(next);
    }
    return lines.join("\n");
  }
}

async function askYesNo(ask: Prompter, prompt: string): Promise<boolean> {
  const answer = (await ask(prompt)).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

async function askUntil<T>(
  ask: Prompter,
  log: (message: string) => void,
  prompt: string,
  parse: (raw: string) => T,
): Promise<T> {
  for (;;) {
    try {
      return parse(await ask(prompt));
    } catch (error) {
      log(error instanceof Error ? error.message : String(error));
    }
  }
}
