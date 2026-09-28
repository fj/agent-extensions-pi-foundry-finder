import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchDeployments } from "../src/discovery.ts";

const ENDPOINT = "https://acme.services.ai.azure.com";

function fakeFetch(status: number, body: unknown, requests: Request[] = []): typeof fetch {
  return async (input, init) => {
    requests.push(new Request(input, init));
    return new Response(JSON.stringify(body), { status });
  };
}

describe("fetchDeployments", () => {
  it("authenticates with the api-key header against the deployments endpoint", async () => {
    const requests: Request[] = [];
    await fetchDeployments(ENDPOINT, "secret", { fetch: fakeFetch(200, { data: [] }, requests) });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, `${ENDPOINT}/openai/deployments?api-version=2022-12-01`);
    assert.equal(requests[0].headers.get("api-key"), "secret");
  });

  it("returns only succeeded deployments", async () => {
    const data = [
      { id: "ready", model: "gpt-5.4", status: "succeeded" },
      { id: "pending", model: "gpt-5.4", status: "running" },
      { id: "broken", model: "gpt-5.4", status: "failed" },
    ];
    const deployments = await fetchDeployments(ENDPOINT, "secret", { fetch: fakeFetch(200, { data }) });
    assert.deepEqual(deployments.map((d) => d.id), ["ready"]);
  });

  it("throws with the status and body on an error response", async () => {
    const fetch = fakeFetch(401, { error: "denied" });
    await assert.rejects(fetchDeployments(ENDPOINT, "wrong", { fetch }), /401 .*denied/);
  });

  it("aborts a request that exceeds the timeout", async () => {
    const hang: typeof globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason)));
    await assert.rejects(fetchDeployments(ENDPOINT, "secret", { fetch: hang, timeoutMs: 1 }), /TimeoutError|timed out/i);
  });
});
