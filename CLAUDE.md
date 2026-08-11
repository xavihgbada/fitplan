# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server. Note: `/api/generate-plan` and `/api/grade-workout` are stubbed locally by `vite.config.js` (mock JSON responses), since Vercel serverless functions in `api/` don't run under plain `vite`. Use this to check UI/layout without an Anthropic API key.
- `vercel dev` — run the real serverless functions (`api/*.js`) locally, needed to test auth, Stripe, credits, or the real Anthropic responses end-to-end.
- `npm run build` — production build (Vite).
- `npm run lint` — oxlint (config: `.oxlintrc.json`, plugins `react` + `oxc`).
- `npm run preview` — preview the production build.
- No test suite is configured in this repo.

## Architecture

FitPlan AI: a React SPA (Vite) with Vercel serverless functions for anything that needs a secret, backed by Supabase (auth + Postgres) and Stripe (payments).

### Frontend is one file
`src/App.jsx` (~2100 lines) is the entire application: landing page, auth (login/signup/password reset via Supabase), the plan-generation form, plan display, PDF export (dynamically loads jsPDF from a CDN), the workout grader, per-exercise swap, and the weekly check-in/progress-tracking flow. There is no router or component-file split — new features generally get added as more state + JSX inside this one component (`FitnessPlanGenerator`). `src/legal.jsx` holds the Terms/Privacy static content. `src/App.css` holds all styling (CSS variables like `--accent`, `--ink`, `--danger` etc. define the theme).

### API layer (`api/*.js` — Vercel serverless functions)
Every endpoint follows the same pattern: verify the caller via `getVerifiedUser()` (`api/_lib/supabaseAuth.js`, validates the Bearer token against Supabase Auth — never trust a client-supplied user id), then call the real API server-side so secrets never reach the browser:
- `generate-plan.js`, `adjust-plan.js`, `grade-workout.js`, `track-generation.js` — proxy to Anthropic (`api/adjust-plan.js` and `api/track-generation.js` are missing access-gate checks; `generate-plan.js`/`grade-workout.js` gate through `accessGate.js`).
- `exercise-gif.js` — looks up an exercise's animated GIF via ExerciseDB (RapidAPI), matching by name *and* requiring equipment agreement (see comments in the file for why a truncated-name fallback was deliberately dropped — substring matching against ExerciseDB is unreliable). Fetches the GIF server-side and inlines it as a `data:` URI rather than exposing a hotlinkable URL (the RapidAPI key can't go to the browser).
- `create-checkout-session.js` / `stripe-webhook.js` — Stripe Checkout for the two paid products (`unlock`: 3 plans + save/PDF export; `extra_generation`: one more generation). The webhook is the only writer of `has_paid` / `generation_credits` (`config.api.bodyParser = false` is required for Stripe signature verification).
- `api/_lib/accessGate.js` — access-control policy: unpaid users get exactly one free action total, shared between "plan" and "grade" (`free_action_used`); paid users draw from `plans_generated` against `FREE_PLANS_INCLUDED + generation_credits`. Call `markFreeActionUsed`/`incrementPlansGenerated` only *after* the underlying action actually succeeded.

### Data model (Supabase)
A `profiles` table (`has_paid`, `generation_credits`, `plans_generated`, `free_action_used`) drives all access control — always read via a service-role client keyed off the verified user id, never client-supplied. `supabase/migrations/*.sql` are plain SQL files with no migration tooling wired up — apply manually in the Supabase SQL editor (see comment in `0001_add_free_action_used.sql`). Unpaid users' in-progress plans are cached client-side in `localStorage` (`fitplan_pending_plan_<userId>`, 24h TTL) until they pay to save server-side.

### AI prompt design
The system prompts in `App.jsx` (`SYSTEM_PROMPT`, `ADJUST_SYSTEM_PROMPT`, `SWAP_SYSTEM_PROMPT`, `GRADE_SYSTEM_PROMPT`) encode most of the actual fitness-coaching domain logic (volume guidelines by level, effort/RIR conventions, session-balance and split-structure rules, muscle-group accuracy fixes, age-based guidance). When changing plan-generation behavior, the prompt text is usually the right place to look — the JSON schema each prompt requests is also enforced there, not validated elsewhere in code.

Exercise-naming normalization (equipment + movement only, no grip/stance/tempo detail, so names stay stable across weeks for progress tracking) lives in `SYSTEM_PROMPT`, `ADJUST_SYSTEM_PROMPT`, and `SWAP_SYSTEM_PROMPT`. `GRADE_SYSTEM_PROMPT` doesn't need it: it grades a one-off pasted routine outside the weekly check-in loop, so its exercise names never need to match anything across weeks.

### Progress tracking
Check-ins store per-exercise `{done, reason}` or `{done, avgReps, avgWeight}` under `completed_exercises[day][exerciseName]`. Recommendations (`computeRecommendation` in `App.jsx`) compare the latest check-in's avg reps against the exercise's target rep range, only look one check-in back, and only suggest a deload if two consecutive check-ins were below range — this logic is local (not sent to the AI); the AI-facing adjustment flow (`buildAdjustPrompt`) is a separate path that feeds the same check-in history to `ADJUST_SYSTEM_PROMPT` for a full plan rewrite.

### Environment variables
Frontend (`VITE_` prefixed, safe to expose): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Server-only (used by `api/*.js`, never exposed to the client): `ANTHROPIC_API_KEY`, `RAPIDAPI_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
