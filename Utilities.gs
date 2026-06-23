/**
 * UTILITY FUNCTIONS
 * Shared helpers for reading sheet data, mapping headers, and logging activity.
 */

function getSheetData(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  var rows = data.slice(1);
  return rows.map(function(row) {
    var obj = {};
    headers.forEach(function(header, i) {
      obj[header] = row[i];
    });
    return obj;
  });
}

function mapHeaders(headers) {
  var map = {};
  headers.forEach(function(header, i) {
    map[header] = i;
  });
  return map;
}

function rowToObject(row, colMap) {
  var obj = {};
  for (var key in colMap) {
    obj[key] = row[colMap[key]];
  }
  return obj;
}

function logActivity(email, action, details) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('ActivityLog');
  if (!sheet) return;
  sheet.appendRow([new Date(), email, action, details]);
}
