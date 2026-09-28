import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickTemplate, routeFor, toModelConfig, type Catalog, type CatalogModel } from "../src/models.ts";

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
    { id: "gpt-5.4", name: "GPT-5.4", provider: "azure-openai-responses", compat: { supportsOpenAIGrammarTools: true } },
  ],
};

const lookup = (catalog: Catalog) => CATALOGS[catalog];

describe("routeFor", () => {
  it("sends Claude models to the Anthropic Messages endpoint", () => {
    assert.equal(routeFor("claude-opus-5").api, "anthropic-messages");
  });

  it("sends every other model to the OpenAI Responses endpoint", () => {
    assert.equal(routeFor("gpt-5.4").api, "openai-responses");
    assert.equal(routeFor("claudette-1").api, "openai-responses");
  });
});

describe("pickTemplate", () => {
  it("prefers an exact catalog match", () => {
    assert.deepEqual(pickTemplate(CATALOGS.anthropic, "claude-haiku-4-5"), {
      template: CATALOGS.anthropic[0],
      exact: true,
    });
  });

  it("falls back to the same-family entry with the longest shared prefix", () => {
    const match = pickTemplate(CATALOGS.anthropic, "claude-opus-5-5");
    assert.equal(match?.template.id, "claude-opus-5");
    assert.equal(match?.exact, false);
  });

  it("finds nothing for an unknown family", () => {
    assert.equal(pickTemplate(CATALOGS.anthropic, "llama-4"), undefined);
  });
});

describe("toModelConfig", () => {
  it("registers a known Claude deployment under its deployment name", () => {
    const deployment = { id: "my-opus", model: "claude-opus-5", status: "succeeded" };
    assert.deepEqual(toModelConfig(deployment, ENDPOINT, "Acme", lookup), {
      id: "my-opus",
      name: "Claude Opus 5 (Acme)",
      contextWindow: 1_000_000,
      api: "anthropic-messages",
      baseUrl: `${ENDPOINT}/anthropic`,
      compat: { forceAdaptiveThinking: true },
    });
  });

  it("names a fallback-template deployment after the deployment", () => {
    const deployment = { id: "claude-opus-5-5", model: "claude-opus-5-5", status: "succeeded" };
    const config = toModelConfig(deployment, ENDPOINT, "Acme", lookup);
    assert.equal(config?.name, "claude-opus-5-5 (Acme)");
    assert.equal(config?.contextWindow, 1_000_000);
  });

  it("keeps OpenAI compat flags and targets the v1 endpoint", () => {
    const deployment = { id: "gpt-5.4", model: "gpt-5.4", status: "succeeded" };
    const config = toModelConfig(deployment, ENDPOINT, "Acme", lookup);
    assert.equal(config?.api, "openai-responses");
    assert.equal(config?.baseUrl, `${ENDPOINT}/openai/v1`);
    assert.deepEqual(config?.compat, { supportsOpenAIGrammarTools: true });
  });

  it("skips a deployment with no catalog relative", () => {
    const deployment = { id: "llama", model: "llama-4", status: "succeeded" };
    assert.equal(toModelConfig(deployment, ENDPOINT, "Acme", lookup), undefined);
  });
});
