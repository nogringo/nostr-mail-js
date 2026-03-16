import PostalMime from 'postal-mime';
import { Event } from 'nostr-tools/core';
import { Email, Attachment } from './types.js';

export class EmailParser {
  async parse(event: Event, labels: string[] = [], rawMime?: string, giftWrapId?: string): Promise<Email> {
    if (event.kind !== 1301) {
      throw new Error('Not a Nostr Mail event (kind 1301)');
    }

    const mimeToParse = rawMime || event.content;

    if (!mimeToParse) {
      throw new Error('MIME content is missing (Blossom download might have failed)');
    }

    const parser = new PostalMime();
    const parsed = await parser.parse(mimeToParse);

    const attachments: Attachment[] = (parsed.attachments || []).map(a => ({
      filename: a.filename || 'unnamed',
      contentType: a.mimeType,
      content: typeof a.content === 'string' ? new TextEncoder().encode(a.content).buffer : a.content,
      size: typeof a.content === 'string' ? a.content.length : a.content.byteLength,
      contentId: a.contentId,
    }));

    const isRead = labels.includes('state:read');
    const isStarred = labels.includes('flag:starred');
    
    // Determine folder from labels
    let folder = 'inbox';
    const folderLabel = labels.find(l => l.startsWith('folder:'));
    if (folderLabel) {
      folder = folderLabel.replace('folder:', '');
    }

    return {
      id: event.id,
      giftWrapId,
      from: {
        address: parsed.from?.address || '',
        pubkey: event.pubkey,
      },
      to: (parsed.to || []).map(t => ({ address: t.address || '' })),
      subject: parsed.subject,
      text: parsed.text,
      html: parsed.html,
      date: new Date(event.created_at * 1000),
      attachments,
      labels,
      isRead,
      isStarred,
      folder,
      mime: mimeToParse,
      event,
    };
  }
}
