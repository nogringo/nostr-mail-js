import { createMockBlossomServer, type MockBlossom } from 'blossom-mock-server';

export type LocalBlossom = {
  server: MockBlossom;
  url: string;
  servers: string[];
  stop: () => Promise<void>;
};

export async function startLocalBlossom(): Promise<LocalBlossom> {
  const server = createMockBlossomServer();
  await server.start();

  if (!server.url) {
    throw new Error('Mock Blossom server did not expose a URL after start()');
  }

  return {
    server,
    url: server.url,
    servers: [server.url],
    stop: () => server.stop(),
  };
}
