# Dazzel Digital · WhatsApp Inbox

A team inbox for Dazzel Digital's customer chats on WhatsApp, sent through Twilio. You can:

- read every conversation
- reply with free text within 24 hours of the customer's last message
- send an approved template at any time

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Value |
|---|---|
| TWILIO_ACCOUNT_SID | Twilio Account SID (AC…) |
| TWILIO_AUTH_TOKEN | Twilio Auth Token |
| TWILIO_WHATSAPP_FROM | +18208993837 |
| DASHBOARD_PASSWORD | Team password used to sign in |
| SESSION_SECRET | Any long random string |
| N8N_CONTACTS_URL | URL of the n8n `dazzel-inbox-data` webhook (customer names and status from the sheet) |
| N8N_CONTACTS_KEY | Key for that webhook |
| DRIVE_ROOT_URL | Link to the "AI Avatar Files" Drive folder |

## Running locally

```
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```
