# Data receiver — Google Sheet + Apps Script (2 minutes, once)

The Sheet already exists: **"Battery Pre-pilot Data"** in Zac's Google Drive (tabs: sessions,
trials, probes, fades, raw). To make the task write to it:

1. Open the Sheet → **Extensions → Apps Script**.
2. Delete the placeholder code, paste the contents of `Code.gs` from this folder, save (⌘S).
3. **Deploy → New deployment** → gear icon → type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**   (the task posts anonymously; the Sheet itself stays private)
   → **Deploy**. Approve the permission prompt (it is your own script writing to your own Sheet).
4. Copy the **Web app URL** (ends in `/exec`) and paste it into
   - `config.js`           → `sheets: { url: "…" }`
   - `rest-study/config_rest.js` → `sheets: { url: "…" }`
   then commit. (Or send the URL to Claude and it will do this and republish.)
5. Test: open the task with `?pid=test`, finish it, and check the `sessions` tab.

After any edit to `Code.gs`: Deploy → Manage deployments → pencil → Version "New" → Deploy.
The web-app URL stays the same.

Until this is done, the end screen offers a download / copy button instead; sessions can
still be run and the files sent by hand.
