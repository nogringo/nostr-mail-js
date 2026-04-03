export const BOOTSTRAP_RELAYS = [
  'wss://purplepag.es',
  'wss://relay.damus.io',
  'wss://nos.lol'
];

export const DEFAULT_RELAYS = [
  'wss://relay.camelus.app',
  'wss://nostr-01.yakihonne.com',
  'wss://relay.damus.io',
  'wss://nostr-01.uid.ovh',
  'wss://nostr-02.uid.ovh',
  'wss://relay.primal.net'
];

export const DEFAULT_DM_RELAYS = [
  'wss://auth.nostr1.com',
  'wss://nostr-01.uid.ovh',
  'wss://nostr-02.uid.ovh',
];

export const DEFAULT_BLOSSOM_SERVERS = [
  'https://blossom.yakihonne.com',
  'https://blossom-01.uid.ovh',
  'https://blossom-02.uid.ovh',
  'https://blossom.primal.net',
];

/**
 * Maximum size of the JSON-encoded email event (rumor) before switching to Blossom storage.
 * NIP-44 (used in Gift Wraps) has a limit of 65535 bytes for the plaintext.
 * We use 32KB to allow for NIP-59 double wrapping overhead and JSON escaping.
 */
export const BLOSSOM_THRESHOLD = 32768;
