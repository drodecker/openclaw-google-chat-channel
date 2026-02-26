# google_chat_channel (OpenClaw transport adapter proposal)

This patch scaffold adds a **first-class channel plugin** named `google_chat_channel` that behaves like native channels while remaining a **transport adapter only**.

## Guarantees

- No Google API calls
- No OAuth
- No Google signature verification
- Security is enforced by:
  - trusted source IP allowlist
  - shared secret request header
- Inbound payloads are normalized into OpenClaw canonical message context
- Uses `message.external_id` for idempotency
- Stateless adapter (no custom session storage); persistence only via OpenClaw canonical storage/routing

## File layout

```txt
proposals/google_chat_channel/
  openclaw.plugin.json
  package.json
  index.ts
  src/
    channel.ts
    config.ts
    monitor.ts
    normalize.ts
    renderer.ts
    resolver.ts
    security.ts
    types.ts
```

## Notes

This is a drop-in extension scaffold. It is intentionally transport-focused and leaves all agent behavior untouched.
