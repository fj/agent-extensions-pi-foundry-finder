# pi-foundry-finder

A [pi](https://pi.dev) extension that finds the model deployments on your Azure AI Foundry resources when pi starts, and registers them as pi models.

You do not list models by hand. When you deploy or remove a model in Foundry, the next pi session shows the change.

## Install

    pi install git:github.com/fj/agent-extensions-pi-foundry-finder

## Configure

Create `foundry-finder.json` in pi's agent directory (usually `~/.pi/agent/`). Add one entry for each Foundry resource:

```json
{
  "resources": [
    {
      "provider": "acme-azure-foundry",
      "name": "Acme Azure Foundry",
      "endpoint": "https://acme-resource.services.ai.azure.com",
      "apiKey": "$ACME_FOUNDRY_API_KEY"
    }
  ]
}
```

| Field | Required | Meaning |
|-------|----------|---------|
| `provider` | yes | The pi provider id. Use lowercase letters, digits, and hyphens. |
| `name` | no | The display name. The default is `provider`. |
| `endpoint` | yes | The resource endpoint (`https://<resource>.services.ai.azure.com`). |
| `apiKey` | yes | The resource API key. Use `$VAR` or `${VAR}` for an environment variable, `!command` for command output, or a literal value. |

Each resource becomes its own pi provider, because each resource has its own key and endpoint. Select a model with:

    pi --provider acme-azure-foundry --model <deployment-name>

## How it works

1. The extension lists the resource's deployments at `/openai/deployments` with the API key. It keeps only the deployments that are ready.
2. It sends `claude-*` models to the Foundry Anthropic Messages endpoint (`/anthropic`). It sends all other models to the OpenAI Responses endpoint (`/openai/v1`).
3. It copies the context window, output limit, cost, and thinking settings from pi's built-in model catalog. If the catalog does not have the model, it uses the same-family model with the longest shared id prefix. For example, `claude-opus-5-5` uses `claude-opus-5`.
4. It removes the Anthropic compatibility flags that Foundry does not accept: strict tool schemas and mid-conversation effort.

The extension skips a deployment that has no same-family model in the catalog. It writes a message to stderr.

If a key is not set or discovery fails, the extension writes a message to stderr and skips that resource. Pi still starts.

## Limitations

- Only Claude models and OpenAI models are supported. Other Foundry models (for example Llama or Mistral) are skipped.
- Discovery happens once, at startup. Restart pi to see new deployments.

## Develop

    npm test

The tests use Node's built-in test runner and type stripping (Node 22.18 or later). They need no dependencies.
