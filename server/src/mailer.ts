import nodemailer from "nodemailer";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

/** Development / tests: print instead of sending. */
export class ConsoleMailer implements Mailer {
  readonly sent: Mail[] = [];
  async send(mail: Mail) {
    this.sent.push(mail);
    console.log(`[mail] to=${mail.to} subject=${JSON.stringify(mail.subject)}\n${mail.text}`);
  }
}

/** SMTP, configured by SMTP_URL (smtps://user:pass@host:465). */
export class SmtpMailer implements Mailer {
  private transport;
  constructor(url: string, private from: string) {
    this.transport = nodemailer.createTransport(url);
  }
  async send(mail: Mail) {
    await this.transport.sendMail({ from: this.from, to: mail.to, subject: mail.subject, text: mail.text });
  }
}

export function createMailer(smtpUrl: string | undefined, from: string): Mailer {
  return smtpUrl ? new SmtpMailer(smtpUrl, from) : new ConsoleMailer();
}
