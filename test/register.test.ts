import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ResourceConfig } from "../src/config.ts";
import type { Deployment } from "../src/discovery.ts";
import type { Catalog, CatalogModel } from "../src/models.ts";
import { registerResource, type ProviderRegistration, type RegisterDependencies } from "../src/register.ts";

const RESOURCE: ResourceConfig = {
  provider: "acme-foundry",
  name: "Acme",
  endpoint: "https://acme.services.ai.azure.com",
  apiKey: "$ACME_KEY",
};

const CATALOGS: Record<Catalog, CatalogModel[]> = {
  anthropic: [{ id: "claude-opus-5", name: "Claude Opus 5" }],
  "azure-openai-responses": [{ id: "gpt-5.4", name: "GPT-5.4" }],
};

function harness(overrides: Partial<RegisterDependencies> = {}) {
  const registered: [string, ProviderRegistration][] = [];
  const logs: string[] = [];
  const listed: [string, string][] = [];
  const deployments: Deployment[] = [
    { id: "opus", model: "claude-opus-5", status: "succeeded" },
    { id: "llama", model: "llama-4", status: "succeeded" },
  ];
  const dependencies: RegisterDependencies = {
    registerProvider: (id, registration) => registered.push([id, registration]),
    lookup: (catalog) => CATALOGS[catalog],
    listDeployments: async (endpoint, apiKey) => {
      listed.push([endpoint, apiKey]);
      return deployments;
    },
    resolveKey: () => "resolved-secret",
    log: (message) => logs.push(message),
    ...overrides,
  };
  return { dependencies, registered, logs, listed };
}

describe("registerResource", () => {
  it("discovers with the resolved key but registers the unresolved key reference", async () => {
    const { dependencies, registered, listed } = harness();
    await registerResource(RESOURCE, dependencies);
    assert.deepEqual(listed, [[RESOURCE.endpoint, "resolved-secret"]]);
    assert.equal(registered.length, 1);
    const [id, registration] = registered[0];
    assert.equal(id, "acme-foundry");
    assert.equal(registration.apiKey, "$ACME_KEY");
    assert.equal(registration.name, "Acme");
    assert.equal(registration.baseUrl, RESOURCE.endpoint);
  });

  it("registers catalog-backed deployments and logs the ones it skips", async () => {
    const { dependencies, registered, logs } = harness();
    await registerResource(RESOURCE, dependencies);
    assert.deepEqual(registered[0][1].models.map((model) => model.id), ["opus"]);
    assert.deepEqual(logs, ["foundry-finder: acme-foundry: no catalog metadata for llama; skipping"]);
  });

  it("skips the resource without discovery when the key is unresolved", async () => {
    const { dependencies, registered, logs, listed } = harness({ resolveKey: () => undefined });
    await registerResource(RESOURCE, dependencies);
    assert.equal(listed.length, 0);
    assert.equal(registered.length, 0);
    assert.match(logs[0], /API key is not set/);
  });

  it("logs and skips the resource when the key command fails", async () => {
    const { dependencies, registered, logs } = harness({
      resolveKey: () => {
        throw new Error("command exited 1");
      },
    });
    await assert.doesNotReject(registerResource(RESOURCE, dependencies));
    assert.equal(registered.length, 0);
    assert.match(logs[0], /discovery failed: .*command exited 1/);
  });

  it("logs and skips the resource when discovery fails", async () => {
    const { dependencies, registered, logs } = harness({
      listDeployments: async () => {
        throw new Error("401 denied");
      },
    });
    await assert.doesNotReject(registerResource(RESOURCE, dependencies));
    assert.equal(registered.length, 0);
    assert.match(logs[0], /discovery failed: .*401 denied/);
  });
});
