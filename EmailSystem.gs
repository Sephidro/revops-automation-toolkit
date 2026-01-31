/**
 * EMAIL AUTOMATION SYSTEM
 * Handles batch processing of emails for Welcome Series and Follow-ups.
 */

// --- CONFIGURATION ---
// Customize these generic templates for the initial setup
var DEFAULT_EMAIL_TEMPLATES = [
  {
    TemplateName: 'Initial Response',
    Subject: 'Welcome to {SchoolName}! 🚀',
    Content: `Hi {ParentName},

Thanks for reaching out! We are thrilled to introduce you to {SchoolName}.

We offer:
• Great Program A
• Great Program B
• Amazing Community

Reply to this email to schedule a tour!

Best,
{AdminName}
{SchoolName}`,
    SendDelay: 0,
    Description: 'Sent immediately to new leads.'
  },
  {
    TemplateName: '3-Day Follow-Up',
    Subject: 'Checking in regarding {SchoolName}',
    Content: `Hi {ParentName},

Just wanted to float this to the top of your inbox. Do you have time for a tour this week?

Best,
{AdminName}`,
    SendDelay: 3,
    Description: 'Follow-up if no contact after 3 days.'
  }
];

// --- TRIGGER FUNCTIONS ---

function sendWelcomeSeriesManual() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('Send Welcome Series', 'Send emails to all New Leads? This sends the "Initial Response" template.', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;
  
  SpreadsheetApp.getActiveSpreadsheet().toast('Processing emails...', 'Status', -1);
  var results = processEmailQueue('WELCOME');
  
  var msg = 'Emails Sent: ' + results.sent;
  if (results.errors.length > 0) msg += '\nErrors:\n' + results.errors.join('\n');
  ui.alert(msg);
}

function runDailyFollowUps() {
  console.log('Starting Daily Follow-up Check');
  processEmailQueue('FOLLOW_UP');
}

// --- CORE LOGIC ---

function processEmailQueue(mode) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var leadsSheet = ss.getSheetByName('Enrollment CRM');
  var templatesSheet = ss.getSheetByName('EmailTemplates');
  
  if (!leadsSheet || !templatesSheet) throw new Error('Missing required sheets. Run Setup first.');

  var leadsData = leadsSheet.getDataRange().getValues();
  var headers = leadsData.shift(); 
  var templates = getSheetData(templatesSheet);
  var col = mapHeaders(headers);
  var today = new Date();
  today.setHours(0,0,0,0);
  
  var emailsSent = 0;
  var errors = [];
  var updates = [];

  // Load Settings for Token Replacement
  var config = {
    schoolName: getSetting('School Name'),
    adminName: getSetting('Admin Name'),
    adminPhone: getSetting('Admin Phone'),
    websiteURL: getSetting('Website URL'),
    senderName: getSetting('Welcome Email Sender'),
    replyTo: getSetting('Reply To Email'),
    signature: getSetting('Email Signature')
  };

  leadsData.forEach(function(row, index) {
    var rowIndex = index + 2; 
    var lead = rowToObject(row, col);
    var templateToSend = null;
    var newStage = '';
    
    // Logic: Welcome Series
    if (mode === 'WELCOME' && lead.Stage === 'New Lead') {
      templateToSend = templates.find(t => t.TemplateName === 'Initial Response');
      newStage = 'Welcome Series Started';
    } 
    // Logic: Follow Ups
    else if (mode === 'FOLLOW_UP' && lead.Stage === 'New Lead') {
      var lastContact = new Date(lead.LastContact);
      lastContact.setHours(0,0,0,0);
      var daysDiff = Math.floor((today - lastContact) / (1000 * 60 * 60 * 24));
      
      var followUpTemplate = templates.find(t => t.SendDelay == daysDiff);
      if (followUpTemplate) {
        templateToSend = followUpTemplate;
        newStage = daysDiff + '-Day Follow-up Sent';
      }
    }

    if (templateToSend) {
      try {
        if (sendEmail(lead, templateToSend, config)) {
          emailsSent++;
          updates.push({ r: rowIndex, c: col.Stage + 1, val: newStage });
          updates.push({ r: rowIndex, c: col.LastContact + 1, val: new Date() });
        }
      } catch (e) {
        errors.push(lead.Email + ': ' + e.message);
      }
    }
  });

  // Batch Write Updates
  if (updates.length > 0) {
    updates.forEach(u => leadsSheet.getRange(u.r, u.c).setValue(u.val));
    SpreadsheetApp.flush();
  }

  return { sent: emailsSent, errors: errors };
}

function sendEmail(lead, template, config) {
  if (!lead.Email) return false;

  var tokenData = { ...config, ...lead }; // Merge config and lead data
  var subject = replaceTokens(template.Subject, tokenData);
  var rawBody = replaceTokens(template.Content, tokenData);
  var htmlBody = formatHtmlBody(rawBody, config.signature);

  GmailApp.sendEmail(lead.Email, subject, rawBody, {
    name: config.senderName,
    htmlBody: htmlBody,
    replyTo: config.replyTo
  });
  return true;
}

function replaceTokens(text, data) {
  if (!text) return '';
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, function(match, key) {
    return data[key] !== undefined ? data[key] : match;
  });
}

function formatHtmlBody(content, signature) {
  var formatted = content
    .replace(/\r\n/g, '\n')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/•/g, '&bull;')
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>');

  return `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
      <div style="padding: 20px;"><p>${formatted}</p></div>
      <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; color: #666;">
        ${(signature || '').replace(/\n/g, '<br>')}
      </div>
    </div>`;
}

function setupEmailTemplates() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('EmailTemplates');
  if(!sheet) sheet = ss.insertSheet('EmailTemplates');
  
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  else sheet.appendRow(['TemplateName', 'Subject', 'Content', 'SendDelay', 'Description']);

  DEFAULT_EMAIL_TEMPLATES.forEach(t => {
    sheet.appendRow([t.TemplateName, t.Subject, t.Content, t.SendDelay, t.Description]);
  });
  
  sheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f3f3f3');
  sheet.autoResizeColumns(1, 5);
}
