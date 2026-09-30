# ClearanceLink (Expo Go)

## Marketing website

Run the responsive public website with `npm run web`, then open `http://localhost:5173/`. Build it with `npm run web:build`. The website uses `src/App.jsx` and `src/App.css`; the Expo app still uses `App.js`.

The supplied phone screen recording is at `public/videos/clearancelink-demo.mp4`. Contact mail opens the visitor's email application addressed to `thegideons.2.5.1@gmail.com`. Optional `VITE_CONTACT_EMAIL`, `VITE_CONTACT_PHONE`, and `VITE_CONTACT_OFFICE` variables can override the displayed contact details. Add the live App Store and Google Play URLs when they are available. The canonical URL, sitemap, and robots file currently use `localhost:5173` and need the public domain before deployment. The policy pages contain starter copy that needs final legal review.

Run the app and its local API in two terminals:

```powershell
npm run api
```

```powershell
npm start
```

Keep your phone and computer on the same Wi-Fi when using Expo Go. The app reads Expo's development host and connects to port 4000 on that computer. If you use a tunnel or a different API host, set `EXPO_PUBLIC_API_URL` to the full API address before starting Expo.

## Institution admin

Registration collects an institution logo, registration and approval documents, and primary admin details. Accounts stay pending until platform verification. Set `PLATFORM_ADMIN_KEY` on the API process, then verify the institution ID returned by registration:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:4000/api/platform/institutions/<institution-id>/verify" -Headers @{ 'X-Platform-Key' = '<platform-key>' }
```

Sign in again after verification to refresh the account status. The admin area includes the dashboard, student and staff records, spreadsheet imports, generated ID review and release, officer scope assignment, read-only oversight, tuition structure, settings, and audit activity. Student and staff access IDs stay unusable until an admin approves them. Email release sends each recipient only their own ID and processes up to 100 pending recipients per tap.

The import screen accepts `.xlsx` or `.csv` files up to 10 MB and offers a matching template. It validates rows before importing and skips invalid rows. An officer's department, level, and session are assigned by the admin.

## Local API configuration

The API stores development data in `server/data/auth.json` and uploaded files in `server/data/` (ignored by Git). Email delivery uses either `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`, or `GMAIL_USER` and `GMAIL_APP_PASSWORD`. Without email setup, approved IDs remain pending and the send screen reports the setup error.

Password reset codes are shown inside the app in local development. Configure email delivery and production storage before a public deployment.
