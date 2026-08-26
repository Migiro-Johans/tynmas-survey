# Tynmas Labs — "Let's Connect" feedback survey

A static, mobile-first survey page (`site/`) that saves every response to a Google Sheet through a
tiny Google Apps Script web app (`backend/Code.gs`). Visitors submit from any phone with no sign-in.
The admin opens the same page with `#admin` and a secret key to see live results.

```
site/
  index.html      the whole survey + admin dashboard (single file, no build step, no dependencies)
  favicon.png
backend/
  Code.gs         Google Apps Script — stores responses in a Google Sheet and serves them to the admin
```

## How it works

```
visitor phone ──POST submit──▶ Apps Script web app ──▶ Google Sheet "Responses"
admin  (#admin) ◀──GET list (every 5 s, with admin key)──┘
```

1. A visitor answers the 6 steps and taps **Send feedback**. The page POSTs the response as JSON to the
   Apps Script URL; the script appends one row to the sheet. The visitor sees the thank-you screen,
   which restarts the survey after 20 s (kiosk-friendly) or on **Start again**.
2. If the phone/tablet is offline, the response is queued in the browser and re-sent automatically
   when the connection returns (also on the next page load). Re-sends are de-duplicated by id.
3. The admin opens `https://<your-subdomain>/#admin`, enters the **admin key**, and gets the live
   dashboard: stat tiles, knowledge ladder, bar charts, a feed of every comment, **Export CSV** and
   **Clear responses** (two-tap confirm). It re-fetches the sheet every 5 seconds and highlights new
   entries. The Google Sheet itself is also a live view and can be shared with the team.
4. Visitors never see a results button; the dashboard is only reachable via `#admin` + the key.

## Deploy — backend (Google Sheet + Apps Script), ~5 minutes

1. Create a Google Sheet (e.g. *Tynmas Survey Responses*).
2. **Extensions → Apps Script**. Replace the sample code with the contents of `backend/Code.gs`.
3. Edit the first line: set `ADMIN_KEY` to a long private secret. This is the key the admin types in.
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (needed so visitors can submit without a Google login)
   - Deploy, authorise the script, copy the **Web app URL** (ends in `/exec`).
5. Open the URL in a browser: you should see `{"ok":true,"service":"tynmas-survey",...}`.

> After changing `Code.gs` later: **Deploy → Manage deployments → Edit → Version: New version**.
> Creating a *new* deployment gives a new URL, which would then need updating in `index.html`.

## Deploy — front end (any static host)

1. Open `site/index.html` and paste the Web app URL into `ENDPOINT` in the `<script id="config">` block
   near the top of `<body>`:
   ```js
   window.TYNMAS_CONFIG = { ENDPOINT: "https://script.google.com/macros/s/…/exec", POLL_MS: 5000 };
   ```
2. Upload the `site/` folder to the subdomain. It is plain HTML — Netlify, Vercel, Cloudflare Pages,
   GitHub Pages, cPanel or any web server works. Serve over **HTTPS** (Apps Script is HTTPS and
   browsers block mixed content).
3. Point DNS: `survey` CNAME → your host, then `https://survey.tynmaslabs.com/` is the survey and
   `https://survey.tynmaslabs.com/#admin` is the dashboard.

## Test checklist

- Visit the page, submit a test response → a new row appears in the sheet within a second.
- Open `/#admin`, enter the key → the response shows in the dashboard; a second submission from
  another phone appears within 5 s with a "+1 new" badge.
- Wrong key → "That key was not accepted."
- Put the phone in airplane mode, submit → "saved on this device"; go online → it is sent (toast).
- **Clear responses** (tap twice) empties the sheet — do this before the event to remove test data.

## Notes for the developer

- No framework, no build. Everything (CSS, JS, images as data URIs) lives in `index.html` (~270 KB).
- Backend API is documented at the top of `Code.gs`. Requests use `Content-Type: text/plain` on purpose:
  it avoids a CORS preflight, which Apps Script does not answer.
- With `ENDPOINT` left empty the page runs in **preview mode** (answers stay in the browser) — handy
  for checking the design locally without a backend.
- Response fields: `id, ts, name, company, email, phone, based, role, level, excites[], excitesOther,
  make[], makeOther, help, wants[], wantsOther`. List fields are stored as `a; b; c` in the sheet.
- Want a different backend (Supabase, Firebase, your own API)? Only the three functions in
  `API` (`submit`, `list`, `count`, `clear`) in `index.html` need swapping; the UI is untouched.
- Rough limits: Apps Script handles a booth comfortably (thousands of submissions/day). The admin
  key travels in the URL query of the `list` request over HTTPS; rotate it after the event if you like.
