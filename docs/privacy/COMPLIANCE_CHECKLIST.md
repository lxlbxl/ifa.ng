# Compliance checklist (NDPA 2023 + GAID 2025, EU GDPR, UK GDPR)

Status as of 17 November 2026. **Done in code** means the app does it; **Alex** means a business decision or
filing; **Lawyer** means it needs a Nigerian (and, for the EU/UK pieces, an EU/UK) data protection lawyer or a
licensed Data Protection Compliance Organisation (DPCO). Nothing here is legal advice.

## A. Things only Alex (or a lawyer) can do

| # | Action | Why | Who | Status |
|---|---|---|---|---|
| A1 | Confirm the legal entity that runs IFA.ng (name, CAC RC number, registered address) and enter it in Admin → Privacy & data → Settings | The privacy notice must name the controller (NDPA s.27; GDPR Art. 13(1)(a)) | Alex | Open |
| A2 | Appoint a **Data Protection Officer** (staff member or outsourced DPO/DPCO) and set the DPO name and the privacy email (default `privacy@ifa.ng`, which must exist and be monitored) | NDPA s.32 requires a DPO for data controllers of major importance; GDPR Art. 37 likely applies because sensitive data is the core activity | Alex | Open |
| A3 | Decide the **NDPC registration tier** and register as a Data Controller/Processor of Major Importance (DCPMI) | NDPA s.44 and GAID: registration within 6 months of crossing a threshold. Tiers by data subjects in 6 months: Ordinary High Level > 200, Extra-High > 1,000, Ultra-High > 5,000. Sensitive data makes IFA.ng a likely DCPMI early | Alex + Lawyer/DPCO | Open |
| A4 | File the annual **Compliance Audit Return (CAR)** through a licensed DPCO (UHL/EHL tiers), by 31 March each year (or 15 months after starting) | GAID; late filing has a 50% surcharge | Alex + DPCO | Open (first return due by 31 March after the first full year) |
| A5 | Sign **data processing agreements** with every processor in [SUBPROCESSORS.md](SUBPROCESSORS.md) and keep copies (most are click-through: Google Cloud/Workspace DPA, Cloudflare DPA, OpenAI DPA, Anthropic DPA, Sentry DPA, Agora DPA; Termii, Paystack and Flutterwave may need to be requested) | NDPA s.29; GDPR Art. 28 | Alex | Open |
| A6 | Turn on **zero/limited data retention** with OpenAI and Anthropic where the account allows it, and confirm the API data is not used for training | Minimises exposure of sensitive transcripts held by US providers | Alex | Open |
| A7 | **Cross-border transfer instrument**: document the basis for sending Nigerian users' data to the UK/EU server and to US processors (adequacy or NDPC-approved contractual clauses + a transfer impact assessment); EU/UK side: SCCs + UK addendum/IDTA, or the EU–US Data Privacy Framework where the processor is certified | NDPA s.41–43 and GAID; GDPR Ch. V | Lawyer | Open |
| A8 | Decide whether IFA.ng **targets the EU/UK** (diaspora marketing, prices in GBP/EUR, etc.). If yes, appoint an **EU representative** and a **UK representative** (Art. 27) and enter them in Settings. The "occasional, no large-scale special-category" exemption likely does not apply because consultation content is sensitive | GDPR/UK GDPR Art. 27 | Alex + Lawyer | Open |
| A9 | UK: pay the **ICO data protection fee** if IFA.ng is treated as processing UK residents' data in a way that triggers it (check the ICO self-assessment) | DPA 2018 fees regulations | Alex | Open |
| A10 | Have a lawyer review `/privacy`, `/terms`, `/cookies`, the consent wording (sign-up step) and the DPIA, then press **Publish a new version** in Admin if the text changed | Wording should be checked by counsel; the app re-asks everyone after a new version | Lawyer | Open |
| A11 | Confirm the **retention periods** (defaults: 6 years for financial records, 90 days recordings, 365 days notifications, etc., in [RETENTION.md](RETENTION.md)) and adjust them in Settings | Tax/company law periods should be confirmed by an accountant | Alex + accountant | Open |
| A12 | Make sure the VPS disk and backups are **encrypted at rest**, offsite backups expire after 30 days (`BACKUP_KEEP_REMOTE`), and only named people hold server access | NDPA s.39; GDPR Art. 32 | Alex | Open |
| A13 | **Babalawo agreement**: Babalawos receive sensitive data. The Terms now require confidentiality; a short signed confidentiality/data agreement at onboarding is better | NDPA s.29/s.39; GDPR Art. 28/29 | Lawyer | Open |
| A14 | Train every admin on [BREACH_RESPONSE.md](BREACH_RESPONSE.md) and on checking identity before releasing data | Accountability | Alex | Open |
| A15 | Run a yearly review: this checklist, the DPIA, the processor list, a restore test of backups, and the retention numbers | NDPA s.24(3), GAID | Alex/DPO | Recurring |

## B. Built into the app

| Obligation | Status |
|---|---|
| Privacy notice covering controller, DPO, purposes, legal bases, sensitive data, AI, recipients, transfers, retention, rights, complaints (NDPC/ICO/EU authorities), children, cookies, security, changes | Done (`/privacy`) |
| Cookie policy listing every cookie and storage item; first-visit notice; footer "Privacy choices" | Done (`/cookies`). No non-essential cookies are set, so no opt-in wall is needed |
| Google Fonts removed (visitors' IP addresses no longer go to Google) | Done |
| Age 18+ confirmation, terms + privacy acceptance, explicit sensitive-data consent, optional marketing; all logged with version, time and device | Done |
| Re-consent when the notice version changes | Done (Admin → Privacy & data → Settings → Publish a new version) |
| Recording + AI consent per session from both parties (existing); withdrawal after the session deletes recordings and transcripts; database refuses late transcripts | Done |
| Self-service data export (JSON, every table linked to the person) | Done |
| Self-service account deletion: removes identity, consultation notes, transcripts, recordings, Ebo proof videos, notifications; keeps pseudonymised financial records | Done |
| Request form for people with or without an account; 30-day due dates; extensions capped at +60 days with a reason; identity check required before export/erasure; person notified in-app | Done |
| Admin queue for requests, export on behalf of a person, erasure on request, all audit-logged | Done |
| Retention schedule run hourly, logged in `retention_runs`; stored files deleted through a queue | Done |
| Breach register with the 72-hour NDPC clock; closing without notifying needs a recorded reason | Done |
| Crash reports can be turned off per browser; they carry no account details | Done |
| WhatsApp/SMS reminders can be turned off; consent mirrored in the log | Done (existing toggles now logged) |

## C. Known gaps (engineering)

- **Marketing messages**: there is a consent flag but no marketing sender yet. Anything that sends marketing must check
  `privacy_consents` (purpose `marketing`) first.
- **Files in an erasure export**: recordings and photos are listed, not attached. An admin can send them on request.
- **Backups**: erased data stays in backups until they expire (30 days). This is normal and stated in the notice;
  never restore an erased account from backup without re-running the erasure.
- **Google Meet recordings in Google Drive**: Meet saves the original in the organizer account's Drive. The worker
  deletes it at the end of retention, on consent withdrawal and on erasure **only if** `GOOGLE_DRIVE_DELETE=true` and
  the domain-wide delegation also grants `https://www.googleapis.com/auth/drive`. Until then, set a Google Vault /
  Drive retention rule for the organizer account that matches `recording_retention_days`. (Alex)
- **Server logs**: the API prints errors with request paths; keep log retention on the VPS short (Docker log rotation).
