# TODO

- [ ] **Tests must not depend on public relays or Blossom servers.** The current `tests/e2e*.test.ts` and `tests/self-copy.test.ts` open real WebSocket connections to public Nostr relays and (for Blossom flows) public Blossom servers. They are slow (45-90s per test), flaky (timeouts depending on relay availability), and consume third-party resources. Replace them with an in-process mock relay and a mock Blossom server (HTTP-level fake), so the full suite runs offline and deterministically.
