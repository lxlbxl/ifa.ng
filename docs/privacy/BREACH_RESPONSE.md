# Personal data breach runbook (72 hours)

A breach is any security incident that leads to personal data being lost, destroyed, changed, disclosed or accessed
without authority: a leaked database dump, a lost admin phone that was signed in, a recording link sent to the
wrong person, a provider telling us they were breached, a bug that showed one client another's notes.

**Clock:** the NDPC must be told within **72 hours of IFA.ng becoming aware** (NDPA s.40(2)), unless the breach is
unlikely to put people's rights and freedoms at risk. If people in the UK or EU are affected, the ICO and/or the
relevant EU authority have the same 72 hours (GDPR Art. 33). People must be told **without undue delay** when the
risk to them is high (NDPA s.40(3); GDPR Art. 34). Late notification must explain the delay.

## Hour 0–4: contain and record

1. Whoever spots it tells the DPO and Alex immediately (phone, not just email).
2. **Admin → Privacy & data → Breaches → Record a breach.** The clock starts from this time; correct
   "found" later if you became aware earlier. Fill in what you know; update as you go.
3. Contain: revoke keys (Admin → Settings → Integrations), rotate `AUTH_SECRET`/`DATA_JWT_SECRET` (signs everyone
   out), block the account or IP, take the leaked file down, ask the wrong recipient to delete. Keep evidence
   (logs, screenshots) — don't wipe the server before you have copies.

## Hour 4–48: assess

4. Which data, how many people, which countries (phone country codes), and was **sensitive data** involved
   (consultation notes, recordings, transcripts, Odù, Ebo)? Sensitive data almost always means high risk.
5. Was it encrypted or otherwise unreadable? Is the data recoverable? Could it cause fraud, embarrassment,
   discrimination, threats to safety (religious persecution is a real risk for some users)?
6. Set the risk in the register: **low** (no notification, record why), **medium** (regulators), **high**
   (regulators and people).

## Before hour 72: notify

7. **NDPC** — through the NDPC's breach notification channel (see ndpc.gov.ng; email/portal as currently
   published). Include: what happened and when, categories and approximate numbers of people and records, likely
   consequences, measures taken and proposed, DPO contact. If you don't know everything, notify with what you know and
   follow up.
8. **ICO** (UK people affected) — ico.org.uk breach reporting. **EU authority** — the authority of the EU country
   where most affected EU people live (no one-stop-shop without an EU establishment).
9. Press **NDPC told now** / **ICO told now** / **EU authority told now** in the register.

## Tell the people affected (if high risk)

10. In plain language, by SMS/WhatsApp and in-app notification (and email if we have one): what happened, what
    data, what we've done, what they can do (e.g. watch for scam calls quoting their consultation), and the DPO
    contact. Press **People told now**.

## Close

11. Fix the cause, write a short post-mortem in the breach description, and press **Close**. A breach that wasn't
    reported to the NDPC can only be closed with a recorded reason.
12. Review: does the DPIA or this runbook need to change?

Processors (Google, Cloudflare, OpenAI, Termii…) must tell us without undue delay about their breaches; treat their
notice as the start of our awareness.
