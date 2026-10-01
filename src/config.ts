import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";

const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required"),
  address: z.string().trim().min(1, "Client address cannot be empty").optional(),
});

const contractorSchema = z.object({
  name: z.string().trim().min(1, "Contractor name is required"),
  address: z.string().trim().min(1, "Contractor address is required"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required"),
  hourlyRate: z.number().positive("Hourly rate must be a positive number").finite(),
  client: clientSchema,
  contractor: contractorSchema,
});

export const configSchema = z
  .object({
    profiles: z.array(profileSchema),
  })
  .superRefine((config, ctx) => {
    const seen = new Set<string>();
    config.profiles.forEach((profile, index) => {
      if (seen.has(profile.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["profiles", index, "name"],
          message: `Duplicate profile name "${profile.name}"`,
        });
        return;
      }
      seen.add(profile.name);
    });
  });

export type Profile = z.infer<typeof profileSchema>;
export type Config = z.infer<typeof configSchema>;

export function parseConfig(input: unknown): Config {
  const result = configSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid config.json:\n${details}`);
  }
  return result.data;
}

export function loadConfig(filePath: string): Config {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    if (isMissingFile(error)) {
      throw new Error(`Missing ${filePath}. Run invoice onboard to create it.`);
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`Could not parse ${filePath} as JSON.`);
  }

  return parseConfig(parsed);
}

export function loadConfigOrEmpty(filePath: string): Config {
  if (!existsSync(filePath)) return { profiles: [] };
  return loadConfig(filePath);
}

export function saveConfig(filePath: string, config: Config): void {
  const validated = parseConfig(config);
  writeFileSync(filePath, `${JSON.stringify(validated, null, 2)}\n`);
}

export function findProfile(config: Config, name: string): Profile {
  const profile = config.profiles.find((candidate) => candidate.name === name);
  if (!profile) {
    const available = config.profiles.map((candidate) => candidate.name).join(", ") || "(none)";
    throw new Error(`Unknown profile "${name}". Available profiles: ${available}`);
  }
  return profile;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
