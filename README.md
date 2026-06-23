# Google Sheets School CRM & Email Automation

**A free, serverless CRM for schools to manage enrollment leads, automate welcome emails, and track follow-ups — all inside Google Sheets.**

No external software. No monthly fees. Just Google Sheets + Gmail.

## Features

* **Lead Management** — Track parents, students, grades, and lead stages with color-coded status.
* **One-Click Welcome Series** — Send welcome emails to all new leads instantly.
* **Automated Follow-ups** — Daily trigger sends follow-up emails after configurable delays.
* **HTML Email Templates** — Professional emails with dynamic tokens (`{ParentName}`, `{SchoolName}`, etc.).
* **Settings Dashboard** — Custom dialog to manage your school info without touching code.
* **Activity Logging** — Permanent audit trail of every email sent.
* **Data Validation** — Dropdown menus for lead stages and sources to keep data consistent.
* **Welcome Tab** — Built-in quick-start guide so you're productive in minutes.

## Getting Started

### Option A: Template Copy (Recommended)

1. Click the **Make a Copy** link (provided with your purchase).
2. A new Google Sheet with all code pre-installed will appear in your Google Drive.
3. Refresh the sheet — you'll see the **School CRM** menu.
4. Click **School CRM > Run First-Time Setup**.
5. Grant permissions when prompted.
6. Done! Check the **Welcome** tab for next steps.

### Option B: Manual Installation

1. Open [Google Sheets](https://sheets.new) and name it (e.g., "School Enrollment CRM").
2. Go to **Extensions > Apps Script**.
3. Delete any default code. Create these files (use the `+` button) and paste the code:
   * `Setup.gs`
   * `EmailSystem.gs`
   * `SettingsSystem.gs`
   * `Utilities.gs`
   * `SettingsDialog.html`
   * `appsscript.json` (click the gear icon > check "Show appsscript.json in editor")
4. Click **Save**, refresh your Google Sheet, and click **School CRM > Run First-Time Setup**.

## How to Use

### 1. Configure Settings
Click **School CRM > Open Settings**. Enter your school name, admin details, and email signature. These fill in the template tokens in your emails.

### 2. Add Leads
Go to the **Enrollment CRM** tab. Add leads manually or connect a Google Form. Set the Stage to **New Lead** for new entries.

### 3. Send Emails
* **Welcome Series** — Click **School CRM > Send Welcome Series**. Sends the "Initial Response" template to all leads marked "New Lead".
* **Automated Follow-ups** — Click **School CRM > Start Automation**. Runs daily at 10 AM and sends follow-ups based on template SendDelay values.

### 4. Customize Templates
Go to the **EmailTemplates** tab. Edit subjects and content. Available tokens:
`{ParentName}`, `{ChildName}`, `{SchoolName}`, `{AdminName}`, `{AdminPhone}`, `{WebsiteURL}`, `{GradeInterest}`, `{Source}`

## Important Notes

**Handling Replies:** This system sends emails but does not read your inbox. When a parent replies, manually update their Stage in the CRM to stop automated follow-ups.

**Gmail Limits:** Free Gmail ~100 emails/day. Google Workspace ~1,500 emails/day.

**Connecting a Google Form:** Create a form with fields for Parent Name, Email, Phone, etc. Rename the linked response tab to "Enrollment CRM" and match the column headers.

## File Structure

| File | Purpose |
|------|---------|
| `Setup.gs` | Menu creation, first-time setup, Welcome tab, data validation |
| `EmailSystem.gs` | Email sending, template processing, token replacement |
| `SettingsSystem.gs` | Settings persistence, dialog management |
| `Utilities.gs` | Shared helpers for sheet data reading and activity logging |
| `SettingsDialog.html` | Settings UI form |
| `appsscript.json` | Project manifest and OAuth scopes |

## License

MIT License. Feel free to use and modify for your school or organization.
