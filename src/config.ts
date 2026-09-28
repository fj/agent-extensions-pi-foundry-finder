import { execSync } from "node:child_process";

export interface ResourceConfig {
  provider: string;
  name: string;
  endpoint: string;
  apiKey: string;
}

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const ENV_REFERENCE_PATTERN = /\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;

export function parseConfig(text: string): ResourceConfig[] {
  const { resources } = JSON.parse(text);
  if (!Array.isArray(resources)) throw new Error("`resources` must be an array");
  return resources.map(parseResource);
}

function parseResource(raw: any, index: number): ResourceConfig {
  const where = `resources[${index}]`;
  if (typeof raw?.provider !== "string" || !PROVIDER_ID_PATTERN.test(raw.provider)) {
    throw new Error(`${where}.provider must match ${PROVIDER_ID_PATTERN}`);
  }
  if (typeof raw.endpoint !== "string" || !raw.endpoint.startsWith("https://")) {
    throw new Error(`${where}.endpoint must be an https:// URL`);
  }
  if (typeof raw.apiKey !== "string" || raw.apiKey === "") {
    throw new Error(`${where}.apiKey must be a non-empty string`);
  }
  return {
    provider: raw.provider,
    name: typeof raw.name === "string" ? raw.name : raw.provider,
    endpoint: raw.endpoint.replace(/\/+$/, ""),
    apiKey: raw.apiKey,
  };
}

export type CommandRunner = (command: string) => string;

const runShell: CommandRunner = (command) => execSync(command, { encoding: "utf8" });

/** Resolves an API key value the way pi does: `!command`, `$VAR` / `${VAR}` interpolation, or a literal. */
export function resolveSecret(
  value: string,
  env: Record<string, string | undefined> = process.env,
  run: CommandRunner = runShell,
): string | undefined {
  if (value.startsWith("!")) return run(value.slice(1)).trim() || undefined;

  let missing = false;
  const resolved = value.replace(ENV_REFERENCE_PATTERN, (match, braced, bare) => {
    if (match === "$$") return "$";
    const found = env[braced ?? bare];
    if (found === undefined || found === "") missing = true;
    return found ?? "";
  });
  return missing || resolved === "" ? undefined : resolved;
}
