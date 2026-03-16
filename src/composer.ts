import { createMimeMessage } from 'mimetext';
import { SendEmailOptions } from './types.js';

export class EmailComposer {
  composeMime(options: SendEmailOptions, fromAddress: string): string {
    const msg = createMimeMessage();

    msg.setSender(fromAddress);
    
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    recipients.forEach(r => msg.setRecipient(r));
    
    msg.setSubject(options.subject);

    if (options.text) {
      msg.addMessage({
        contentType: 'text/plain',
        data: options.text
      });
    }

    if (options.html) {
      msg.addMessage({
        contentType: 'text/html',
        data: options.html
      });
    }

    if (options.attachments) {
      options.attachments.forEach(a => {
        msg.addAttachment({
          filename: a.filename,
          contentType: a.contentType,
          data: Buffer.from(a.content).toString('base64'),
        });
      });
    }

    return msg.asRaw();
  }
}
