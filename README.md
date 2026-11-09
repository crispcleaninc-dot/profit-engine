# Crispus Profit Engine — offline app

The Profit Engine as an installable phone/computer app that works with **no internet** and syncs back to the Profit Engine (Google Sheet) when it is online again.

**No client data or personal information is stored in this repository.** The code is public only so it can be hosted free on GitHub Pages. Your data loads after your PIN is checked by the Profit Engine (Apps Script), and on each device it is kept encrypted with your PIN.

## Install
- iPhone (Safari): open the app link, tap Share, then **Add to Home Screen**.
- Android (Chrome): open the app link, tap the menu, then **Install app**.
- Computer (Chrome/Edge): open the app link, click the install icon in the address bar.

Sign in once with internet. After that it opens and works offline; changes wait on the device and send when you are back online.

## Parts
- `index.html`, `app.js`, `styles.css`: the owner app (PIN)
- `card.html`, `card.js`: public card / front pages that also work offline (`card.html?card=HVAC`, `card.html?front=CARES`)
- `sw.js`, `manifest.webmanifest`, icons: home-screen install and offline start
- `studio.js`: Creative Studio (v1.7): ad studio with an agent team, AI pictures and video with an AI label, reply agent for leads, on-device Library. Uses free Pollinations AI from the browser; nothing is posted or sent for you.
- `config.js`: the Profit Engine address (no data)
- Server side: `Api.gs` in the "Crispus Profit Engine" Apps Script project (crispcleaninc), not stored here.
