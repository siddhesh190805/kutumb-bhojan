# Kutumb Bhojan / कुटुंब भोजन — Family Nutrition Web App Design

## Goal
Replace the family's Notion-based nutrition dashboard with a simple, bilingual, mobile-first web app that preserves the current meal calendar, recipes, shopping list, prep tasks, family member reference data, and family-specific rules.

## Architecture
A static React + TypeScript + Vite application deployed on Vercel Hobby. The canonical starter dataset is bundled in the app, while family edits are stored locally in the browser with versioned localStorage and JSON import/export for backup. No paid backend is required for the first release.

## UX
Marathi-first labels with English alongside them. The home screen answers four questions immediately: आज काय बनवायचे?, कसे बनवायचे?, काय आणायचे?, आधी काय करायचे? Navigation is limited to Today, Calendar, Recipes, Shopping, Prep, and Family.

## Data parity
Initial data mirrors the existing system: 30 days × 4 meal slots from Sep 7–Oct 6, 23 approved family recipes, 38 shopping items, 8 prep tasks, and 4 family members. Pithla remains excluded. The Vikas food-reaction caution is shown as a safety note and is not turned into a diagnosis.

## Interaction
Calendar entries are editable; recipe cards open detailed instructions; shopping and prep rows use real interactive checkboxes; all mutations persist locally; reset-to-starter and export/import JSON are available under Settings.

## Constraints
- No paid API or database dependency.
- No medical diagnosis or “immunity booster” claims.
- No soy chunks as a default texture; soy recipes use ground/minced forms.
- Exact recipe quantities are displayed where available; estimates are explicitly labeled.
- Vercel Hobby is treated as personal/non-commercial hosting, not a guaranteed forever-free promise.
