# Fynora — AI Finance App (PRD v3)

## Overview
Fynora is a privacy-first, AI-driven personal finance companion for Indian users with **full native-script localization in 11 languages**.

## Tech stack
- Frontend: Expo Router (SDK 54), React Native, TypeScript
- Backend: FastAPI + Motor (async MongoDB)
- AI: Claude Sonnet 4.5 via Emergent Universal Key (`emergentintegrations`)
- Payments: Razorpay (placeholder keys — drop real keys to activate)
- OCR: Claude Vision (`/api/ocr/receipt`)

## Production-Ready Features
- **Auth**: email + password, forgot/reset, Google OAuth (Emergent-managed), JWT with remember-me
- **Transactions**: manual entry, bank SMS auto-parse (regex), categorization, search & filters, calendar/range views
- **Budgets**: per-category, monthly, progress with overrun warnings
- **Goals**: savings goals with icons, progress tracking
- **AI Insights**: weekly summaries, recurring expense detection, money tips (Claude Sonnet 4.5)
- **Achievements & Streaks**: 6 badges, no-spend streaks
- **Premium (Fynora Pro)**: Razorpay monthly/yearly, status verification, unlimited OCR
- **OCR Receipt**: Claude Vision auto-fills amount/merchant/category
- **Backup & Restore**: JSON export/import, CSV export
- **Profile / Settings**: theme (dark/light), language (11), notifications toggle

## Localization (PRIORITY 1 — COMPLETE)
- **11 languages, all in native scripts:**
  English, हिन्दी (Hindi), मराठी (Marathi), ગુજરાતી (Gujarati), தமிழ் (Tamil),
  తెలుగు (Telugu), മലയാളം (Malayalam), বাংলা (Bengali), ਪੰਜਾਬੀ (Punjabi),
  اردو (Urdu), ଓଡ଼ିଆ (Odia)
- **Single source of truth**: `frontend/src/lib/i18n.ts` (277 keys per language)
- **Persistent**: language saved to AsyncStorage (`fynora_lang`), restored on every app launch
- **No mixed languages**: when a non-English language is picked, every screen, dialog, tab, button, category and AI message renders in that language only
- **Premium bottom-sheet picker** with native-script labels + English subtitle, radio selection, instant app-wide refresh

## Backend routes (45)
- `/api/auth/*` — signup, login, google, me, forgot, reset, logout
- `/api/transactions*` — list, create, update, delete, parse-sms
- `/api/budgets*`, `/api/goals*`, `/api/achievements*`
- `/api/insights*` — Claude-powered, language-aware
- `/api/dashboard`, `/api/calendar`, `/api/streak`, `/api/merchants`, `/api/recurring`
- `/api/ocr/receipt` — Claude Vision receipt OCR
- `/api/premium/*` — status, plans, order, verify, webhook (Razorpay)
- `/api/backup`, `/api/restore`, `/api/export/csv`
- `/api/settings`, `/api/profile`, `/api/register-push`

## Environment
- Frontend: `EXPO_PUBLIC_BACKEND_URL`, `EXPO_TUNNEL_SUBDOMAIN`, `EXPO_PACKAGER_PROXY_URL` (protected)
- Backend: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `EMERGENT_LLM_KEY`, `EMERGENT_PUSH_KEY`, `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`

## How to test
1. `demo@fynora.app` / `demo1234` (see `memory/test_credentials.md`)
2. Profile → भाषा/Language → pick any language → entire app instantly switches
3. SMS Scan: paste demo bank texts, app auto-parses transactions
4. Add budget / goal / transaction in any language
