#!/usr/bin/env node
// Validates, against IFA.ng's REAL Google Workspace, everything the Meet integration depends on.
//   GOOGLE_SERVICE_ACCOUNT_JSON=... GOOGLE_ORGANIZER_EMAIL=meet@ifa.ng \
//   node scripts/validate-google-meet.mjs --cohost babalawo@gmail.com
//   node scripts/validate-google-meet.mjs --artifacts spaces/abc123      # after a real test call
// Creates one throw-away space. Nothing is sent to anyone.
import { token } from "../workers/recording-processor/lib/google.mjs";

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : null; };
const S = {
  create: "https://www.googleapis.com/auth/meetings.space.created",
  settings: "https://www.googleapis.com/auth/meetings.space.settings",
  read: "https://www.googleapis.com/auth/meetings.space.readonly",
  drive: "https://www.googleapis.com/auth/drive.readonly",
};
const results = [];
const check = (name, pass, detail = "") => { results.push({ check: name, result: pass ? "PASS" : "FAIL", detail: String(detail).slice(0, 160) }); return pass; };
const meet = async (method, path, scopes, body) => {
  const res = await fetch(`https://meet.googleapis.com/v2/${path}`, { method, headers: { Authorization: `Bearer ${await token(scopes)}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
};

try {
  // 1. Domain-wide delegation works for the Meet + Drive scopes
  for (const [n, sc] of Object.entries(S)) {
    try { await token([sc]); check(`delegation: ${n} scope`, true); } catch (e) { check(`delegation: ${n} scope`, false, e.message + " (add this scope under Admin console > Security > API controls > Domain-wide delegation)"); }
  }

  if (arg("artifacts")) {
    // 6. Retrieval after a real test call
    const space = arg("artifacts");
    const c = await meet("GET", `conferenceRecords?filter=${encodeURIComponent(`space.name="${space}"`)}`, [S.read]);
    const rec = c.data.conferenceRecords?.[0];
    check("conference record found", !!rec, c.ok ? "" : JSON.stringify(c.data.error));
    if (rec) {
      const r = await meet("GET", `${rec.name}/recordings`, [S.read]);
      const f = r.data.recordings?.find((x) => x.driveDestination?.file);
      check("recording listed with Drive file", !!f, f ? f.state : "no recording: was auto-record ON and did the co-host join on the web?");
      if (f) {
        const d = await fetch(`https://www.googleapis.com/drive/v3/files/${f.driveDestination.file}?fields=name,size,owners(emailAddress)`, { headers: { Authorization: `Bearer ${await token([S.drive])}` } });
        const meta = await d.json();
        check("recording file downloadable by the service account (Drive)", d.ok, d.ok ? `${meta.name} ${meta.size}B owner=${meta.owners?.[0]?.emailAddress}` : JSON.stringify(meta.error));
      }
    }
  } else {
    // 2. Drive reachable + storage
    const about = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress),storageQuota", { headers: { Authorization: `Bearer ${await token([S.drive])}` } });
    const ab = await about.json();
    check("drive access as organizer", about.ok, about.ok ? `${ab.user.emailAddress}, limit=${ab.storageQuota?.limit ?? "unlimited/pooled"}` : JSON.stringify(ab.error));

    // 3. Create a space with auto-recording requested -> proves the edition accepts artifactConfig
    const created = await meet("POST", "spaces", [S.create], { config: { accessType: "TRUSTED", artifactConfig: { recordingConfig: { autoRecordingGeneration: "ON" }, transcriptionConfig: { autoTranscriptionGeneration: "OFF" } } } });
    check("create space with auto-recording ON", created.ok, created.ok ? created.data.meetingUri : JSON.stringify(created.data.error));
    if (created.ok) {
      const sp = created.data;
      const echoed = sp.config?.artifactConfig?.recordingConfig?.autoRecordingGeneration;
      check("API echoes autoRecordingGeneration=ON (edition eligible)", echoed === "ON", `echoed=${echoed}. If OFF/missing the Workspace edition or admin policy does not allow recording`);
      check("accessType TRUSTED honoured (guests must knock)", sp.config?.accessType === "TRUSTED", sp.config?.accessType);
      // 4. External co-host
      const email = arg("cohost");
      if (email) {
        const m = await meet("POST", `${sp.name}/members`, [S.create], { email, role: "COHOST" });
        check(`add ${email} as COHOST (external accounts)`, m.ok, m.ok ? m.data.name : JSON.stringify(m.data.error));
        const l = await meet("GET", `${sp.name}/members`, [S.create]);
        check("member list shows COHOST", l.data.members?.some((x) => x.role === "COHOST"), JSON.stringify(l.data.members ?? l.data.error));
      } else check("external co-host test", false, "re-run with --cohost <a real non-IFA.ng Google account>");
      console.log(`\nTest space: ${sp.meetingUri}  (${sp.name})`);
    }
  }
} catch (e) { check("unexpected error", false, e.message); }

console.table(results);
console.log(`
MANUAL CHECKS (cannot be automated):
 [ ] Open the test link in a private window WITHOUT signing in to Google -> you should see "Ask to join"; the co-host admits you. (Guest access)
 [ ] Admin console > Apps > Google Workspace > Google Meet > Meet video settings: "Recording" ON for the organizer's OU, and
     "Access to Meet from outside the organization" allows people not signed in. (Eligibility + guests)
 [ ] Co-host joins from a WEB browser (not the Meet mobile app): recording should start automatically when they join. Google
     states automatic recording does not start until the host or a co-host joins on web.
 [ ] After the call ends, re-run with  --artifacts <space name>  to prove recording retrieval (allow 5-15 minutes).
 [ ] Do the Babalawo's and the client's screens show the red "recording" notice? (Meet always shows it; that is the in-call consent signal.)
`);
process.exit(results.some((r) => r.result === "FAIL") ? 1 : 0);
