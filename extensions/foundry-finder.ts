import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { parseConfig, type ResourceConfig } from "../src/config.ts";
import type { CatalogLookup } from "../src/models.ts";
import { LOG_PREFIX, registerResource } from "../src/register.ts";

const CONFIG_FILE = "foundry-finder.json";

const lookup: CatalogLookup = (catalog) => getBuiltinModels(catalog) as any[];

export default async function (pi: ExtensionAPI) {
  const configPath = join(getAgentDir(), CONFIG_FILE);
  if (!existsSync(configPath)) return;

  let resources: ResourceConfig[];
  try {
    resources = parseConfig(readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error(`${LOG_PREFIX}: invalid ${configPath}: ${error}`);
    return;
  }

  const registerProvider = pi.registerProvider.bind(pi);
  await Promise.all(resources.map((resource) => registerResource(resource, { registerProvider, lookup })));
}
