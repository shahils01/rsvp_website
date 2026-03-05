1. Create a Google Sheet for your wedding site data.
2. Copy the spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`
3. Open `Extensions -> Apps Script` from that sheet.
4. Replace the default script with the code from `apps-script/Code.gs`.
5. In `Code.gs`, set `SPREADSHEET_ID` to your real sheet ID.
6. Deploy as a web app:
   `Deploy -> New deployment -> Web app`
   Execute as: `Me`
   Who has access: `Anyone`
7. Copy the deployed Web App URL.
8. In your site `script.js`, set `RSVP_ENDPOINT` to that Web App URL.
9. Keep `REGISTRY_API_ENDPOINT = RSVP_ENDPOINT` (already set), so RSVP + registry use one backend.
10. Redeploy Apps Script when you edit it:
    `Deploy -> Manage deployments -> Edit -> New version -> Deploy`
