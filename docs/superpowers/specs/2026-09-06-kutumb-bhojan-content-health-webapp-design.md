# Kutumb Bhojan Content, Health & Web-App Design

## Goal
Make Kutumb Bhojan a DB-driven family nutrition web app/PWA where health guidance, household targets, recipes, meals, shopping and prep are data-driven, while the frontend remains responsible for reusable UI/interaction behavior.

## Product decisions
- Health experience is hybrid: concise actionable health cards on the dashboard plus a full Health Guide.
- Household health targets are the primary UX; individual reference data remains available but is not turned into clinical prescriptions.
- No email/password/OTP UI; Supabase anonymous sessions remain the access mechanism.
- Supabase is the canonical source for shared household data and health/content data.
- LocalStorage is a cache/offline fallback and device-specific preference store, not the canonical shared content store.
- Theme is Light / Dark / System and persisted locally because it is a device preference.
- The app is installable as a PWA and should work as an offline shell.

## Architecture
Existing household tables remain the shared operational data model. Add a read-only global health-content layer and a household settings layer. Health content is not duplicated into JavaScript; the client fetches it from Supabase and renders generic cards/details.

The first health release contains practical guidance for oil, salt, free sugar, fruit/vegetables, whole grains/pulses, protein diversity, fried/packaged foods, hydration, activity/sleep and food safety. Numeric guidance is framed as general public-health guidance, with source attribution and a clear non-clinical disclaimer.

For oil, the app separates **stock** from **planning target**. A household can enter its current stock (for example 5,000 ml) and a monthly planning target. The UI then shows stock, target, daily planning pace and reduction opportunities. The target is configurable rather than hard-coded as a medical limit.

## Data model
### `health_tips`
Global, read-only-to-family content records: category, bilingual title/summary/detail/action, priority, source label/url, active flag and sort order.

### `health_targets`
Global, read-only reference values: key, bilingual label, numeric value/range text, unit, period, context and source.

### `household_settings`
One row per household: display name, oil stock, monthly oil planning target, language preference and timestamps.

## UI
Navigation gains `आरोग्य · Health`. Dashboard gains:
- today's meals
- prep/shopping status
- one rotating high-priority health tip
- household target snapshot, including oil
- quick link to Health Guide

Health Guide supports category filters and expandable detail cards. It uses the same generic renderer for all health tips, so adding/editing DB content does not require JavaScript changes.

Settings gains:
- Light / Dark / System theme toggle
- household oil stock and monthly planning target editor
- cloud-sync status
- backup/import

## PWA
Add a service worker for the static application shell and register it from the app. Keep Supabase/network data requests network-first; never cache authenticated API responses in the service worker.

## Security
- Enable RLS on all new public tables.
- `health_tips` and `health_targets`: SELECT only for `authenticated` users.
- `household_settings`: authenticated household members can SELECT/INSERT/UPDATE only for their household.
- No anonymous Postgres role access to the new tables.
- Keep service-role credentials out of browser code.

## Success criteria
1. Health content can be added/edited in Supabase and appears in the app without changing frontend code.
2. Household oil stock/target can be changed from Settings and is shared across family devices.
3. Dashboard shows a health tip and household target summary.
4. Full Health Guide is bilingual and data-driven.
5. Light/Dark/System theme works and persists per device.
6. App installs as a PWA and has a working offline shell.
7. Existing meals, recipes, shopping, prep, anonymous auth and realtime sync continue to work.
8. Tests cover data mapping, dynamic health rendering contracts, theme behavior and PWA registration markers.
