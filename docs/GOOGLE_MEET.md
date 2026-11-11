# Google Meet video, recording and AI notes

Google Meet is the default video provider. Agora is kept as a working fallback.

## How it works

1. **Payment confirmed** (server sets `sessions.payment_status = 'paid'`) → the payments code calls the
   edge function `create-meet-link` with `{ session_id }`. It refuses unless the session is paid, is idempotent,
   and creates a Meet space from IFA.ng's own Workspace account via a service account (no user OAuth screens).
   - `accessType: TRUSTED`: the Babalawo walks in; a client without a Google account opens the link, taps **Ask to join**
     and the Babalawo (co-host) admits them.
   - The Babalawo is added as **COHOST** (`babalawos.google_email`, falling back to their login email).
   - **Auto-recording is armed only if both parties consented**; otherwise it is `OFF`. Consent changes call
     `create-meet-link` again, which patches the space (reconcile).
   - If Google is unreachable or unconfigured, the session falls back to Agora (`video_provider = 'agora'`,
     reason in `video_fallback_reason`) and both parties are messaged the in-app link.
2. **Consent** (`session_consents`, RPC `record_session_consent`): asked at booking (unticked boxes) and again on the
   session page before joining. Both must agree to recording **and** AI processing, or nothing is recorded. The worker
   re-checks consent before processing.
3. **After the call** the `recording-processor` worker (workers/recording-processor, needs ffmpeg) finds the conference
   record, downloads the recording from Drive, stores a 16 kHz mono audio copy in the private `session-recordings`
   bucket, transcribes it (English/Yorùbá, pluggable provider), runs accuracy checks, and has Claude draft the notes.
   The draft is upserted into `consultation_notes` (`status='draft'`, `source='ai'`); the Babalawo approves before the client sees it.
4. **Notifications** (`notification_outbox` → `dispatch-notifications`): Meet link, 24 h / 1 h reminders, reschedules,
   completion and notes-ready, via WhatsApp (Meta Cloud API templates) with SMS (Termii) fallback. De-duplicated and retried.
5. **Access**: recordings and transcript quality data: Babalawo + admins only (signed 10-minute URLs from `session-media`,
   audited in `admin_audit_log`). Clients get the transcript only after the notes are approved.

## What Google's documentation says (validated against developers.google.com and support.google.com, Nov 2026)

| Question | Finding | Source |
|---|---|---|
| Recording needs which edition? | Business Starter does not include recording. Business Standard/Plus, Enterprise, Essentials editions do. | support.google.com/meet/answer/9308681 |
| Can an external Babalawo be co-host and record? | Yes: "from outside the host's organization and promoted to a co-host" can record. The API supports `COHOST` members by email. | same page; Meet REST `spaces.members` |
| Auto-record without pressing Record | `artifactConfig.recordingConfig.autoRecordingGeneration = ON` on the space. Per Google's help page, auto-start does not begin until the host or a co-host joins **on the web**. | Meet REST `spaces`, help page |
| Guests without a Google account | Allowed by default on Workspace unless the admin restricts it; they must "Ask to join" and be admitted. | support.google.com/meet/answer/9303069 |
| Where do recordings go, can we fetch them? | The organizer's Drive ("Google Meet" folder). `conferenceRecords.recordings` returns `driveDestination.file`; download with Drive API. Usually ready minutes after the call. | Meet REST artifacts guide |
| Meet transcription for Yorùbá | Not relied on. Meet transcription is OFF; we transcribe the recording ourselves. | design decision |

Things **only a live test can confirm** (run `node scripts/validate-google-meet.mjs`): that IFA.ng's edition/admin policy
accepts `autoRecordingGeneration`, that a non-IFA.ng Google account can be added as COHOST, that guests can knock in, and
that the service account can download the recording. The script prints PASS/FAIL and a manual checklist.

## Fallbacks if auto-record does not start

1. The co-host Babalawo presses **Record** in Meet (co-hosts are allowed to).
2. No recording after the call → `recording_status='unavailable'`; the session page lets the Babalawo upload audio they
   recorded themselves (both parties already consented) and the same pipeline runs; or write notes manually.

## Credentials Alex must supply

| Secret | Where | What it is |
|---|---|---|
| Google Workspace (Business Standard or higher) with a dedicated organizer user, e.g. `meet@ifa.ng` | Google | Recording is unavailable on Business Starter |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Supabase secrets **and** worker env | Service account key (Google Cloud project with **Google Meet REST API** and **Google Drive API** enabled) |
| Domain-wide delegation | Admin console → Security → API controls | Client ID of the service account with scopes: `meetings.space.created`, `meetings.space.settings`, `meetings.space.readonly`, `drive.readonly` |
| `GOOGLE_ORGANIZER_EMAIL` | Supabase secrets and worker | The user to impersonate (`meet@ifa.ng`) |
| Meet admin policy | Admin console → Apps → Google Meet | Recording allowed for that OU; external/unsigned guests allowed |
| `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` | Supabase secrets (or admin settings) | Fallback video |
| `TERMII_API_KEY`, `TERMII_SENDER_ID` | Supabase secrets | SMS (already used) |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Supabase secrets | WhatsApp Cloud API. Register 10 approved templates named `ifa_meet_link`, `ifa_reminder_24h`, `ifa_reminder_1h`, `ifa_rescheduled`, `ifa_completed`, `ifa_notes_ready`, `ifa_fallback_video`, `ifa_ebo_sent`, `ifa_ebo_paid`, `ifa_ebo_performed` (see EBO.md), each with 4 body variables: `{{1}}` name, `{{2}}` other party, `{{3}}` date/time, `{{4}}` link |
| `OPENAI_API_KEY` (or `STT_HTTP_URL`/`STT_HTTP_TOKEN`) | worker | Speech to text |
| `ANTHROPIC_API_KEY` | worker | Notes drafting |
| `SUPABASE_SERVICE_ROLE_KEY` | worker | Worker database access |
| `APP_URL` | Supabase secrets | `https://ifa.ng`, used in message links |

Set edge secrets: `supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat key.json)" GOOGLE_ORGANIZER_EMAIL=meet@ifa.ng ...`
Deploy: `supabase functions deploy create-meet-link session-media dispatch-notifications generate-agora-token`.

## Scheduling

```sql
-- every minute (needs pg_cron + pg_net; replace the key via Vault, never commit it)
select cron.schedule('ifa-dispatch', '* * * * *', $$
  select net.http_post(url := 'https://bxzwsfglgodfuirdkgsc.supabase.co/functions/v1/dispatch-notifications',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')));
$$);
```
Run the worker as a long-lived container (`workers/recording-processor/Dockerfile`: Fly.io, Render or Cloud Run) or via cron with `node index.mjs --once`.

## Accuracy checks for English and Yorùbá

- **Runtime** (`lib/quality.mjs`, stored in `session_transcripts.quality`): provider confidence, share of low-confidence
  segments, non-speech share, hallucination loops, implausible/sparse speech rate, missing Yorùbá tone marks, language
  mix. `needs_review` is set when any hard check fails; **Yorùbá/mixed transcripts always require Babalawo review** until you set `YORUBA_ALWAYS_REVIEW=false`.
- **Pilot benchmark before launch:** record ~5 consultations (or rehearsals) with consent, hand-transcribe them
  (`name.mp3` + `name.txt`) and run `STT_PROVIDER=openai node scripts/eval-stt.mjs ./pilot`. It reports WER/CER, also without
  tone marks. Rule of thumb: WER ≤ 0.25 is usable as a draft, above 0.40 switch provider (plug in a Yorùbá-specialised model
  behind `STT_PROVIDER=http`). I have not run this: it needs real audio and API keys.

## Known limits

- Recording files stay in the organizer's Drive (restrict that folder to the organizer; do not share it) and the audio copy
  is deleted after `recording_retention_days` (default 90). Deleting the Drive original at the same time needs the full `drive` scope and is not enabled.
- Auto-record only starts when the co-host joins on the web (Google's documented behaviour); the Babalawo UI says so.
- Session times are interpreted in `sessions.user_timezone` (default Africa/Lagos), matching how booking stores them.
- Daily.co code is no longer used by the session page; it can be deleted once Agora is confirmed in production.
