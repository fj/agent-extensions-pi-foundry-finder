export interface Deployment {
  id: string;
  model: string;
  status: string;
}

const DEPLOYMENTS_API_VERSION = "2022-12-01";
const DEFAULT_TIMEOUT_MS = 10_000;

export interface FetchOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

/** Lists the resource's ready deployments, authenticating with the resource API key. */
export async function fetchDeployments(
  endpoint: string,
  apiKey: string,
  { fetch = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOptions = {},
): Promise<Deployment[]> {
  const url = `${endpoint}/openai/deployments?api-version=${DEPLOYMENTS_API_VERSION}`;
  const response = await fetch(url, {
    headers: { "api-key": apiKey },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  const { data } = (await response.json()) as { data: Deployment[] };
  return data.filter((deployment) => deployment.status === "succeeded");
}
