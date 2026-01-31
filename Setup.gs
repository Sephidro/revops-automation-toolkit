/**
 * SETUP & MENU CONFIGURATION
 * Handles initial installation and menu creation.
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚙️ School CRM')
    .addItem('🚀 1. Run First-Time Setup', 'setupSystem')
    .addItem('✉️ 2. Send Welcome Series', 'sendWelcomeSeriesManual')
    .addItem('⚙️ 3. Open Settings', 'showSettings')
    .addSeparator()
    .addItem('▶️ Start Automation (Triggers)', 'createSystemTriggers')
    .addItem('⏹️ Stop Automation', 'deleteSystemTriggers')
    .addToUi();
}

/**
 * MASTER SETUP FUNCTION
 * Creates all necessary sheets and populates them with headers/defaults.
 */
function setupSystem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. CRM Data Sheet
  createSheetIfNotExists(ss, 'Enrollment CRM', [
    'Date', 'ParentName', 'Email', 'Phone', 'ChildName', 
    'GradeInterest', 'Source', 'Stage', 'LastContact', 'Notes'
  ]);
  
  // 2. Templates Sheet (Calls helper from EmailSystem.gs)
  if (typeof setupEmailTemplates === 'function') {
    setupEmailTemplates();
  } else {
    // Fallback if EmailSystem.gs isn't loaded yet
    createSheetIfNotExists(ss, 'EmailTemplates', [
      'TemplateName', 'Subject', 'Content', 'SendDelay', 'Description'
    ]);
  }
  
  // 3. Activity Log
  createSheetIfNotExists(ss, 'ActivityLog', [
    'Timestamp', 'Email', 'Action', 'Details'
  ]);
  
  // 4. Settings (Calls helper from SettingsSystem.gs)
  if (typeof initializeSettingsSheet === 'function') {
    var sSheet = ss.getSheetByName('Settings');
    if (!sSheet) initializeSettingsSheet();
  } else {
    createSheetIfNotExists(ss, 'Settings', ['Setting', 'Value']);
  }
  
  SpreadsheetApp.getUi().alert('✅ System Setup Complete!\n\nCheck the "EmailTemplates" and "Settings" tabs to customize your school info.');
}

/**
 * AUTOMATION TRIGGERS
 * Sets up the background robots.
 */
function createSystemTriggers() {
  var ui = SpreadsheetApp.getUi();
  
  // 1. Clean up old triggers to avoid duplicates
  deleteSystemTriggers(true);
  
  // 2. Daily Follow-up Trigger (10 AM)
  ScriptApp.newTrigger('runDailyFollowUps')
    .timeBased()
    .everyDays(1)
    .atHour(10)
    .create();
    
  ui.alert('✅ Automation Active.\n\nFollow-ups will check daily at 10 AM.');
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
    SpreadsheetApp.getUi().alert('⏹️ Automation Stopped.\n(' + count + ' triggers deleted)');
  }
}

/**
 * HELPER: Creates a sheet only if it doesn't exist
 */
function createSheetIfNotExists(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      // Style headers
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#f3f3f3')
        .setBorder(true, true, true, true, true, true);
      // Freeze header row
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}
