# Processors and other recipients

Keep this in step with the table in `src/pages/Legal.tsx` (`RECIPIENTS`). Add a row **before** a new provider gets
personal data, sign its DPA, and record the transfer safeguard.

| Provider | Role | Personal data | Location | Transfer safeguard | DPA |
|---|---|---|---|---|---|
| VPS host (London or Frankfurt) | Processor: hosting | Everything in the database; local file store if R2 is not configured; backups | UK or Germany | NDPA s.41–43 (UK/EU adequate-equivalent protection, contract); GDPR: UK–EU adequacy | To sign |
| Cloudflare (R2, DNS/proxy) | Processor: object storage, network | Photos, recordings, Ebo videos; IP addresses in transit | Global; R2 location hint chosen by us (set EU) | SCCs / EU–US DPF | Click-through |
| Paystack | Independent controller for card data; processor for payment records | Name, phone/email, amount, reference; card details (we never see them) | Nigeria | Nigerian law | Request |
| Flutterwave | As Paystack | As Paystack | Nigeria / US | Nigerian law; SCCs | Request |
| Google (Meet, Workspace, Drive) | Processor | Session time, participant emails/names, recordings in the organizer's Drive, booking emails | US and global | SCCs / EU–US DPF | Workspace/Cloud DPA |
| Agora | Processor | Video/audio streams for fallback calls (not recorded by us), account ids | US and global | SCCs | Click-through |
| Termii | Processor | Phone numbers, sign-in codes, message text (no consultation content) | Nigeria | Nigerian law | Request |
| Meta (WhatsApp, via Termii) | Processor of Termii | Phone numbers, message text | Global | SCCs | Through Termii |
| OpenAI | Processor | Audio of consented recordings, transcripts (sensitive) | US | SCCs / EU–US DPF; API data not used for training; ask for zero retention | Click-through DPA |
| Anthropic | Processor | Transcripts (sensitive) to draft notes | US | SCCs; commercial API data not used for training | Click-through DPA |
| Sentry | Processor | Error messages, page path, browser; server errors with request path | US or EU (choose EU) | SCCs | Click-through |
| SMTP provider | Processor | Email addresses, booking emails | Depends | SCCs | To sign |
| Push services (FCM, APNs, Mozilla) | Delivery only | Push endpoint, encrypted notification | US | Necessary to deliver; payload encrypted | — |

**Sensitive data minimisation:** only the recording and transcript go to OpenAI/Anthropic, and only when both
people consented. Message providers never get consultation content.
