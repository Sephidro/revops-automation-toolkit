# 🏫 Google Sheets School CRM & Email Automation

**A serverless, free CRM for schools to manage enrollment leads, automate welcome emails, and track follow-ups—all inside Google Sheets.**

> **Note:** This project uses Google Apps Script to turn a standard spreadsheet into a powerful automation engine. No external software or monthly fees required.

## Features

* **Lead Management:** Track parents, students, grades, and lead stages.
* **One-Click Welcome Series:** Send welcome emails to batches of new leads instantly.
* **Automated "Drip" Follow-ups:** Automatically sends follow-up emails 3 days (or any custom duration) after the last contact if the lead hasn't moved stages.
* **HTML Email Templates:** Beautifully formatted emails with dynamic tokens (e.g., `{ParentName}`, `{ChildName}`).
* **Settings Dashboard:** A custom sidebar menu to manage your School Name, Signature, and admin details without touching code.
* **Activity Logging:** A permanent audit trail of every email sent by the system.

## Installation Guide

### Step 1: Create the Sheet
1.  Open [Google Sheets](https://sheets.new).
2.  Name your spreadsheet (e.g., "School Enrollment CRM").

### Step 2: Install the Code
1.  In the spreadsheet, go to **Extensions > Apps Script**.
2.  Delete any default code in the editor.
3.  Create the following files (using the `+` button) and copy/paste the code from this repository:
    * `Setup.gs`
    * `EmailSystem.gs`
    * `SettingsSystem.gs`
    * `Utilities.gs`
    * `SettingsDialog.html`
4.  Click **Save** (disk icon).

### Step 3: Run Setup
1.  Refresh your Google Sheet browser tab.
2.  You will see a new menu item called **⚙️ School CRM**.
3.  Click **⚙️ School CRM > 1. Run First-Time Setup**.
4.  Grant the necessary permissions when prompted.
5.  The script will automatically create 4 tabs: `Enrollment CRM`, `EmailTemplates`, `Settings`, and `ActivityLog`.

## How to Use

### 1. Configuration
Click **⚙️ School CRM > 3. Open Settings**. Fill in your:
* School Name
* Admin Name
* Email Signature
* *Tip: These settings are used to fill in the tokens in your email templates.*

### 2. Adding Leads
Go to the **Enrollment CRM** tab and add a lead manually (or connect it to a Google Form).
* **Required Fields:** `Email`, `ParentName`, `Stage`.
* **Default Stage:** Set the Stage to `New Lead`.

### 3. Sending Emails
* **Welcome Series:** Click **⚙️ School CRM > 2. Send Welcome Series**. The system will scan for anyone marked `New Lead`, send the "Initial Response" template, and change their stage to `Welcome Series Started`.
* **Automated Follow-ups:** Click **⚙️ School CRM > ▶️ Start Automation**. This creates a background trigger that runs daily at 10 AM. It checks if leads have been sitting for 3 days and sends the appropriate follow-up.

## 🎨 Customizing Templates
Go to the **EmailTemplates** tab. You can edit the Subject and Content.
* **Tokens:** You can use `{ParentName}`, `{ChildName}`, `{SchoolName}`, etc. inside your email body.
* **SendDelay:** The number of days after the *last contact* to wait before sending this email.

## 📄 License
MIT License. Feel free to use and modify for your school or organization.
