# nostr-mail-js

A JavaScript library for Nostr-based email.

## Features

- **Send Emails**: Send to Nostr users (`npub`) or legacy email addresses (via bridge).
- **Receive Emails**: Real-time listening for incoming emails or full inbox listing.
- **Large Attachments**: Automatically handles emails > 60KB using **Blossom** storage (encrypted with AES-GCM).
- **Labels & Folders**: Organize emails using NIP-32 labels (Inbox, Trash, Starred, etc.).
- **Cross-Platform**: Works in Node.js and the browser.

## Installation

```bash
npm install nostr-mail
```

## Usage

### Initialize Client

```javascript
import { NostrMailClient } from 'nostr-mail-js';
import { generateSecretKey } from 'nostr-tools/pure';

const secretKey = generateSecretKey();

const client = new NostrMailClient(secretKey);
```

### Send an Email

By default, `sendEmail` sends a copy to yourself so it appears in your "Sent" or "Inbox" view.

```javascript
await client.sendEmail({
  to: 'npub1...', // or 'bob@example.com'
  subject: 'Hello from Nostr',
  text: 'Hey! This is a private email sent over Nostr.',
  html: '<b>Hey!</b> This is a private email sent over Nostr.',
  selfCopy: true // Optional, defaults to true
});
```

### Receive & List Emails

```javascript
// Real-time listener
const stop = client.onEmail((email) => {
  console.log('New email:', email.subject);
});

// Full inbox listing (NIP-09 filtered)
const emails = await client.listEmails();
emails.forEach(email => {
  console.log(`${email.folder}: ${email.subject}`);
});
```

### Manage Labels & Folders

Labels are used to track the state (read/unread) and organization (folders).

```javascript
// Mark as read
await client.addLabel(email.id, 'state:read');

// Move to "done" folder
await client.addLabel(email.id, 'folder:done');

// Star an email
await client.addLabel(email.id, 'flag:starred');
```

### Delete an Email

Deletes the email from relays, removes all associated labels, and cleans up Blossom storage.

```javascript
await client.deleteEmail(email, 'Reason for deletion');
```
