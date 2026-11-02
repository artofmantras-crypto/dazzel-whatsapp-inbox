# Dazzel Digital · WhatsApp Inbox

A team inbox for Dazzel Digital's customer chats on WhatsApp, sent through Twilio. You can:

- read every conversation
- reply with free text within 24 hours of the customer's last message
- send an approved template at any time

## Setup

Open the app → **Settings** and enter your Twilio Account SID, Auth Token and WhatsApp number. They are checked with Twilio and saved securely in that browser. Each team member does this once on their own device.

**Templates** lets you create WhatsApp templates, send them for approval and track their status. Approved templates show up in the chat's Template tab.

Optionally, the same values can be set as Vercel environment variables instead (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, N8N_CONTACTS_URL, N8N_CONTACTS_KEY, DRIVE_ROOT_URL).

## Running locally

```
npm install
npm run dev
```
