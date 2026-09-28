import { resolveSecret, type ResourceConfig } from "./config.ts";
import { fetchDeployments, type Deployment } from "./discovery.ts";
import { toModelConfig, type CatalogLookup } from "./models.ts";

export const LOG_PREFIX = "foundry-finder";

export interface ProviderRegistration {
  name: string;
  baseUrl: string;
  apiKey: string;
  models: NonNullable<ReturnType<typeof toModelConfig>>[];
}

export interface RegisterDependencies {
  registerProvider: (id: string, registration: ProviderRegistration) => void;
  lookup: CatalogLookup;
  listDeployments?: (endpoint: string, apiKey: string) => Promise<Deployment[]>;
  resolveKey?: (value: string) => string | undefined;
  log?: (message: string) => void;
}

/** Discovers one resource's deployments and registers them as a provider; logs and skips the resource on failure. */
export async function registerResource(
  resource: ResourceConfig,
  {
    registerProvider,
    lookup,
    listDeployments = fetchDeployments,
    resolveKey = resolveSecret,
    log = console.error,
  }: RegisterDependencies,
): Promise<void> {
  const warn = (message: string) => log(`${LOG_PREFIX}: ${resource.provider}: ${message}`);

  let deployments: Deployment[];
  try {
    const apiKey = resolveKey(resource.apiKey);
    if (!apiKey) {
      warn("API key is not set; skipping");
      return;
    }
    deployments = await listDeployments(resource.endpoint, apiKey);
  } catch (error) {
    warn(`discovery failed: ${error}`);
    return;
  }

  const models: ProviderRegistration["models"] = [];
  for (const deployment of deployments) {
    const model = toModelConfig(deployment, resource.endpoint, resource.name, lookup);
    if (model) models.push(model);
    else warn(`no catalog metadata for ${deployment.id}; skipping`);
  }

  registerProvider(resource.provider, {
    name: resource.name,
    baseUrl: resource.endpoint,
    apiKey: resource.apiKey,
    models,
  });
}
