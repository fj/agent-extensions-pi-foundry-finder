import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { parseConfig, resolveSecret, type ResourceConfig } from "../src/config.ts";
import { fetchDeployments } from "../src/discovery.ts";
import { toModelConfig, type CatalogLookup } from "../src/models.ts";

const CONFIG_FILE = "foundry-finder.json";
const LOG_PREFIX = "foundry-finder";

const lookupCatalog: CatalogLookup = (catalog) => getBuiltinModels(catalog) as any[];

async function registerResource(pi: ExtensionAPI, resource: ResourceConfig) {
  const apiKey = resolveSecret(resource.apiKey);
  if (!apiKey) {
    console.error(`${LOG_PREFIX}: ${resource.provider}: API key is not set; skipping`);
    return;
  }

  let deployments;
  try {
    deployments = await fetchDeployments(resource.endpoint, apiKey);
  } catch (error) {
    console.error(`${LOG_PREFIX}: ${resource.provider}: discovery failed: ${error}`);
    return;
  }

  const models = [];
  for (const deployment of deployments) {
    const model = toModelConfig(deployment, resource.endpoint, resource.name, lookupCatalog);
    if (model) models.push(model);
    else console.error(`${LOG_PREFIX}: ${resource.provider}: no catalog metadata for ${deployment.id}; skipping`);
  }

  pi.registerProvider(resource.provider, {
    name: resource.name,
    baseUrl: resource.endpoint,
    apiKey: resource.apiKey,
    models,
  });
}

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

  await Promise.all(resources.map((resource) => registerResource(pi, resource)));
}
