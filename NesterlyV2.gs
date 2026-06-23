// ============================================================
// NESTERLY v2 — Innovation Charter High School
// Enrollment Automation System
// ============================================================
//
// WHAT'S NEW IN v2:
//   ✅ Elementor → direct webhook (no Zapier, no email parsing)
//   ✅ SchoolMint CSV reconciliation (paste export → auto-sync)
//   ✅ Auto-sequence fires on lead entry — no button press needed
//   ✅ Sequence timer based on SequenceStartedAt (not LastContact)
//   ✅ Deduplication by email
//   ✅ Draft Nudge email for SchoolMint "draft" status leads
//   ✅ Sequence auto-stops when application is marked complete
//   ✅ Fixed trigger-safe functions (no ui.alert in auto-runs)
//   ✅ No duplicate function declarations
//   ✅ ICHS brand-aligned email templates
//
// SETUP ORDER:
//   1. Run setupNesterly()        → creates all sheets
//   2. Run setupEmailTemplates()  → loads ICHS templates
//   3. Run createTriggers()       → activates daily automation
//   4. Deploy as Web App         → get webhook URL for Elementor
//      Deploy → New Deployment → Web App
//      Execute as: Me | Access: Anyone
//   5. Paste /exec URL into Elementor:
//      Actions After Submit → Webhook → URL
//   6. Fill in Settings tab with your school info
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
    SCHOOLMINT: 'SchoolMint Import'
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
    'LastEmailSent', 'EmailsSent', 'SchoolMintStatus',
    'SchoolMintCheckedAt', 'Notes'
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

  createSheetIfNotExists(ss, CONFIG.SHEET_NAMES.SCHOOLMINT, [
    'StudentFirstName', 'StudentLastName', 'ParentEmail',
    'ApplicationStatus', 'SubmittedDate', 'LastUpdated'
  ]);

  initDefaultSettings(ss);

  SpreadsheetApp.getUi().alert(
    '✅ Nesterly v2 setup complete!\n\n' +
    'Next steps:\n' +
    '1. Run: setupEmailTemplates()\n' +
    '2. Run: createTriggers()\n' +
    '3. Deploy as Web App → get webhook URL\n' +
    '4. Fill in the Settings tab with your info'
  );
}

function createSheetIfNotExists(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setBackground('#11392E')
         .setFontColor('#A2FF57')
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
    ['School Name',             'Innovation Charter High School'],
    ['Admin Name',              'Xavier'],
    ['Admin Email',             ''],
    ['Admin Phone',             ''],
    ['Website URL',             ''],
    ['Email Sender Name',       'Innovation Charter High School'],
    ['Reply To Email',          ''],
    ['Email Signature',         'Grounded in Purpose. Growing in Practice.'],
    ['SchoolMint Email Column', 'ParentEmail'],
    ['SchoolMint Status Column','ApplicationStatus'],
    ['Complete Status Values',  'Complete,Submitted,Completed,Finalized'],
    ['Draft Status Values',     'Draft,In Progress,Started,Incomplete']
  ];

  defaults.forEach(function(row) { sheet.appendRow(row); });
  Logger.log('Default settings initialized');
}


// ============================================================
// SECTION 3: WEBHOOK ENDPOINT (replaces Zapier entirely)
// ============================================================
// After deploying as a Web App, paste the /exec URL into
// Elementor: Actions After Submit → Webhook → URL
// Elementor sends form data as JSON or form-encoded POST.
//
// Map your Elementor field IDs below in the 'lead' object.
// To find field IDs: Elementor editor → form field → Advanced → ID
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

    // ── Map Elementor field IDs to lead fields ──────────────
    // Update the keys on the RIGHT to match your Elementor field IDs
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
    CONFIG.SM_STATUS.NOT_CHECKED,    // SchoolMintStatus
    '',                               // SchoolMintCheckedAt
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
    if (lead.SchoolMintStatus === CONFIG.SM_STATUS.COMPLETE) {
      updateLeadField(lead.Email, 'Stage', CONFIG.STAGES.APPLIED);
      logActivity(lead.Email, 'Sequence Stopped', 'Application complete in SchoolMint');
      stopped++;
      return;
    }

    // Validate sequence start date
    if (!lead.SequenceStartedAt) return;
    var startDate       = new Date(lead.SequenceStartedAt);
    var daysSinceStart  = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    var emailsSentSoFar = parseInt(lead.EmailsSent) || 0;

    // Find the step that should fire today
    // Step index 0 is day-0 (already sent at lead entry), skip it
    var stepToSend = null;
    for (var i = 1; i < CONFIG.SEQUENCE.length; i++) {
      var step = CONFIG.SEQUENCE[i];
      if (step.day === daysSinceStart && emailsSentSoFar < i + 1) {
        stepToSend = step;
        break;
      }
    }

    if (!stepToSend) return;

    // If draft detected on day-3, swap template for Draft Nudge
    var templateName = stepToSend.template;
    if (lead.SchoolMintStatus === CONFIG.SM_STATUS.DRAFT && stepToSend.day === 3) {
      templateName = 'Draft Nudge';
    }

    var success = sendSequenceEmail(lead, templateName);

    if (success) {
      updateLeadField(lead.Email, 'LastEmailSent', today);
      updateLeadField(lead.Email, 'EmailsSent',    emailsSentSoFar + 1);

      // Mark sequence complete after final email
      if (stepToSend.day === 7) {
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
// SECTION 6: SCHOOLMINT RECONCILIATION
// ============================================================
// 1. Export your SchoolMint data as CSV
// 2. Paste it into the 'SchoolMint Import' tab
//    (column headers must include ParentEmail + ApplicationStatus
//     or update the Settings tab to match your export's column names)
// 3. Run reconcileSchoolMint() from the menu
//    — or it can run on a trigger if you add it in createTriggers()

function reconcileSchoolMint() {
  var ss       = SpreadsheetApp.getActiveSpreadsheet();
  var smSheet  = ss.getSheetByName(CONFIG.SHEET_NAMES.SCHOOLMINT);
  var smData   = getSheetData(smSheet);

  if (smData.length === 0) {
    logActivity('system', 'SchoolMint Reconcile', 'Import tab is empty — nothing to reconcile');
    try { SpreadsheetApp.getUi().alert('SchoolMint Import tab is empty. Paste your CSV export there first.'); } catch(e) {}
    return;
  }

  // Read column name mappings from Settings
  var emailCol     = getSetting('SchoolMint Email Column')  || 'ParentEmail';
  var statusCol    = getSetting('SchoolMint Status Column') || 'ApplicationStatus';
  var completeVals = (getSetting('Complete Status Values')  || 'Complete,Submitted')
    .split(',').map(function(s) { return s.trim().toLowerCase(); });
  var draftVals    = (getSetting('Draft Status Values')     || 'Draft,In Progress')
    .split(',').map(function(s) { return s.trim().toLowerCase(); });

  var updated  = 0;
  var notFound = 0;

  smData.forEach(function(smRow) {
    var email  = smRow[emailCol]  ? smRow[emailCol].toString().toLowerCase().trim()  : '';
    var status = smRow[statusCol] ? smRow[statusCol].toString().toLowerCase().trim() : '';

    if (!email) return;

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
      updateLeadField(email, 'SchoolMintStatus',    newStatus);
      updateLeadField(email, 'SchoolMintCheckedAt', new Date());

      if (newStatus === CONFIG.SM_STATUS.COMPLETE) {
        updateLeadField(email, 'Stage', CONFIG.STAGES.APPLIED);
        logActivity(email, 'Application Complete', 'Detected via SchoolMint import');
      } else if (newStatus === CONFIG.SM_STATUS.DRAFT) {
        logActivity(email, 'Draft Detected', 'Application started but not completed');
      }
      updated++;
    } else {
      notFound++;
    }
  });

  var msg = 'Reconciliation complete.\nUpdated: ' + updated + '\nNot in CRM: ' + notFound;
  logActivity('system', 'SchoolMint Reconcile', msg.replace(/\n/g, ' | '));

  try { SpreadsheetApp.getUi().alert('✅ ' + msg); } catch(e) {}
}


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

    var tokens = {
      ParentName:    lead.ParentName    || lead.parentName    || '',
      ChildName:     lead.ChildName     || lead.childName     || '',
      GradeInterest: lead.GradeInterest || lead.gradeInterest || '',
      SchoolName:    getSetting('School Name')       || 'Innovation Charter High School',
      AdminName:     getSetting('Admin Name')        || 'Xavier',
      AdminPhone:    getSetting('Admin Phone')       || '',
      WebsiteURL:    getSetting('Website URL')       || ''
    };

    var subject   = replaceTokens(template.Subject, tokens);
    var plainText = replaceTokens(template.Content,  tokens);
    var htmlBody  = formatEmailHTML(plainText);

    GmailApp.sendEmail(
      lead.Email,
      subject,
      plainText,
      {
        name:      getSetting('Email Sender Name') || 'Innovation Charter High School',
        htmlBody:  htmlBody,
        replyTo:   getSetting('Reply To Email')    || Session.getActiveUser().getEmail()
      }
    );

    logActivity(lead.Email, 'Email Sent', 'Template: ' + templateName);
    return true;

  } catch (error) {
    logActivity(lead.Email, 'Email Error', templateName + ': ' + error.toString());
    return false;
  }
}

function replaceTokens(text, data) {
  if (!text) return '';
  return text
    .replace(/\{ParentName\}/g,    data.ParentName)
    .replace(/\{ChildName\}/g,     data.ChildName)
    .replace(/\{GradeInterest\}/g, data.GradeInterest)
    .replace(/\{SchoolName\}/g,    data.SchoolName)
    .replace(/\{AdminName\}/g,     data.AdminName)
    .replace(/\{AdminPhone\}/g,    data.AdminPhone)
    .replace(/\{WebsiteURL\}/g,    data.WebsiteURL);
}

function formatEmailHTML(content) {
  var html = '';

  // ICHS branded header
  html += '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">';
  html += '<div style="background:#11392E;padding:16px 24px;">';
  html += '<span style="color:#A2FF57;font-weight:bold;font-size:18px;letter-spacing:1px;">ICHS</span>';
  html += '<span style="color:#ffffff;font-size:12px;margin-left:10px;opacity:0.8;">Innovation Charter High School</span>';
  html += '</div>';

  // Body
  html += '<div style="padding:20px 24px;line-height:1.7;">';
  content.split('\n').forEach(function(line) {
    if (line.trim() === '') {
      html += '<br>';
    } else if (line.trim().startsWith('•')) {
      html += '<p style="margin:4px 0;padding-left:14px;">&#8226;' + line.trim().substring(1) + '</p>';
    } else {
      html += '<p style="margin:6px 0;">' + line + '</p>';
    }
  });
  html += '</div>';

  // ICHS branded footer
  html += '<div style="border-top:3px solid #A2FF57;padding:14px 24px;background:#f7f7f7;color:#555;font-size:12px;">';
  html += '<strong style="color:#11392E;">Innovation Charter High School</strong><br>';
  html += '<em>Grounded in Purpose. Growing in Practice.</em>';
  html += '</div></div>';

  return html;
}


// ============================================================
// SECTION 8: EMAIL TEMPLATES — ICHS Brand Voice
// ============================================================

function setupEmailTemplates() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TEMPLATES);

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
        'thanks for taking a look at our school, my name is Xavier, and I\'m excited to help you and {ChildName} learn more about what we offer here at Innovation Charter High School.',
        '',
        'Do you have any questions right now I can help you with? I\'d love to invite you both for a tour so you can see everything for yourself!',
        '',
        'Want to visit? Reply to this email or call us at (212) 722-5871',
        '',
        '• Ready to apply? Fill out or complete your application here: https://bit.ly/Inno-ApplyNow',
        'Best',
        '{AdminName}',
        'Brand & Systems Manager',
        'Innovation Charter High School',
        '{AdminPhone}',
        'P.S. Did you know? 97% of our students graduate with a clear plan for what comes next. Did YOU know exactly what you were doing after high school?'
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
        'Innovation Charter High School',
        '{AdminPhone}'
      ].join('\n')
    },

    // ── 3. Draft Nudge (fires instead of 3-Day if draft detected) ─
    {
      name:    'Draft Nudge',
      subject: '{ChildName} is one step away — don\'t let the draft expire',
      delay:   3,
      desc:    'Replaces 3-Day Follow-Up when SchoolMint shows a draft application',
      content: [
        'Hi {ParentName},',
        '',
        'We can see {ChildName}\'s application was started — you\'re one step away from locking in a spot.',
        '',
        'Draft applications don\'t hold a seat. We want {ChildName} here, but we can only hold spots for completed submissions.',
        '',
        'If something stopped you mid-process — a technical issue, a question you didn\'t have an answer to, anything — reply here and I\'ll help you get it done today.',
        '',
        'Warriors don\'t leave things unfinished.',
        '',
        '{AdminName}',
        'Innovation Charter High School',
        '{AdminPhone}'
      ].join('\n')
    },

    // ── 4. 5-Day Social Proof ────────────────────────────────
    {
      name:    '5-Day Social Proof',
      subject: 'What Warriors are actually doing at ICHS',
      delay:   5,
      desc:    'Sent 5 days after initial contact if no application activity',
      content: [
        'Hi {ParentName},',
        '',
        'I\'ll keep this one short.',
        '',
        'Our application completion rate went from 32% to 72% last year. That\'s not a marketing stat — those are families who showed up, saw what we built, and decided this was the right place.',
        '',
        'Here\'s what they found:',
        '',
        '• A school with systems that actually work — built in-house because off-the-shelf wasn\'t good enough',
        '• Staff who show up because the culture holds, not because they have to',
        '• Programs that go beyond the classroom — media production, entrepreneurship, athletics, design',
        '',
        'We\'d love {ChildName} to be part of what comes next.',
        '',
        'Tour is still open. Reply here.',
        '',
        '{AdminName}',
        'Innovation Charter High School',
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
        'Warriors don\'t leave things unresolved.',
        '',
        '{AdminName}',
        'Innovation Charter High School',
        '{AdminPhone}'
      ].join('\n')
    }

  ];

  templates.forEach(function(t) {
    sheet.appendRow([t.name, t.subject, t.content, t.delay, t.desc]);
  });

  sheet.autoResizeColumns(1, 5);
  SpreadsheetApp.getUi().alert('✅ 5 ICHS-branded email templates loaded.');
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
      '✅ Triggers active.\n\n' +
      'Sequence runs daily at 9am.\n\n' +
      'SchoolMint reconciliation is manual — run it from the menu after each CSV export.'
    );
  } catch(e) {}
}


// ============================================================
// SECTION 10: MENU & MANUAL ACTIONS
// ============================================================

function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().addMenu('⚔️ Nesterly', [
    { name: '➕ Add New Lead',              functionName: 'showNewLeadForm'       },
    { name: '📥 Reconcile SchoolMint',       functionName: 'reconcileSchoolMint'   },
    { name: '▶️ Run Sequence Now (test)',     functionName: 'runDailySequence'      },
    { name: '📋 Go to Activity Log',         functionName: 'openActivityLog'       },
    { name: '────────────────',              functionName: 'noop'                  },
    { name: '⚙️  Setup Sheets',              functionName: 'setupNesterly'         },
    { name: '📧 Load Email Templates',       functionName: 'setupEmailTemplates'   },
    { name: '🔁 Create/Reset Triggers',      functionName: 'createTriggers'        },
    { name: '🌐 Get Webhook URL',            functionName: 'showWebhookUrl'        }
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
    '🌐 Your Webhook URL\n\n' +
    (url || '⚠️ Not deployed yet.\n\nGo to:\nDeploy → New Deployment → Web App\nExecute as: Me | Access: Anyone\n\nThen come back here.') +
    (url ? '\n\nPaste into Elementor:\nActions After Submit → Webhook → URL' : '')
  );
}

function showNewLeadForm() {
  var html = HtmlService.createHtmlOutput(
    '<style>' +
    'body{font-family:Arial,sans-serif;padding:16px;font-size:13px;}' +
    'label{display:block;margin-bottom:10px;}' +
    'input,select,textarea{width:100%;padding:7px;border:1px solid #ccc;border-radius:4px;' +
    '  margin-top:3px;box-sizing:border-box;font-size:13px;}' +
    'button{background:#11392E;color:#A2FF57;padding:10px 20px;border:none;' +
    '  border-radius:4px;cursor:pointer;font-weight:bold;width:100%;margin-top:10px;font-size:13px;}' +
    'button:disabled{opacity:0.6;cursor:not-allowed;}' +
    '</style>' +
    '<form onsubmit="submitForm(this);return false;">' +
    '<label>Parent Name *<input type="text"  name="parentName"    required></label>' +
    '<label>Email *       <input type="email" name="email"         required></label>' +
    '<label>Phone         <input type="tel"   name="phone"></label>' +
    '<label>Child\'s Name  <input type="text"  name="childName"></label>' +
    '<label>Grade Interest *' +
    '  <select name="gradeInterest" required>' +
    '    <option value="">Select grade...</option>' +
    '    <option>9th Grade</option><option>10th Grade</option>' +
    '    <option>11th Grade</option><option>12th Grade</option>' +
    '  </select>' +
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
  ).setWidth(390).setHeight(530).setTitle('➕ Add New Lead');

  SpreadsheetApp.getUi().showModalDialog(html, '➕ Add New Lead');
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

function getSetting(name) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAMES.SETTINGS);
  if (!sheet) return null;
  var data  = getSheetData(sheet);
  var match = data.find(function(s) { return s.Setting === name; });
  return match ? match.Value : null;
}

