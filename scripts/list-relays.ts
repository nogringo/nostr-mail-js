import { NostrMailClient } from '../src/client.js';
import { generateSecretKey } from 'nostr-tools/pure';

async function listRelays(npub: string) {
    // We use a temporary random key since we only want to query public info
    const tempSecretKey = generateSecretKey();
    const client = new NostrMailClient(tempSecretKey);
    
    try {
        console.log(`Searching relays for: ${npub}`);
        console.log('Querying relays...');
        
        const relays = await client.getRecipientRelays(npub);

        console.log('\nList of relays where the email would be sent:');
        relays.sort().forEach(url => console.log(`- ${url}`));

    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

const npub = 'npub1lxktpvp5cnq3wl5ctu2x88e30mc0ahh8v47qvzc5dmneqqjrzlkqpm5xlc';
listRelays(npub);
