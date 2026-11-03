/**
 * Coffee with Onlu — waitlist endpoint (Google Apps Script)
 *
 * Appends each waitlist signup as a row in your Google Sheet.
 * This code is NOT deployed by the site — you paste it into Apps Script once.
 *
 * ── One-time setup ──────────────────────────────────────────────
 *  1. Create a Google Sheet. Tabs are auto-created (with headers) as signups
 *     arrive: one "Waitlist" tab, one "Subscribers" tab (email list for news
 *     and events), plus one tab per coffee for its RSVPs (e.g.
 *     "Quant · Aug 1"). The header row for every tab is:
 *       Timestamp | Name | Vertical | Role | Available | Goals | Email | LinkedIn | Source | Instagram | WeChat | Event | MBTI | Topics | Notes
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
                   'WeChat', 'Event', 'MBTI', 'Topics', 'Notes'];
    var tabName;
    if (data.type === 'rsvp') {
      tabName = sanitizeTab(data.eventTab || data.event || 'RSVP');
    } else if (data.type === 'subscribe') {
      tabName = 'Subscribers';
    } else {
      tabName = 'Waitlist';
    }
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(HEADERS);
    }

    // Subscribers: one row per email. Signing up again updates the choices.
    if (data.type === 'subscribe') {
      var email = String(data.email || '').trim().toLowerCase();
      var last = sheet.getLastRow();
      if (last > 1) {
        var emails = sheet.getRange(2, 7, last - 1, 1).getValues();
        for (var i = 0; i < emails.length; i++) {
          if (String(emails[i][0]).trim().toLowerCase() === email) {
            var r = i + 2;
            sheet.getRange(r, 1).setValue(data.submittedAt || new Date().toISOString());
            if (data.name) sheet.getRange(r, 2).setValue(data.name);
            sheet.getRange(r, 14).setValue(data.topics || '');
            notifyHost(data, tabName, true);
            return json({ ok: true, updated: true });
          }
        }
      }
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
      data.topics || '',
      data.notes || ''
    ]);

    notifyHost(data, tabName);
    sendConfirmation(data);

    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) });
  }
}

// A quick health check you can open in a browser to confirm it's deployed.
function doGet() {
  return json({ ok: true, service: 'coffee-with-onlu waitlist' });
}

/**
 * Run this once from the Apps Script editor (pick it in the function
 * dropdown, then Run) to trigger Google's authorization prompt for
 * sending mail. Web-app runs never show that prompt, so without this
 * the emails fail silently. You should receive a test email.
 */
function testEmail() {
  var to = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail(to, 'Coffee with Onlu — test', 'Email notifications are working.');
  Logger.log('Sent test email to ' + to + '. Remaining quota: ' + MailApp.getRemainingDailyQuota());
}

// Email the host a summary of each new signup. Wrapped so a mail
// failure never blocks the signup from being saved.
function notifyHost(data, tabName, updated) {
  try {
    var to = Session.getEffectiveUser().getEmail();
    if (!to) return;
    var isRsvp = data.type === 'rsvp';
    var subject = data.type === 'subscribe'
      ? (updated ? 'Subscriber updated' : 'New subscriber') + ' — ' + (data.email || '') +
        (data.topics ? ' (' + data.topics + ')' : '')
      : 'New ' + (isRsvp ? 'RSVP' : 'waitlist signup') +
        ' — ' + (data.name || 'someone') +
        (isRsvp && data.event ? ' (' + data.event + ')' : '');
    var lines = [
      'Tab: ' + tabName,
      data.event ? 'Event: ' + data.event : '',
      'Name: ' + (data.name || ''),
      'Email: ' + (data.email || ''),
      data.vertical ? 'Vertical: ' + data.vertical : '',
      data.role ? 'Role: ' + data.role : '',
      data.availableDate ? 'Available: ' + data.availableDate : '',
      data.instagram ? 'Instagram: ' + data.instagram : '',
      data.wechat ? 'WeChat: ' + data.wechat : '',
      data.mbti ? 'MBTI: ' + data.mbti : '',
      data.topics ? 'Topics: ' + data.topics : '',
      data.goals ? 'Goals: ' + data.goals : '',
      data.notes ? 'Notes: ' + data.notes : ''
    ].filter(function (l) { return l; });
    MailApp.sendEmail(to, subject, lines.join('\n'));
  } catch (mailErr) {
    // ignore — the row is already saved
  }
}

// Send a friendly confirmation to the person who signed up.
function sendConfirmation(data) {
  try {
    var email = (data.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    var first = (data.name || 'there').split(' ')[0];
    var subject, body;
    if (data.type === 'subscribe') {
      subject = "You're subscribed — Coffee with Onlu";
      body = 'Hi ' + first + ",\n\n" +
        "Thanks for subscribing to " + (data.topics === 'News' ? 'the Onlu Brief' : data.topics === 'Events' ? 'Onlu event invites' : 'the Onlu Brief and event invites') + ". " +
        "We'll be in touch.\n\n" +
        "To unsubscribe, just reply to this email with \"unsubscribe\".\n\n" +
        "Coffee with Onlu\nhttps://coffeewithonlu.com";
    } else if (data.type === 'rsvp') {
      subject = "You're in — " + (data.event || 'Coffee with Onlu');
      body = 'Hi ' + first + ",\n\n" +
        "You're confirmed for " + (data.event || 'the coffee') + ". " +
        "We'll send the final details closer to the day.\n\n" +
        "See you there,\nCoffee with Onlu";
    } else {
      subject = "You're on the list — Coffee with Onlu";
      body = 'Hi ' + first + ",\n\n" +
        "Thanks for joining — you're on the list. We'll reach out when " +
        "there's a coffee forming for you.\n\n" +
        "Talk soon,\nCoffee with Onlu";
    }
    MailApp.sendEmail(email, subject, body, { name: 'Coffee with Onlu' });
  } catch (mailErr) {
    // ignore — the row is already saved
  }
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
