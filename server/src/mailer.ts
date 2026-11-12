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

type Setting = string | undefined | (() => string | undefined);

/**
 * SMTP when SMTP_URL is set, otherwise the console. Pass getters to follow settings changed in
 * Admin -> Settings -> Integrations without a restart.
 */
export function createMailer(smtpUrl: Setting, from: Setting): Mailer {
  const read = (s: Setting) => (typeof s === "function" ? s() : s);
  let sig: string | null = null;
  let inner: Mailer = new ConsoleMailer();
  const current = () => {
    const url = read(smtpUrl);
    const f = read(from) ?? "IFA.ng <no-reply@ifa.ng>";
    const now = `${url ?? ""}\u0000${f}`;
    if (now !== sig) { inner = url ? new SmtpMailer(url, f) : new ConsoleMailer(); sig = now; }
    return inner;
  };
  return {
    // Phone-only accounts carry a placeholder address under the reserved .invalid TLD; never mail it.
    send: async (mail) => { if (!/\.invalid$/i.test(mail.to.trim())) await current().send(mail); },
  };
}
