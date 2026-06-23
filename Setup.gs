/**
 * SETUP & MENU CONFIGURATION
 * Handles initial installation and menu creation.
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('School CRM')
    .addItem('Run First-Time Setup', 'setupSystem')
    .addItem('Send Welcome Series', 'sendWelcomeSeriesManual')
    .addItem('Open Settings', 'showSettings')
    .addSeparator()
    .addItem('Start Automation (Triggers)', 'createSystemTriggers')
    .addItem('Stop Automation', 'deleteSystemTriggers')
    .addToUi();
}

function setupSystem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var crmSheet = createSheetIfNotExists(ss, 'Enrollment CRM', [
    'Date', 'ParentName', 'Email', 'Phone', 'ChildName',
    'GradeInterest', 'Source', 'Stage', 'LastContact', 'Notes'
  ]);

  if (typeof setupEmailTemplates === 'function') {
    setupEmailTemplates();
  } else {
    createSheetIfNotExists(ss, 'EmailTemplates', [
      'TemplateName', 'Subject', 'Content', 'SendDelay', 'Description'
    ]);
  }

  createSheetIfNotExists(ss, 'ActivityLog', [
    'Timestamp', 'Email', 'Action', 'Details'
  ]);

  if (typeof initializeSettingsSheet === 'function') {
    var sSheet = ss.getSheetByName('Settings');
    if (!sSheet) initializeSettingsSheet();
  } else {
    createSheetIfNotExists(ss, 'Settings', ['Setting', 'Value']);
  }

  setupWelcomeTab(ss);
  setupDataValidation(ss, crmSheet);
  applyCrmFormatting(ss, crmSheet);

  SpreadsheetApp.getUi().alert(
    'Setup Complete!\n\n' +
    '1. Check the "Welcome" tab for a quick-start guide.\n' +
    '2. Go to School CRM > Open Settings to enter your school info.\n' +
    '3. Add leads to the "Enrollment CRM" tab and send your first emails!'
  );
}

function createSystemTriggers() {
  var ui = SpreadsheetApp.getUi();
  deleteSystemTriggers(true);

  ScriptApp.newTrigger('runDailyFollowUps')
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .create();

  ui.alert('Automation Active.\n\nFollow-ups will check daily at 10 AM.');
}

function deleteSystemTriggers(silent) {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'runDailyFollowUps') {
      ScriptApp.deleteTrigger(trigger);
      count++;
    }
  });

  if (!silent) {
    SpreadsheetApp.getUi().alert('Automation Stopped.\n(' + count + ' triggers deleted)');
  }
}

function createSheetIfNotExists(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#1a73e8')
        .setFontColor('#ffffff')
        .setBorder(true, true, true, true, true, true);
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headers.length);
    }
  }
  return sheet;
}

function setupWelcomeTab(ss) {
  var name = 'Welcome';
  var sheet = ss.getSheetByName(name);
  if (sheet) sheet.clear();
  else sheet = ss.insertSheet(name, 0);

  var content = [
    ['SCHOOL ENROLLMENT CRM - QUICK START GUIDE', ''],
    ['', ''],
    ['STEP', 'INSTRUCTIONS'],
    ['1. Configure Settings', 'Go to School CRM > Open Settings. Enter your school name, admin details, and email signature. These are used to personalize your emails.'],
    ['2. Add Your Leads', 'Go to the "Enrollment CRM" tab. Add parent info manually, or connect a Google Form (see below). Set the Stage to "New Lead" for new entries.'],
    ['3. Send Welcome Emails', 'Go to School CRM > Send Welcome Series. This sends the "Initial Response" template to every lead marked "New Lead" and updates their stage.'],
    ['4. Enable Automation', 'Go to School CRM > Start Automation. This creates a daily trigger (10 AM) that automatically sends follow-up emails to leads who haven\'t moved stages.'],
    ['5. Customize Templates', 'Go to the "EmailTemplates" tab. Edit subjects and content. Use tokens like {ParentName}, {SchoolName}, {AdminName} for personalization.'],
    ['', ''],
    ['CONNECTING A GOOGLE FORM', ''],
    ['', 'Go to Tools > Create a new form. Add fields for Parent Name, Email, Phone, Child Name, Grade Interest. In the linked response sheet, rename the tab to "Enrollment CRM" and match column headers exactly.'],
    ['', ''],
    ['IMPORTANT: HANDLING REPLIES', ''],
    ['', 'This system sends emails but does NOT read your inbox. When a parent replies, you MUST manually update their Stage in the CRM (e.g., change "New Lead" to "Contact Made"). Otherwise, follow-up emails will keep sending.'],
    ['', ''],
    ['GMAIL SENDING LIMITS', ''],
    ['', 'Free Gmail: ~100 emails/day. Google Workspace (paid): ~1,500 emails/day. All sent emails are logged in the "ActivityLog" tab.'],
    ['', ''],
    ['AVAILABLE TOKENS FOR TEMPLATES', ''],
    ['', '{ParentName}, {ChildName}, {SchoolName}, {AdminName}, {AdminPhone}, {WebsiteURL}, {GradeInterest}, {Source}'],
    ['', ''],
    ['LEAD STAGES', ''],
    ['', 'New Lead > Contact Made > Tour Scheduled > Enrolled / Declined. Customize these in Settings under "Lead Stage Names".'],
  ];

  sheet.getRange(1, 1, content.length, 2).setValues(content);

  sheet.getRange(1, 1, 1, 2)
    .merge()
    .setFontSize(16)
    .setFontWeight('bold')
    .setFontColor('#1a73e8')
    .setBackground('#e8f0fe');

  sheet.getRange(3, 1, 1, 2)
    .setFontWeight('bold')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff');

  var sectionRows = [10, 13, 16, 19, 22];
  sectionRows.forEach(function(row) {
    sheet.getRange(row, 1, 1, 2)
      .merge()
      .setFontWeight('bold')
      .setFontColor('#1a73e8')
      .setBackground('#e8f0fe');
  });

  sheet.getRange('A4:A8')
    .setFontWeight('bold')
    .setBackground('#f8f9fa');

  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 600);
  sheet.getRange(1, 1, content.length, 2).setWrap(true).setVerticalAlignment('top');
}

function setupDataValidation(ss, crmSheet) {
  if (!crmSheet) return;

  var stages = getSetting('Lead Stage Names');
  if (!stages) stages = 'New Lead,Contact Made,Tour Scheduled,Enrolled,Declined';
  var stageList = stages.split(',').map(function(s) { return s.trim(); });

  var sources = getSetting('Lead Sources');
  if (!sources) sources = 'Website,Referral,Social Media,Phone';
  var sourceList = sources.split(',').map(function(s) { return s.trim(); });

  var lastRow = Math.max(crmSheet.getLastRow(), 100);

  var stageRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(stageList, true)
    .setAllowInvalid(true)
    .build();
  crmSheet.getRange(2, 8, lastRow - 1, 1).setDataValidation(stageRule);

  var sourceRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(sourceList, true)
    .setAllowInvalid(true)
    .build();
  crmSheet.getRange(2, 7, lastRow - 1, 1).setDataValidation(sourceRule);
}

function applyCrmFormatting(ss, crmSheet) {
  if (!crmSheet) return;

  var stageColors = {
    'New Lead': '#e8f0fe',
    'Contact Made': '#fef7e0',
    'Tour Scheduled': '#e6f4ea',
    'Enrolled': '#ceead6',
    'Declined': '#fce8e6'
  };

  var rules = [];
  for (var stage in stageColors) {
    var rule = SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(stage)
      .setBackground(stageColors[stage])
      .setRanges([crmSheet.getRange('H2:H1000')])
      .build();
    rules.push(rule);
  }
  crmSheet.setConditionalFormatRules(rules);

  crmSheet.autoResizeColumns(1, 10);
  crmSheet.setColumnWidth(10, 300);
}
