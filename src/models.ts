import type { Deployment } from "./discovery.ts";

export type Catalog = "anthropic" | "azure-openai-responses";

export interface CatalogModel {
  id: string;
  name: string;
  provider?: string;
  compat?: Record<string, unknown>;
  [field: string]: unknown;
}

export type CatalogLookup = (catalog: Catalog) => CatalogModel[];

interface Route {
  api: "anthropic-messages" | "openai-responses";
  path: string;
  catalog: Catalog;
  unsupportedCompat: readonly string[];
}

// Foundry rejects strict tool schemas and is not a faithful Messages transport for mid-conversation effort.
const ANTHROPIC_ROUTE: Route = {
  api: "anthropic-messages",
  path: "/anthropic",
  catalog: "anthropic",
  unsupportedCompat: ["supportsStrictTools", "supportsMidConvoEffort"],
};

const OPENAI_ROUTE: Route = {
  api: "openai-responses",
  path: "/openai/v1",
  catalog: "azure-openai-responses",
  unsupportedCompat: [],
};

function routeFor(model: string): Route {
  return family(model) === "claude" ? ANTHROPIC_ROUTE : OPENAI_ROUTE;
}

function family(modelId: string): string {
  return modelId.split("-")[0];
}

function commonPrefixLength(a: string, b: string): number {
  let length = 0;
  while (length < a.length && a[length] === b[length]) length++;
  return length;
}

/** Finds the catalog entry for a model, or failing that its closest same-family relative. */
function pickTemplate(
  catalog: CatalogModel[],
  model: string,
): { template: CatalogModel; exact: boolean } | undefined {
  const exact = catalog.find((entry) => entry.id === model);
  if (exact) return { template: exact, exact: true };

  const relatives = catalog.filter((entry) => family(entry.id) === family(model));
  if (relatives.length === 0) return undefined;
  const closest = relatives.reduce((best, entry) =>
    commonPrefixLength(entry.id, model) > commonPrefixLength(best.id, model) ? entry : best,
  );
  return { template: closest, exact: false };
}

export function toModelConfig(
  deployment: Deployment,
  endpoint: string,
  resourceName: string,
  lookup: CatalogLookup,
) {
  const route = routeFor(deployment.model);
  const match = pickTemplate(lookup(route.catalog), deployment.model);
  if (!match) return undefined;

  const { provider, compat = {}, ...metadata } = match.template;
  const supportedCompat = Object.fromEntries(
    Object.entries(compat).filter(([key]) => !route.unsupportedCompat.includes(key)),
  );
  const baseName = match.exact ? match.template.name : deployment.id;
  return {
    ...metadata,
    id: deployment.id,
    name: `${baseName} (${resourceName})`,
    api: route.api,
    baseUrl: `${endpoint}${route.path}`,
    compat: supportedCompat,
  };
}
