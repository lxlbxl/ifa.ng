# Data protection impact assessment (draft for DPO/lawyer review)

Required because IFA.ng processes **sensitive data at scale** (religious/philosophical beliefs, sometimes health),
uses **new technology** (AI transcription and note drafting) and **transfers data abroad** (NDPA s.28 and the GAID
DPIA template; GDPR Art. 35). This draft follows the GAID structure; the DPO should complete, sign and re-review it
yearly or when processing changes.

## 1. Description
Clients book video consultations with independent Babalawos. With both parties' consent, Meet records the session;
our worker transcribes it (OpenAI) in English/Yorùbá and drafts notes (Anthropic/OpenAI); the Babalawo edits and
approves notes, which the client then sees. Payments via Paystack/Flutterwave; messages via Termii/WhatsApp.
Data subjects: Nigerian residents and diaspora (UK, EU, US and elsewhere).

## 2. Necessity and proportionality
- Recording is optional, per session, and off unless both say yes; the service works without it.
- AI only drafts; a human (the Babalawo) decides what the client sees. No automated decisions with legal or
  similarly significant effects.
- Only audio/transcript go to AI providers; message providers never get consultation content.
- Retention: recordings/transcripts 90 days; notes until the person deletes the account.
- People can export, withdraw, and erase themselves in Settings.

## 3. Risks

| Risk | Likelihood | Severity | Mitigation | Residual |
|---|---|---|---|---|
| Disclosure of spiritual consultation content (stigma, family conflict, religious persecution) | Low | High | RLS per participant, expiring file links, admin access logged, encrypted transport, no content in SMS/WhatsApp | Medium |
| AI provider retains or uses transcripts | Low | High | Business API terms (no training), DPAs, zero-retention where offered (A6) | Low |
| Inaccurate AI notes affecting a client's decisions | Medium | Medium | Babalawo approval required; confidence/needs-review flags; client can ask for correction | Low |
| Babalawo misuses client data | Low | High | Terms confidentiality clause, vetting, suspension, signed agreement (A13) | Medium |
| Cross-border transfer to US providers | Certain | Medium | SCCs/DPF, TIA (A7), minimisation | Low–Medium |
| Child uses the service | Low | Medium | 18+ confirmation, deletion on report | Low |
| Recordings outlive retention in Google Drive | Medium | Medium | Worker Drive deletion or Drive retention rule (checklist C) | Low once configured |
| Breach of the VPS | Low | High | Hardening, backups, encrypted secrets, breach runbook | Medium |

## 4. Measures to adopt
All items in COMPLIANCE_CHECKLIST.md section A, especially A5–A7, A12, A13.

## 5. Sign-off
DPO: ______  Date: ______  Next review: ______
