// ============================================================
// NESTERLY v2 — School Enrollment Automation System
// ============================================================
//
// FEATURES:
//   - Elementor/website webhook (no Zapier, no email parsing)
//   - Application platform CSV sync (paste export, auto-sync)
//   - Auto-sequence fires on lead entry (no button press needed)
//   - Sequence timer based on SequenceStartedAt (not LastContact)
//   - Deduplication by email
//   - Draft Nudge email for "draft" status application leads
//   - Sequence auto-stops when application is marked complete
//   - Trigger-safe functions (no ui.alert in auto-runs)
//
// SETUP ORDER:
//   1. Run setupNesterly()        → creates all sheets
//   2. Run setupEmailTemplates()  → loads starter templates
//   3. Fill in Settings tab with your school info
//   4. Run createTriggers()       → activates daily automation
//   5. (Optional) Deploy as Web App → get webhook URL
//      Deploy → New Deployment → Web App
//      Execute as: Me | Access: Anyone
//   6. Paste /exec URL into your website form's webhook
// ============================================================


// ============================================================
// SECTION 1: CONFIGURATION
// ============================================================

var CONFIG = {
  SHEET_NAMES: {
    CRM:        'Enrollment CRM',
    TEMPLATES:  'EmailTemplates',
    LOG:        'ActivityLog',
    SETTINGS:   'Settings',
    SCHOOLMINT: 'Application Import'
  },
  STAGES: {
    NEW:       'New Lead',
    ACTIVE:    'Sequence Active',
    APPLIED:   'Applied',
    DRAFT:     'Draft Started',
    RESPONDED: 'Responded',
    TOUR_SCHED:'Tour Scheduled',
    TOUR_DONE: 'Tour Completed',
    ENROLLED:  'Enrolled',
    DECLINED:  'Declined',
    COMPLETE:  'Sequence Complete',
    UNSUB:     'Unsubscribed'
  },
  SM_STATUS: {
    NOT_CHECKED: 'Not Checked',
    NO_ACTIVITY: 'No Activity',
    DRAFT:       'Draft Started',
    COMPLETE:    'Application Complete'
  },
  // Sequence steps: day=0 fires immediately on lead entry
  SEQUENCE: [
    { day: 0, template: 'Initial Response'  },
    { day: 3, template: '3-Day Follow-Up'   },
    { day: 5, template: '5-Day Social Proof' },
    { day: 7, template: '7-Day Final'        }
  ]
};


// ============================================================
// SECTION 2: SHEET SETUP
// ============================================================

function setupNesterly() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  createSheetIfNotExists(ss, CONFIG.SHEET_NAMES.CRM, [
    'Timestamp', 'ParentName', 'Email', 'Phone', 'ChildName',
    'GradeInterest', 'Source', 'Stage', 'SequenceStartedAt',
    'LastEmailSent', 'EmailsSent', 'AppStatus',
    'AppCheckedAt', 'Notes'
  ]);

  createSheetIfNotExists(ss, CONFIG.SHEET_NAMES.TEMPLATES, [
    'TemplateName', 'Subject', 'Content', 'SendDelay', 'Description'
  ]);

  createSheetIfNotExists(ss, CONFIG.SHEET_NAMES.LOG, [
    'Timestamp', 'Email', 'Action', 'Details'
  ]);

  createSheetIfNotExists(ss, CONFIG.SHEET_NAMES.SETTINGS, [
    'Setting', 'Value'
  ]);

  setupImportTab(ss);

  initDefaultSettings(ss);

  SpreadsheetApp.getUi().alert(
    'Nesterly setup complete!\n\n' +
    'Next steps:\n' +
    '1. Go to Nesterly > Load Email Templates\n' +
    '2. Fill in the Settings tab with your school info\n' +
    '3. Go to Nesterly > Create/Reset Triggers\n' +
    '4. (Optional) Deploy as Web App for webhook intake'
  );
}

function createSheetIfNotExists(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setBackground('#1a73e8')
         .setFontColor('#ffffff')
         .setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log('Created sheet: ' + name);
  }
  return sheet;
}

function initDefaultSettings(ss) {
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
  if (sheet.getLastRow() > 1) return;

  var defaults = [
    ['School Name',             '[Your School Name]'],
    ['Admin Name',              '[Your Name]'],
    ['Admin Email',             ''],
    ['Admin Phone',             ''],
    ['Admin Title',             'Admissions'],
    ['Website URL',             ''],
    ['Email Sender Name',       '[Your School Name]'],
    ['Reply To Email',          ''],
    ['Email Signature',         '[Your School Tagline]'],
    ['Brand Color',             '#1a73e8'],
    ['Brand Accent Color',      '#ffffff'],
    ['Complete Status Values',  'Complete,Submitted,Completed,Finalized'],
    ['Draft Status Values',     'Draft,In Progress,Started,Incomplete']
  ];

  defaults.forEach(function(row) { sheet.appendRow(row); });
  Logger.log('Default settings initialized');
}

function setupImportTab(ss) {
  var name = CONFIG.SHEET_NAMES.SCHOOLMINT;
  var sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  sheet = ss.insertSheet(name);

  var instructions = [
    ['APPLICATION IMPORT — Paste your export data below', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ['HOW TO USE:', '', '', '', '', ''],
    ['1. Export a CSV or spreadsheet from your application platform (SchoolMint, Ravenna, OpenApply, etc.)', '', '', '', '', ''],
    ['2. Open the exported file and copy ALL rows including the header row', '', '', '', '', ''],
    ['3. Paste starting in row 8 below (overwrite the example headers)', '', '', '', '', ''],
    ['4. Go to Nesterly > Sync Applications — the system will auto-detect your email and status columns', '', '', '', '', ''],
    ['ParentEmail', 'ApplicationStatus', 'StudentFirstName', 'StudentLastName', 'SubmittedDate', 'LastUpdated']
  ];

  sheet.getRange(1, 1, instructions.length, 6).setValues(instructions);

  sheet.getRange(1, 1, 1, 6)
    .merge()
    .setFontSize(13)
    .setFontWeight('bold')
    .setFontColor('#1a73e8')
    .setBackground('#e8f0fe');

  sheet.getRange(3, 1, 5, 6).forEach(function(cell) {});
  sheet.getRange(3, 1, 5, 1)
    .setFontColor('#555')
    .setFontStyle('italic');

  sheet.getRange(8, 1, 1, 6)
    .setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff');

  sheet.setFrozenRows(8);
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(4, 180);
  sheet.setColumnWidth(5, 150);
  sheet.setColumnWidth(6, 150);

  sheet.getRange(1, 1, instructions.length, 6).setWrap(true);

  return sheet;
}


// ============================================================
// SECTION 3: WEBHOOK ENDPOINT
// ============================================================
// After deploying as a Web App, paste the /exec URL into your
// website form builder (Elementor, Webflow, Typeform, etc.)
// as a webhook/POST action.
//
// Map your form field IDs below in the 'lead' object.
// Common field names are auto-detected (see fallback chain).
// ============================================================

function doPost(e) {
  try {
    var data;
    if (e.postData && e.postData.type === 'application/json') {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    } else {
      logActivity('webhook', 'No Data', 'Empty POST received');
      return jsonResponse({ status: 'error', message: 'No data received' });
    }

    // ── Map form field names to lead fields ──────────────
    // Handles common field naming conventions automatically
    var lead = {
      parentName:    data.parent_name   || data.parentName   || data.name         || '',
      email:        (data.email         || data.parent_email || '').toLowerCase().trim(),
      phone:         data.phone         || data.phone_number || '',
      childName:     data.child_name    || data.childName    || data.student_name  || '',
      gradeInterest: data.grade         || data.grade_interest || data.gradeInterest || '',
      source:        data.source        || 'Website'
    };

    if (!lead.email || !lead.parentName) {
      logActivity('webhook', 'Invalid Lead', 'Missing required fields: ' + JSON.stringify(data));
      return jsonResponse({ status: 'error', message: 'Missing email or parent name' });
    }

    var result = addLead(lead, true);
    return jsonResponse({ status: result.success ? 'success' : 'error', message: result.message });

  } catch (error) {
    logActivity('webhook', 'Webhook Error', error.toString());
    return jsonResponse({ status: 'error', message: error.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ============================================================
// SECTION 4: LEAD MANAGEMENT
// ============================================================

function addLead(lead, sendEmail) {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CRM);

  // Deduplication
  if (findLeadByEmail(lead.email)) {
    logActivity(lead.email, 'Duplicate Skipped', 'Lead already exists');
    return { success: false, message: 'Duplicate: ' + lead.email };
  }

  var now = new Date();

  sheet.appendRow([
    now,                              // Timestamp
    lead.parentName,                  // ParentName
    lead.email,                       // Email
    lead.phone         || '',         // Phone
    lead.childName     || '',         // ChildName
    lead.gradeInterest || '',         // GradeInterest
    lead.source        || 'Website', // Source
    CONFIG.STAGES.NEW,                // Stage
    '',                               // SequenceStartedAt (set after email)
    '',                               // LastEmailSent
    0,                                // EmailsSent
    CONFIG.SM_STATUS.NOT_CHECKED,    // AppStatus
    '',                               // AppCheckedAt
    lead.notes         || ''          // Notes
  ]);

  logActivity(lead.email, 'Lead Added', 'Source: ' + (lead.source || 'Website'));

  // Fire initial email immediately
  if (sendEmail) {
    var leadObj = {
      ParentName:    lead.parentName,
      Email:         lead.email,
      ChildName:     lead.childName,
      GradeInterest: lead.gradeInterest
    };

    var sent = sendSequenceEmail(leadObj, 'Initial Response');

    if (sent) {
      updateLeadField(lead.email, 'Stage',              CONFIG.STAGES.ACTIVE);
      updateLeadField(lead.email, 'SequenceStartedAt',  now);
      updateLeadField(lead.email, 'LastEmailSent',      now);
      updateLeadField(lead.email, 'EmailsSent',         1);
    }
  }

  return { success: true, message: 'Lead added: ' + lead.email };
}

function findLeadByEmail(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.SHEET_NAMES.CRM);
  var data     = sheet.getDataRange().getValues();
  var headers  = data[0];
  var emailCol = headers.indexOf('Email');

  for (var i = 1; i < data.length; i++) {
    if (data[i][emailCol] &&
        data[i][emailCol].toString().toLowerCase() === email.toLowerCase()) {
      return { row: i + 1, data: data[i], headers: headers };
    }
  }
  return null;
}

function updateLeadField(email, field, value) {
  var sheet    = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.SHEET_NAMES.CRM);
  var data     = sheet.getDataRange().getValues();
  var headers  = data[0];
  var emailCol = headers.indexOf('Email');
  var fieldCol = headers.indexOf(field);

  if (fieldCol === -1) return;

  for (var i = 1; i < data.length; i++) {
    if (data[i][emailCol] &&
        data[i][emailCol].toString().toLowerCase() === email.toLowerCase()) {
      sheet.getRange(i + 1, fieldCol + 1).setValue(value);
      return;
    }
  }
}


// ============================================================
// SECTION 5: SEQUENCE ENGINE
// ============================================================
// Runs daily via time trigger — NO ui.alert calls (trigger-safe)
// Timing based on SequenceStartedAt, not LastContact

function runDailySequence() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(CONFIG.SHEET_NAMES.CRM);
  var leads = getSheetData(sheet);
  var today = new Date();
  var sent  = 0;
  var stopped = 0;

  leads.forEach(function(lead) {

    // Only process active sequences
    if (lead.Stage !== CONFIG.STAGES.ACTIVE) return;

    // Stop sequence if application is complete
    if (lead.AppStatus === CONFIG.SM_STATUS.COMPLETE) {
      updateLeadField(lead.Email, 'Stage', CONFIG.STAGES.APPLIED);
      logActivity(lead.Email, 'Sequence Stopped', 'Application marked complete');
      stopped++;
      return;
    }

    // Validate sequence start date
    if (!lead.SequenceStartedAt) return;
    var startDate       = new Date(lead.SequenceStartedAt);
    var daysSinceStart  = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    var emailsSentSoFar = parseInt(lead.EmailsSent) || 0;

    // Find the next step that should fire
    // Step index 0 is day-0 (already sent at lead entry), skip it
    // Uses >= so a missed trigger day still fires on the next run
    var stepToSend = null;
    var stepIndex  = -1;
    for (var i = 1; i < CONFIG.SEQUENCE.length; i++) {
      var step = CONFIG.SEQUENCE[i];
      if (daysSinceStart >= step.day && emailsSentSoFar < i + 1) {
        stepToSend = step;
        stepIndex  = i;
        break;
      }
    }

    if (!stepToSend) return;

    // If draft detected on day-3 step, swap template for Draft Nudge
    var templateName = stepToSend.template;
    if (lead.AppStatus === CONFIG.SM_STATUS.DRAFT && stepToSend.day === 3) {
      templateName = 'Draft Nudge';
    }

    var success = sendSequenceEmail(lead, templateName);

    if (success) {
      updateLeadField(lead.Email, 'LastEmailSent', today);
      updateLeadField(lead.Email, 'EmailsSent',    emailsSentSoFar + 1);

      // Mark sequence complete after final step
      if (stepIndex === CONFIG.SEQUENCE.length - 1) {
        updateLeadField(lead.Email, 'Stage', CONFIG.STAGES.COMPLETE);
      }
      sent++;
    }
  });

  logActivity('system', 'Daily Sequence Run',
    'Date: ' + today.toDateString() +
    ' | Sent: ' + sent +
    ' | Auto-stopped: ' + stopped);
}


// ============================================================
// SECTION 6: APPLICATION SYNC
// ============================================================
// 1. Export data from your application platform (SchoolMint, Ravenna, OpenApply, etc.)
// 2. Paste into the 'Application Import' tab (starting at row 8)
// 3. Run syncApplications() from the Nesterly menu
//    The system auto-detects email and status columns from your headers.

function syncApplications() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var sheet   = ss.getSheetByName(CONFIG.SHEET_NAMES.SCHOOLMINT);

  if (!sheet || sheet.getLastRow() < 9) {
    logActivity('system', 'App Sync', 'No data found in Application Import tab');
    try { SpreadsheetApp.getUi().alert('No data found.\n\nPaste your exported application data into the "Application Import" tab starting at row 8, then try again.'); } catch(e) {}
    return;
  }

  var allData = sheet.getDataRange().getValues();
  var headers = allData[7];
  var rows    = allData.slice(8);

  if (rows.length === 0) {
    try { SpreadsheetApp.getUi().alert('No data rows found below the header row (row 8).\n\nPaste your export starting at row 8.'); } catch(e) {}
    return;
  }

  var emailColIdx  = detectColumn(headers, ['email', 'e-mail', 'parent_email', 'parentemail', 'parent email', 'guardian_email', 'contact_email']);
  var statusColIdx = detectColumn(headers, ['status', 'application_status', 'applicationstatus', 'app_status', 'appstatus', 'application status']);

  if (emailColIdx === -1) {
    try { SpreadsheetApp.getUi().alert('Could not find an email column.\n\nMake sure your pasted data has a header containing "Email" in row 8.'); } catch(e) {}
    return;
  }

  if (statusColIdx === -1) {
    try { SpreadsheetApp.getUi().alert('Could not find a status column.\n\nMake sure your pasted data has a header containing "Status" in row 8.\n\nIf your export doesn\'t have a status column, add one manually.'); } catch(e) {}
    return;
  }

  var completeVals = (getSetting('Complete Status Values') || 'Complete,Submitted,Completed,Finalized')
    .split(',').map(function(s) { return s.trim().toLowerCase(); });
  var draftVals = (getSetting('Draft Status Values') || 'Draft,In Progress,Started,Incomplete')
    .split(',').map(function(s) { return s.trim().toLowerCase(); });

  var updated  = 0;
  var notFound = 0;
  var skipped  = 0;

  rows.forEach(function(row) {
    var email  = row[emailColIdx]  ? row[emailColIdx].toString().toLowerCase().trim()  : '';
    var status = row[statusColIdx] ? row[statusColIdx].toString().toLowerCase().trim() : '';

    if (!email) { skipped++; return; }

    var newStatus;
    if (completeVals.indexOf(status) > -1) {
      newStatus = CONFIG.SM_STATUS.COMPLETE;
    } else if (draftVals.indexOf(status) > -1) {
      newStatus = CONFIG.SM_STATUS.DRAFT;
    } else {
      newStatus = CONFIG.SM_STATUS.NO_ACTIVITY;
    }

    var existing = findLeadByEmail(email);
    if (existing) {
      updateLeadField(email, 'AppStatus',    newStatus);
      updateLeadField(email, 'AppCheckedAt', new Date());

      if (newStatus === CONFIG.SM_STATUS.COMPLETE) {
        updateLeadField(email, 'Stage', CONFIG.STAGES.APPLIED);
        logActivity(email, 'Application Complete', 'Detected via application import');
      } else if (newStatus === CONFIG.SM_STATUS.DRAFT) {
        logActivity(email, 'Draft Detected', 'Application started but not completed');
      }
      updated++;
    } else {
      notFound++;
    }
  });

  var msg = 'Sync complete!\n\n' +
    'Matched & updated: ' + updated + '\n' +
    'Not in CRM: ' + notFound +
    (skipped > 0 ? '\nSkipped (no email): ' + skipped : '');

  logActivity('system', 'App Sync',
    'Updated: ' + updated + ' | Not in CRM: ' + notFound + ' | Skipped: ' + skipped +
    ' | Email col: ' + headers[emailColIdx] + ' | Status col: ' + headers[statusColIdx]);

  try { SpreadsheetApp.getUi().alert(msg); } catch(e) {}
}

function detectColumn(headers, patterns) {
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i].toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    for (var j = 0; j < patterns.length; j++) {
      var p = patterns[j].replace(/[^a-z0-9]/g, '');
      if (h === p || h.indexOf(p) > -1) return i;
    }
  }
  return -1;
}

// Keep old function name as alias for backwards compatibility
function reconcileSchoolMint() { syncApplications(); }


// ============================================================
// SECTION 7: EMAIL ENGINE
// ============================================================

function sendSequenceEmail(lead, templateName) {
  try {
    var ss             = SpreadsheetApp.getActiveSpreadsheet();
    var templatesSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TEMPLATES);
    var templates      = getSheetData(templatesSheet);

    var template = templates.find(function(t) {
      return t.TemplateName === templateName;
    });

    if (!template) {
      logActivity(lead.Email, 'Email Error', 'Template not found: ' + templateName);
      return false;
    }

    var settings = getAllSettings();

    var tokens = {
      ParentName:    lead.ParentName    || lead.parentName    || '',
      ChildName:     lead.ChildName     || lead.childName     || '',
      GradeInterest: lead.GradeInterest || lead.gradeInterest || '',
      SchoolName:    settings['School Name']    || '',
      AdminName:     settings['Admin Name']     || '',
      AdminPhone:    settings['Admin Phone']    || '',
      AdminTitle:    settings['Admin Title']    || '',
      WebsiteURL:    settings['Website URL']    || ''
    };

    var subject   = replaceTokens(template.Subject, tokens);
    var plainText = replaceTokens(template.Content,  tokens);
    var htmlBody  = formatEmailHTML(plainText, settings);

    var replyTo = settings['Reply To Email'] || '';
    if (!replyTo) {
      try { replyTo = Session.getActiveUser().getEmail(); } catch(e) {}
    }

    var emailOptions = {
      name:     settings['Email Sender Name'] || settings['School Name'] || '',
      htmlBody: htmlBody
    };
    if (replyTo) emailOptions.replyTo = replyTo;

    GmailApp.sendEmail(lead.Email, subject, plainText, emailOptions);

    logActivity(lead.Email, 'Email Sent', 'Template: ' + templateName);
    return true;

  } catch (error) {
    logActivity(lead.Email || 'unknown', 'Email Error', templateName + ': ' + error.toString());
    return false;
  }
}

function replaceTokens(text, data) {
  if (!text) return '';
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, function(match, key) {
    return data[key] !== undefined ? data[key] : match;
  });
}

function formatEmailHTML(content, settings) {
  var brandColor  = (settings && settings['Brand Color'])        || '#1a73e8';
  var accentColor = (settings && settings['Brand Accent Color']) || '#ffffff';
  var schoolName  = (settings && settings['School Name'])        || '';
  var signature   = (settings && settings['Email Signature'])    || '';

  var html = '';

  html += '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">';

  if (schoolName) {
    html += '<div style="background:' + brandColor + ';padding:16px 24px;">';
    html += '<span style="color:' + accentColor + ';font-weight:bold;font-size:18px;letter-spacing:1px;">' + schoolName + '</span>';
    html += '</div>';
  }

  html += '<div style="padding:20px 24px;line-height:1.7;">';
  content.split('\n').forEach(function(line) {
    if (line.trim() === '') {
      html += '<br>';
    } else if (line.trim().charAt(0) === '•' || line.trim().charAt(0) === '*') {
      html += '<p style="margin:4px 0;padding-left:14px;">&#8226;' + line.trim().substring(1) + '</p>';
    } else {
      html += '<p style="margin:6px 0;">' + line + '</p>';
    }
  });
  html += '</div>';

  if (schoolName || signature) {
    html += '<div style="border-top:3px solid ' + brandColor + ';padding:14px 24px;background:#f7f7f7;color:#555;font-size:12px;">';
    if (schoolName) html += '<strong style="color:' + brandColor + ';">' + schoolName + '</strong><br>';
    if (signature)  html += '<em>' + signature + '</em>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}


// ============================================================
// SECTION 8: EMAIL TEMPLATES
// ============================================================

function setupEmailTemplates() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TEMPLATES);

  if (!sheet) {
    sheet = createSheetIfNotExists(ss, CONFIG.SHEET_NAMES.TEMPLATES, [
      'TemplateName', 'Subject', 'Content', 'SendDelay', 'Description'
    ]);
  }

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);

  var templates = [

    // ── 1. Initial Response (Day 0 — fires immediately) ─────
    {
      name:    'Initial Response',
      subject: 'We got your info, {ParentName} — here\'s what\'s next',
      delay:   0,
      desc:    'Sent immediately when lead enters the system',
      content: [
        'Hi {ParentName},',
        '',
        'Thanks for your interest in {SchoolName}! My name is {AdminName}, and I\'m excited to help you and {ChildName} learn more about what we offer.',
        '',
        'Do you have any questions right now I can help with? I\'d love to invite you both for a tour so you can see everything for yourself.',
        '',
        'Want to visit? Reply to this email or call us at {AdminPhone}.',
        '',
        'Best,',
        '{AdminName}',
        '{AdminTitle}',
        '{SchoolName}',
        '{AdminPhone}'
      ].join('\n')
    },

    // ── 2. 3-Day Follow-Up ───────────────────────────────────
    {
      name:    '3-Day Follow-Up',
      subject: 'Still here when you\'re ready, {ParentName}',
      delay:   3,
      desc:    'Sent 3 days after initial response if no application activity',
      content: [
        'Hi {ParentName},',
        '',
        'Just making sure my first message didn\'t land in spam.',
        '',
        'A spot for {ChildName} is still open. Enrollment moves fast and we want to make sure you have the full picture before you decide.',
        '',
        'If you have questions, reply here. If you want to see the school, I\'ll make sure the visit is worth the trip.',
        '',
        '{AdminName}',
        '{SchoolName}',
        '{AdminPhone}'
      ].join('\n')
    },

    // ── 3. Draft Nudge (fires instead of 3-Day if draft detected) ─
    {
      name:    'Draft Nudge',
      subject: '{ChildName} is one step away — don\'t let the draft expire',
      delay:   3,
      desc:    'Replaces 3-Day Follow-Up when application status shows a draft',
      content: [
        'Hi {ParentName},',
        '',
        'We can see {ChildName}\'s application was started — you\'re one step away from locking in a spot.',
        '',
        'Draft applications don\'t hold a seat. We want {ChildName} here, but we can only hold spots for completed submissions.',
        '',
        'If something stopped you mid-process — a technical issue, a question you didn\'t have an answer to, anything — reply here and I\'ll help you get it done today.',
        '',
        '{AdminName}',
        '{SchoolName}',
        '{AdminPhone}'
      ].join('\n')
    },

    // ── 4. 5-Day Social Proof ────────────────────────────────
    {
      name:    '5-Day Social Proof',
      subject: 'See what families are saying about {SchoolName}',
      delay:   5,
      desc:    'Sent 5 days after initial contact if no application activity',
      content: [
        'Hi {ParentName},',
        '',
        'I\'ll keep this one short.',
        '',
        'Families who visit us and see what we\'ve built tend to stay. That\'s not a marketing line — those are real families who showed up, looked around, and decided this was the right fit.',
        '',
        'Here\'s what they found:',
        '',
        '• A school that puts students first',
        '• Staff who care about every child\'s growth',
        '• Programs that go beyond the classroom',
        '',
        'We\'d love {ChildName} to be part of what comes next.',
        '',
        'Tour is still open. Reply here.',
        '',
        '{AdminName}',
        '{SchoolName}',
        '{AdminPhone}'
      ].join('\n')
    },

    // ── 5. 7-Day Final ───────────────────────────────────────
    {
      name:    '7-Day Final',
      subject: 'Last one from us, {ParentName}',
      delay:   7,
      desc:    'Final follow-up — sequence ends after this',
      content: [
        'Hi {ParentName},',
        '',
        'This is the last email in our sequence. We don\'t believe in flooding inboxes.',
        '',
        'If the timing isn\'t right for {ChildName} this enrollment cycle — no problem. The door stays open.',
        '',
        'And if there\'s something specific that made you hesitate — a question we didn\'t answer, a concern about fit, anything — reply and I\'ll be straight with you.',
        '',
        '{AdminName}',
        '{SchoolName}',
        '{AdminPhone}'
      ].join('\n')
    }

  ];

  templates.forEach(function(t) {
    sheet.appendRow([t.name, t.subject, t.content, t.delay, t.desc]);
  });

  sheet.autoResizeColumns(1, 5);
  try { SpreadsheetApp.getUi().alert('5 email templates loaded. Customize them in the EmailTemplates tab.'); } catch(e) {}
}


// ============================================================
// SECTION 9: TRIGGERS
// ============================================================

function createTriggers() {
  // Remove existing Nesterly triggers
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runDailySequence') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Daily sequence check at 9am
  ScriptApp.newTrigger('runDailySequence')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  logActivity('system', 'Triggers Created', 'runDailySequence at 9am daily');

  try {
    SpreadsheetApp.getUi().alert(
      'Triggers active.\n\n' +
      'Sequence runs daily at 9am.\n\n' +
      'Application sync is manual — run it from the menu after each CSV export.'
    );
  } catch(e) {}
}


// ============================================================
// SECTION 10: MENU & MANUAL ACTIONS
// ============================================================

function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().addMenu('Nesterly', [
    { name: 'Add New Lead',              functionName: 'showNewLeadForm'       },
    { name: 'Sync Applications',          functionName: 'syncApplications'      },
    { name: 'Run Sequence Now (test)',   functionName: 'runDailySequence'      },
    { name: 'Go to Activity Log',       functionName: 'openActivityLog'       },
    { name: '────────────────',         functionName: 'noop'                  },
    { name: 'Setup Sheets',             functionName: 'setupNesterly'         },
    { name: 'Load Email Templates',     functionName: 'setupEmailTemplates'   },
    { name: 'Create/Reset Triggers',    functionName: 'createTriggers'        },
    { name: 'Get Webhook URL',          functionName: 'showWebhookUrl'        }
  ]);
}

function noop() {}

function openActivityLog() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.LOG);
  ss.setActiveSheet(sheet);
}

function showWebhookUrl() {
  var url = '';
  try { url = ScriptApp.getService().getUrl(); } catch(e) {}
  SpreadsheetApp.getUi().alert(
    'Your Webhook URL\n\n' +
    (url || 'Not deployed yet.\n\nGo to:\nDeploy → New Deployment → Web App\nExecute as: Me | Access: Anyone\n\nThen come back here.') +
    (url ? '\n\nPaste this URL into your website form builder\'s webhook/POST action.' : '')
  );
}

function showNewLeadForm() {
  var brandColor = getSetting('Brand Color') || '#1a73e8';

  var html = HtmlService.createHtmlOutput(
    '<style>' +
    'body{font-family:Arial,sans-serif;padding:16px;font-size:13px;}' +
    'label{display:block;margin-bottom:10px;font-weight:500;}' +
    'input,select,textarea{width:100%;padding:8px;border:1px solid #ccc;border-radius:4px;' +
    '  margin-top:3px;box-sizing:border-box;font-size:13px;}' +
    'input:focus,select:focus,textarea:focus{outline:none;border-color:' + brandColor + ';}' +
    'button{background:' + brandColor + ';color:#fff;padding:10px 20px;border:none;' +
    '  border-radius:4px;cursor:pointer;font-weight:bold;width:100%;margin-top:10px;font-size:13px;}' +
    'button:disabled{opacity:0.6;cursor:not-allowed;}' +
    '</style>' +
    '<form onsubmit="submitForm(this);return false;">' +
    '<label>Parent Name *<input type="text"  name="parentName"    required></label>' +
    '<label>Email *       <input type="email" name="email"         required></label>' +
    '<label>Phone         <input type="tel"   name="phone"></label>' +
    '<label>Child\'s Name  <input type="text"  name="childName"></label>' +
    '<label>Grade Interest' +
    '  <input type="text" name="gradeInterest" placeholder="e.g. 9th Grade">' +
    '</label>' +
    '<label>Source' +
    '  <select name="source">' +
    '    <option>Website</option><option>Referral</option>' +
    '    <option>Social Media</option><option>Open House</option><option>Other</option>' +
    '  </select>' +
    '</label>' +
    '<label>Notes<textarea name="notes" rows="2"></textarea></label>' +
    '<button id="btn" type="submit">Add Lead + Send Welcome Email</button>' +
    '</form>' +
    '<script>' +
    'function submitForm(f){' +
    '  var btn=document.getElementById("btn");' +
    '  btn.disabled=true;btn.textContent="Sending...";' +
    '  google.script.run' +
    '    .withSuccessHandler(function(r){' +
    '      if(r.success){google.script.host.close();}' +
    '      else{alert("Error: "+r.message);btn.disabled=false;btn.textContent="Add Lead + Send Welcome Email";}' +
    '    })' +
    '    .withFailureHandler(function(e){' +
    '      alert("Error: "+e.message);btn.disabled=false;btn.textContent="Add Lead + Send Welcome Email";' +
    '    })' +
    '    .addLeadFromForm(f);' +
    '}' +
    '</script>'
  ).setWidth(390).setHeight(500).setTitle('Add New Lead');

  SpreadsheetApp.getUi().showModalDialog(html, 'Add New Lead');
}

function addLeadFromForm(formData) {
  return addLead({
    parentName:    formData.parentName,
    email:         formData.email,
    phone:         formData.phone,
    childName:     formData.childName,
    gradeInterest: formData.gradeInterest,
    source:        formData.source,
    notes:         formData.notes
  }, true);
}


// ============================================================
// SECTION 11: UTILITIES
// ============================================================

function getSheetData(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1)
    .filter(function(row) { return row.some(function(cell) { return cell !== ''; }); })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    });
}

function logActivity(email, action, details) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.LOG);
  if (!sheet) return;
  sheet.appendRow([new Date(), email, action, details || '']);
}

function getAllSettings() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('nesterly_settings');
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
  if (!sheet) return {};
  var data  = getSheetData(sheet);
  var map   = {};
  data.forEach(function(row) {
    if (row.Setting) map[row.Setting] = row.Value || '';
  });

  try { cache.put('nesterly_settings', JSON.stringify(map), 300); } catch(e) {}
  return map;
}

function getSetting(name) {
  var all = getAllSettings();
  return all[name] || null;
}

