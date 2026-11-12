# Record of processing activities

Controller: the company entered in Admin → Privacy & data → Settings (see `privacy_controller_name`). DPO: as set there.
Joint/independent recipients: Babalawos (independent professionals who receive consultation content).

| # | Activity | People | Data | Purpose | Legal basis (NDPA s.25/s.30; GDPR Art. 6/9) | Recipients | Transfers | Retention | Security |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Accounts and sign-in | Clients, Babalawos, admins | Phone, first name, photo, time zone, hashed PIN, sign-in sessions (IP, device) | Run accounts, prevent misuse | Contract; legitimate interest (security) | Termii (codes), host | UK/EU host; Termii NG | Account life; sessions 90 days after expiry | Hashed PINs/codes, httpOnly cookies, RLS |
| 2 | Bookings and consultations | Clients, Babalawos | Session times, topic, Babalawo/client, payment status, notes, Odù, Ebo, reviews, disputes | Provide consultations | Contract; **explicit consent** for consultation content | Babalawo, Google Meet, Agora | US (Google/Agora) | Account life; erasure on request | RLS; participants only |
| 3 | Recording, transcription, AI notes | Clients, Babalawos | Audio, transcripts (sensitive) | Draft notes for Babalawo approval | **Explicit consent** of both parties per session | Google (Drive), OpenAI, Anthropic, R2 | US | 90 days; on withdrawal immediately | Signed expiring links, private bucket, consent checks in DB |
| 4 | Payments, wallet, payouts | Clients, Babalawos | Amounts, references, wallet ledger, bank details (Babalawos) | Take payment, refund, pay out, keep books | Contract; legal obligation | Paystack, Flutterwave, accountant | NG | 6 years | Server-side money rules, audit log |
| 5 | Messages and reminders | Clients, Babalawos | Phone, message text (no consultation content), push endpoints | Booking confirmations and reminders | Contract; user can switch channels off | Termii, Meta WhatsApp, push services | NG / global | Delivery log 90 days | No sensitive content in messages |
| 6 | Babalawo applications | Applicants | Name, phone, email, location, ilé, experience, bio | Vet Babalawos | Steps before contract; legitimate interest | Admins | — | Declined: 365 days | Admin-only |
| 7 | Safety, fraud, disputes | All users | Session logs, disputes, audit logs | Keep platform safe, handle claims | Legitimate interest; legal claims | Admins | — | 2–6 years | Admin-only, audit log |
| 8 | Crash reports | Visitors, users | Error, page path, browser | Fix errors | Legitimate interest (opt-out) | Sentry | US/EU | Sentry's retention (set ≤ 90 days) | No account data |
| 9 | Privacy requests, consents, breaches | All users, requesters | Request details, contact, consent log | Comply with data protection law | Legal obligation | DPO, admins | — | 3 years after closing; consent proof | Admin-only, audit log |
| 10 | Marketing (not active yet) | Users who opt in | Phone/email, consent | News and offers | Consent | Messaging provider | — | Until withdrawn | Check `marketing` consent before sending |
