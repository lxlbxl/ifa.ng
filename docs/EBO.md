# Ebo and Etutu after a consultation

How a prescribed Ebo moves from the consultation to a completed ritual, and who can do what.
Everything that changes money or status is a database function (migration
`20261112000000_ebo_quotes_payments.sql`). Clients and Babalawos can only read the tables directly.

## The flow

1. **During or after the consultation** the Babalawo opens *Sessions → Ebo* on a paid consultation and builds a quote:
   items (picked from the admin catalogue or typed), quantity × price for one, their **Owó Ifá**, and a proposed
   **ritual date and time**. If the session was recorded, the notes worker drafts the Ebo it heard (items only, never prices),
   marked "From the recording".
2. **Send to client.** Prices lock. The client gets an in-app notification, push, and WhatsApp/SMS (`ebo_sent`).
   The quote shows each item, Owó Ifá, the **platform fee** (a percentage added on top, set by admins and locked when the quote
   is sent) and the total. It expires after `ebo_quote_expiry_days` (default 7); the Babalawo can renew it.
   Changing a sent quote needs a reason, which the client sees and the log keeps.
3. **Client pays** from their wallet or by card/transfer (Paystack/Flutterwave), and chooses:
   - **I'll join live**: a ritual session is created at the agreed time, already paid at ₦0, with a Meet link and the usual reminders.
     It is never billed separately.
   - **I won't attend**: the Babalawo must upload a video of the ritual, with sound, showing every item and saying the prayers with the client's name.
   The client can ask for another time before paying, decline, or switch attendance up to an hour before the ritual.
4. **Money is held.** The Babalawo's share (the whole Ebo total) sits in their pending balance.
   - **Mark started** releases the item money so they can buy the items.
   - **Mark performed** (needs the video if the client is absent) starts the confirmation window.
   - The client **confirms**, or the rest is released automatically after `ebo_confirm_hours` (default 72) unless they **report a problem**.
5. **Proof videos** are uploaded as-is (up to 300 MB), then the recording worker compresses them to H.264/AAC MP4
   (longest side 1280 px, at most 30 fps, fast start) for storage and smooth playback, deletes the original, and transcribes the audio
   to check that the client's name and the items were heard. The check is a hint for the client and admins, never a verdict.
6. **Admin → Ebo & Etutu** shows money held, platform fees earned, disputes, overdue rituals and prices outside the catalogue's usual range,
   with the full event log and proof. Admins can release, refund what is still held, or refund in full (which takes back released item money
   unless the Babalawo already withdrew it). Admins also maintain the item catalogue and set the fee and timings.

A Babalawo can also prescribe an Ebo the **client does themselves** (guidance only, no payment); the client marks it started and done.

## Money, per Ebo

| | |
|---|---|
| `total` | items + Owó Ifá. All of it is the Babalawo's. |
| `platform_fee` | `total × platform_fee_percent` (locked at send) |
| `amount_due` | `total + platform_fee`: what the client pays |

Ledger entries (`babalawo_ledger`, one of each per Ebo): `ebo_earning` (held), `ebo_items_release`, `ebo_final_release`, `ebo_reversal`.
`payments` gets one row per paid Ebo (`ebo_id`), with `commission_amount` = the platform fee.

## Settings (`admin_settings`)

`ebo_platform_fee_percent` (10), `ebo_quote_expiry_days` (7), `ebo_confirm_hours` (72), `ebo_max_total` (5,000,000).

## WhatsApp templates to register

Three more Meta templates, same 4 body variables as the others (`{{1}}` name, `{{2}}` other party, `{{3}}` Ebo title and amount, `{{4}}` link):
`ifa_ebo_sent`, `ifa_ebo_paid`, `ifa_ebo_performed`. Until they are approved, these messages go by SMS.
