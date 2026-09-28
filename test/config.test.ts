import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseConfig, resolveSecret } from "../src/config.ts";

const resource = {
  provider: "acme-foundry",
  name: "Acme Foundry",
  endpoint: "https://acme.services.ai.azure.com/",
  apiKey: "$ACME_KEY",
};

describe("parseConfig", () => {
  it("normalizes the endpoint and keeps the other fields", () => {
    assert.deepEqual(parseConfig(JSON.stringify({ resources: [resource] })), [
      { ...resource, endpoint: "https://acme.services.ai.azure.com" },
    ]);
  });

  it("defaults the display name to the provider id", () => {
    const { name, ...unnamed } = resource;
    assert.equal(parseConfig(JSON.stringify({ resources: [unnamed] }))[0].name, "acme-foundry");
  });

  it("rejects a missing resources array", () => {
    assert.throws(() => parseConfig("{}"), /resources/);
  });

  it("rejects an invalid provider id", () => {
    const bad = { resources: [{ ...resource, provider: "Acme Foundry" }] };
    assert.throws(() => parseConfig(JSON.stringify(bad)), /resources\[0\]\.provider/);
  });

  it("rejects a non-https endpoint", () => {
    const bad = { resources: [{ ...resource, endpoint: "http://acme" }] };
    assert.throws(() => parseConfig(JSON.stringify(bad)), /resources\[0\]\.endpoint/);
  });

  it("rejects an empty API key", () => {
    const bad = { resources: [{ ...resource, apiKey: "" }] };
    assert.throws(() => parseConfig(JSON.stringify(bad)), /resources\[0\]\.apiKey/);
  });
});

describe("resolveSecret", () => {
  const env = { KEY: "secret", PREFIX: "sk" };
  const noCommands = () => assert.fail("no command expected");

  it("returns literals unchanged", () => {
    assert.equal(resolveSecret("literal", env, noCommands), "literal");
  });

  it("interpolates bare and braced variables", () => {
    assert.equal(resolveSecret("$KEY", env, noCommands), "secret");
    assert.equal(resolveSecret("${PREFIX}_$KEY", env, noCommands), "sk_secret");
  });

  it("treats $$ as a literal dollar sign", () => {
    assert.equal(resolveSecret("$$KEY", env, noCommands), "$KEY");
  });

  it("is unresolved when a referenced variable is missing or empty", () => {
    assert.equal(resolveSecret("$ABSENT", env, noCommands), undefined);
    assert.equal(resolveSecret("$EMPTY", { EMPTY: "" }, noCommands), undefined);
  });

  it("runs ! values as commands and trims their output", () => {
    assert.equal(resolveSecret("!echo hi", env, (command) => `${command} ran\n`), "echo hi ran");
  });

  it("is unresolved when a command prints nothing", () => {
    assert.equal(resolveSecret("!true", env, () => "\n"), undefined);
  });
});
