# Data protection at IFA.ng

IFA.ng serves people in Nigeria and in the diaspora, so it follows:

- **Nigeria Data Protection Act 2023 (NDPA)** and the NDPC's **General Application and Implementation Directive (GAID) 2025**
  (the NDPR 2019 is superseded where they conflict);
- **EU GDPR** for people in the EU/EEA, and the **UK GDPR + Data Protection Act 2018 + PECR** for people in the UK
  (IFA.ng offers services to them, so GDPR Art. 3(2) applies even without an office there).

What you are reading is the engineering side: what the app does, where it lives in the code, and what still needs a
human. **Nothing here is legal advice.** The items in [COMPLIANCE_CHECKLIST.md](COMPLIANCE_CHECKLIST.md) marked
"Alex" or "lawyer" have to be done outside the code.

| Document | What it is |
|---|---|
| [COMPLIANCE_CHECKLIST.md](COMPLIANCE_CHECKLIST.md) | Every obligation, what the app does about it, and what is still open (owner + lawyer actions) |
| [RECORDS_OF_PROCESSING.md](RECORDS_OF_PROCESSING.md) | Record of processing activities (NDPA accountability, GAID; GDPR Art. 30) |
| [DPIA.md](DPIA.md) | Data protection impact assessment for consultations, recordings and AI notes (draft) |
| [SUBPROCESSORS.md](SUBPROCESSORS.md) | Processors, what they get, where, and the transfer safeguard |
| [RETENTION.md](RETENTION.md) | Retention schedule and how deletion runs |
| [BREACH_RESPONSE.md](BREACH_RESPONSE.md) | 72-hour breach runbook |

## How it works in the app

| Right / duty | Where | Code |
|---|---|---|
| Notice (NDPA s.27, GDPR Art. 13/14) | `/privacy`, `/cookies`, `/terms` | `src/pages/Legal.tsx` |
| Consent, logged and versioned (NDPA s.26, GDPR Art. 7) | Sign-up step, gate on signed-in pages, Settings → Your privacy | `public.privacy_consents`, `record_consents()`, `src/components/privacy/*` |
| Explicit consent for sensitive data (NDPA s.30, GDPR Art. 9(2)(a)) | Required tick at sign-up; asked again before booking if withdrawn | `special_category` consent |
| Age: 18+ only (NDPA s.31, GDPR Art. 8) | Required tick at sign-up | `age_confirmed` consent |
| Recording / AI consent, per session, both parties | Before each session (existing), withdraw after in Settings | `session_consents`, `withdraw_recording_consent()`, transcript trigger |
| Access + portability (NDPA s.34/38, GDPR Art. 15/20) | Settings → Download my data (JSON) | `export_my_data()` — every table with a foreign key to the person, found automatically |
| Rectification (s.34(1)(c), Art. 16) | Settings (name), request form for the rest | `submit_data_request('rectification')` |
| Erasure (s.34(1)(d), Art. 17) | Settings → Delete my account; admin on request | `delete_my_account()` / `admin_erase_user()` → `_erase_user()` |
| Restriction, objection, automated decisions (s.34–37, Art. 18/21/22) | Request form (signed in or not) | `data_subject_requests`, Admin → Privacy & data |
| 30-day deadline, extensions with reasons | Admin → Privacy & data → Requests | `admin_update_data_request()` |
| Retention / storage limitation (s.24(1)(d), Art. 5(1)(e)) | Hourly job | `run_retention()`, `server/src/services/privacy.ts` |
| Files deleted from storage | Every 5 minutes | `private.storage_deletions`, `deleteQueuedFiles()` |
| Breach register, 72-hour clock (s.40, Art. 33/34) | Admin → Privacy & data → Breaches | `public.data_breaches` |
| Accountability (s.24(3), Art. 5(2)) | Every admin action on a request, export, erasure or breach | `admin_audit_log` |
| Cookies (GAID; ePrivacy/PECR) | Notice on first visit, Privacy choices in the footer | `src/components/privacy/CookieNotice.tsx` |
| No third-party font calls | Fonts are bundled | `@fontsource-variable/*` in `src/main.tsx` |

Admin settings for the controller's name, RC number, address, DPO, NDPC registration number, EU/UK representatives
and every retention period are in **Admin → Privacy & data → Settings** and appear in the privacy policy as soon as
they are saved. "Publish a new version" asks every user to agree again (do this after a material change to the policy).
