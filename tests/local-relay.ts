import { createMockRelay, type MockRelay } from 'nostr-mock-relay';

export type LocalRelay = {
  relay: MockRelay;
  url: string;
  relays: string[];
  stop: () => Promise<void>;
};

export async function startLocalRelay(): Promise<LocalRelay> {
  const relay = createMockRelay();
  await relay.start();

  if (!relay.url) {
    throw new Error('Mock relay did not expose a URL after start()');
  }

  return {
    relay,
    url: relay.url,
    relays: [relay.url],
    stop: () => relay.stop(),
  };
}
