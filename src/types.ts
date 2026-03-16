import { Event } from 'nostr-tools/core';

export interface Email {
  id: string; // Event ID
  giftWrapId?: string; // The Gift Wrap (kind 1059) ID, used for deletion
  from: {
    address: string;
    pubkey?: string;
  };
  to: {
    address: string;
    pubkey?: string;
  }[];
  subject?: string;
  text?: string;
  html?: string;
  date: Date;
  attachments: Attachment[];
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  folder: string; // 'inbox', 'trash', 'archive', etc.
  event: Event; // The original kind 1301 event (decrypted)
}

export interface Attachment {
  filename: string;
  contentType: string;
  content: ArrayBuffer;
  size: number;
  contentId?: string;
}

export interface SendEmailOptions {
  to: string | string[]; // npub or email address
  subject: string;
  text?: string;
  html?: string;
  attachments?: Attachment[];
  selfCopy?: boolean; // Default to true, send a copy to oneself
  mime?: string; // Optional raw MIME content
}

export enum MailFolder {
  INBOX = 'inbox',
  TRASH = 'folder:trash',
  ARCHIVE = 'folder:archive',
  SPAM = 'folder:spam',
}

export enum MailFlag {
  STARRED = 'flag:starred',
  IMPORTANT = 'flag:important',
}

export enum MailState {
  READ = 'state:read',
}
