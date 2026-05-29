# pkg/waveai — AI Provider Backends

**Parent:** `../AGENTS.md`

## OVERVIEW

AI/LLM provider implementations. Multi-backend support for chat, streaming, completions.

## STRUCTURE

```
waveai/
├── waveai.go              # Main interface, router
├── openaibackend.go       # OpenAI-compatible APIs
├── anthropicbackend.go    # Claude/Anthropic
├── googlebackend.go       # Gemini
├── perplexitybackend.go   # Perplexity
└── cloudbackend.go        # Wave Cloud
```

## PATTERN

Each backend implements:

- `StreamCompletion()` — streaming responses
- `MakeCompletionRequest()` — request builder
- Provider-specific auth/config

## ADDING PROVIDER

1. Create `newproviderbackend.go`
2. Implement backend interface
3. Register in `waveai.go` router
4. Add config in `pkg/wconfig/`

## RPC INTERFACE

Frontend calls via:

- `StreamWaveAiCommand` — streaming
- `GetWaveAIChatCommand` — get chat state
