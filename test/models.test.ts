import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toModelConfig, type Catalog, type CatalogModel } from "../src/models.ts";

const ENDPOINT = "https://acme.services.ai.azure.com";

const CATALOGS: Record<Catalog, CatalogModel[]> = {
  anthropic: [
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "anthropic", contextWindow: 200_000 },
    {
      id: "claude-opus-5",
      name: "Claude Opus 5",
      provider: "anthropic",
      contextWindow: 1_000_000,
      compat: { supportsStrictTools: true, supportsMidConvoEffort: true, forceAdaptiveThinking: true },
    },
  ],
  "azure-openai-responses": [
    { id: "gpt-4", name: "GPT-4", provider: "azure-openai-responses", contextWindow: 8_192 },
    { id: "gpt-5.1", name: "GPT-5.1", provider: "azure-openai-responses", contextWindow: 400_000 },
    { id: "gpt-5.2", name: "GPT-5.2", provider: "azure-openai-responses", contextWindow: 500_000 },
    {
      id: "gpt-5.4",
      name: "GPT-5.4",
      provider: "azure-openai-responses",
      contextWindow: 1_050_000,
      compat: { supportsOpenAIGrammarTools: true },
    },
  ],
};

const lookup = (catalog: Catalog) => CATALOGS[catalog];

function configFor(model: string, id = model) {
  return toModelConfig({ id, model, status: "succeeded" }, ENDPOINT, "Acme", lookup);
}

describe("toModelConfig", () => {
  it("registers a known Claude deployment under its deployment name via the Anthropic endpoint", () => {
    assert.deepEqual(configFor("claude-opus-5", "my-opus"), {
      id: "my-opus",
      name: "Claude Opus 5 (Acme)",
      contextWindow: 1_000_000,
      api: "anthropic-messages",
      baseUrl: `${ENDPOINT}/anthropic`,
      compat: { forceAdaptiveThinking: true },
    });
  });

  it("gives an empty compat to a catalog model that has none", () => {
    const config = configFor("claude-haiku-4-5");
    assert.deepEqual(config?.compat, {});
    assert.equal(config?.contextWindow, 200_000);
  });

  it("keeps OpenAI compat flags and targets the v1 Responses endpoint", () => {
    const config = configFor("gpt-5.4");
    assert.equal(config?.api, "openai-responses");
    assert.equal(config?.baseUrl, `${ENDPOINT}/openai/v1`);
    assert.deepEqual(config?.compat, { supportsOpenAIGrammarTools: true });
  });

  it("routes a non-Claude model that only starts with 'claude' to the OpenAI endpoint", () => {
    assert.equal(toModelConfig({ id: "c", model: "claudette-1", status: "succeeded" }, ENDPOINT, "Acme", () => [
      { id: "claudette-0", name: "Claudette" },
    ])?.api, "openai-responses");
  });

  it("borrows metadata from the same-family model with the longest shared prefix", () => {
    const config = configFor("claude-opus-5-5");
    assert.equal(config?.name, "claude-opus-5-5 (Acme)");
    assert.equal(config?.contextWindow, 1_000_000);
  });

  it("prefers a closer relative over earlier catalog entries", () => {
    assert.equal(configFor("gpt-5.4-mini")?.contextWindow, 1_050_000);
  });

  it("breaks prefix-length ties in favor of the earliest catalog entry", () => {
    assert.equal(configFor("gpt-5.9")?.contextWindow, 400_000);
  });

  it("skips a deployment with no same-family catalog model", () => {
    assert.equal(configFor("llama-4"), undefined);
  });
});
