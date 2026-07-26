/**
 * Coffee with Onlu — waitlist endpoint (Google Apps Script)
 *
 * Appends each waitlist signup as a row in your Google Sheet.
 * This code is NOT deployed by the site — you paste it into Apps Script once.
 *
 * ── One-time setup ──────────────────────────────────────────────
 *  1. Create a Google Sheet. Tabs are auto-created (with headers) as signups
 *     arrive: one "Waitlist" tab, plus one tab per coffee for its RSVPs
 *     (e.g. "Quant · Aug 1"). The header row for every tab is:
 *       Timestamp | Name | Vertical | Role | Available | Goals | Email | LinkedIn | Source | Instagram | WeChat | Event | MBTI | Topics
 *  2. In the Sheet: Extensions → Apps Script. Delete the sample code,
 *     paste this whole file, and Save.
 *  3. (Recommended) Set a shared secret so only your site can post:
 *       Project Settings (gear) → Script Properties → Add property
 *       Name:  WAITLIST_TOKEN
 *       Value: <a long random string>
 *     Use that same value for the Vercel env var SHEETS_TOKEN.
 *  4. Deploy → New deployment → type "Web app".
 *       Description: waitlist
 *       Execute as: Me
 *       Who has access: Anyone
 *     Click Deploy, authorize when prompted, and copy the Web app URL.
 *  5. In Vercel → Project → Settings → Environment Variables, add:
 *       SHEETS_WEBHOOK_URL = <the Web app URL from step 4>
 *       SHEETS_TOKEN       = <the same value as WAITLIST_TOKEN, if you set one>
 *     Redeploy the site so the new env vars take effect.
 *
 * Whenever you change this script, Deploy → Manage deployments → Edit →
 * "New version" so the URL keeps working with the latest code.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var expected = PropertiesService
      .getScriptProperties()
      .getProperty('WAITLIST_TOKEN');
    if (expected && data.token !== expected) {
      return json({ error: 'unauthorized' });
    }

    // Routing: waitlist signups go to one "Waitlist" tab; each coffee's
    // RSVPs go to their own tab (e.g. "Quant · Aug 1"). Tabs are auto-created
    // with a header row the first time they're used.
    var HEADERS = ['Timestamp', 'Name', 'Vertical', 'Role', 'Available',
                   'Goals', 'Email', 'LinkedIn', 'Source', 'Instagram',
                   'WeChat', 'Event', 'MBTI', 'Topics'];
    var tabName;
    if (data.type === 'rsvp') {
      tabName = sanitizeTab(data.eventTab || data.event || 'RSVP');
    } else {
      tabName = 'Waitlist';
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(HEADERS);
    }

    sheet.appendRow([
      data.submittedAt || new Date().toISOString(),
      data.name || '',
      data.vertical || '',
      data.role || '',
      data.availableDate || '',
      data.goals || '',
      data.email || '',
      data.linkedin || '',
      data.source || '',
      data.instagram || '',
      data.wechat || '',
      data.event || '',
      data.mbti || '',
      data.topics || ''
    ]);

    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) });
  }
}

// A quick health check you can open in a browser to confirm it's deployed.
function doGet() {
  return json({ ok: true, service: 'coffee-with-onlu waitlist' });
}

// Make a string safe + short enough for a Google Sheets tab name.
function sanitizeTab(name) {
  var n = String(name || '').replace(/[:\\\/\?\*\[\]]/g, ' ').trim();
  if (n.length > 90) n = n.slice(0, 90);
  return n || 'RSVP';
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
