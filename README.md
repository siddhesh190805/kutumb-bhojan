# Kutumb Bhojan / कुटुंब भोजन

A mobile-first family nutrition and meal planner built from the family's Notion system.

## Included
- 30 days × 4 meal slots (Sep 7–Oct 6, 2026)
- 23 approved family recipes
- 38 shopping items with real checkboxes
- 8 prep tasks with real checkboxes
- Vikas, Namrata, Tejas and Siddhesh family reference cards
- Marathi + English UI
- Local persistence and JSON backup/import
- No server/database dependency

## Run locally
Because this is a static app, no build step is required. Serve the folder with any static HTTP server, for example:

`python -m http.server 4173`

Then open `http://localhost:4173`.

## Data model
Starter data is embedded in `app.js`. User edits are stored in browser localStorage under `kutumb-bhojan-state-v1`. Use Settings → Backup before changing devices.

## Hosting
Designed for Vercel Hobby personal/non-commercial use. Free hosting is not represented as a contractual forever guarantee; Vercel's current terms allow it to change or discontinue Hobby.

