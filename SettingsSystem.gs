/**
 * SETTINGS MANAGEMENT
 * Uses ScriptProperties for caching to reduce read latency.
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('⚙️ Admin Tools')
    .addItem('Open Settings', 'showSettings')
    .addItem('Send Welcome Series', 'sendWelcomeSeriesManual')
    .addItem('Reset Templates', 'setupEmailTemplates')
    .addToUi();
}

function showSettings() {
  var html = HtmlService.createTemplateFromFile('SettingsDialog')
    .evaluate().setWidth(600).setHeight(700).setTitle('⚙️ CRM Settings');
  SpreadsheetApp.getUi().showModalDialog(html, '⚙️ CRM Settings');
}

function getSettingsForUI() {
  var map = getSettingsMap();
  var arr = [];
  for (var key in map) arr.push({ Setting: key, Value: map[key] });
  return arr;
}

function saveSettings(formObject) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Settings');
    var newValues = [];
    var props = {};
    
    for (var key in formObject) {
      newValues.push([key, formObject[key]]);
      props[key] = formObject[key];
    }
    
    if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow()-1, 2).clearContent();
    if (newValues.length > 0) sheet.getRange(2, 1, newValues.length, 2).setValues(newValues);
    
    PropertiesService.getScriptProperties().setProperties(props);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function getSetting(name) {
  var cache = PropertiesService.getScriptProperties().getProperty(name);
  if (cache !== null) return cache;
  
  var map = getSettingsMap();
  if (map[name]) PropertiesService.getScriptProperties().setProperty(name, map[name]);
  return map[name] || '';
}

function getSettingsMap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Settings');
  
  if (!sheet || sheet.getLastRow() <= 1) return initializeSettingsSheet(sheet);
  
  var data = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) map[data[i][0]] = data[i][1];
  }
  return map;
}

function initializeSettingsSheet(sheet) {
  if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Settings');
  
  var defaults = [
    ['Setting', 'Value'],
    ['School Name', '[My School Name]'],
    ['Admin Name', '[Admin Name]'],
    ['Admin Phone', '555-0123'],
    ['Website URL', 'www.myschool.edu'],
    ['Welcome Email Sender', 'Admissions Team'],
    ['Reply To Email', ''],
    ['Email Signature', 'Sincerely,\nThe Admissions Team'],
    ['Lead Stage Names', 'New Lead,Contact Made,Tour Scheduled,Enrolled,Declined'],
    ['Lead Sources', 'Website,Referral,Social Media,Phone']
  ];
  
  sheet.clear();
  sheet.getRange(1, 1, defaults.length, 2).setValues(defaults);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#ddd');
  
  var map = {};
  for (var i = 1; i < defaults.length; i++) map[defaults[i][0]] = defaults[i][1];
  return map;
}
