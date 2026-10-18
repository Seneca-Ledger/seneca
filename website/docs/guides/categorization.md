---
title: AI Categorization
description: Configure an OpenAI-compatible or provider endpoint
---

Lumio can auto-categorize transactions with an AI model. It is optional and configured per workspace.

## Supported providers

- Presets for OpenAI, Anthropic and OpenRouter
- Any OpenAI-compatible backend, such as Ollama, LocalAI or vLLM

## Configuration

Open **Integrations → AI-compatible endpoint** and set:

- Enabled
- Base URL
- Model
- API key, if your endpoint requires one
- Timeout, in milliseconds

Saving validates the endpoint with a chat completion request. The API key is stored encrypted and
never returned to the browser.

### Self-hosted models on a private network

An endpoint entered in the UI must resolve to a public address — the backend refuses private and
loopback hosts there. For Ollama on `localhost` or another private host, set the endpoint on the
backend instead:

```bash
AI_BASE_URL=http://localhost:11434
AI_MODEL=llama3.1
AI_API_KEY=        # optional
```

The env endpoint is used when a workspace has no endpoint of its own.

## Quality controls

- A category is applied only when the model's confidence is at least 0.9; lower-confidence answers
  are dropped.
- Timeouts, concurrency and a circuit breaker are tuned through backend env: `AI_TIMEOUT_MS`,
  `AI_CONCURRENCY` (default 2), `AI_CIRCUIT_FAILURE_THRESHOLD` and `AI_CIRCUIT_COOLDOWN_MS`
  (default 300000).

For categorization without an external model, use **Integrations → Local categorization**.

Next: [Receipt Maps](receipt-maps)
