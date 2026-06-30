# Ask Inc42

An AI analyst and research assistant for the **Indian startup and venture capital ecosystem**, grounded in Inc42 editorial content and Inc42 Datalabs data. Built with Next.js (App Router) and Anthropic's Claude model via the official [`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk).

## Features

- Streaming chat responses (token-by-token) from `claude-haiku-4-5`
- Inc42-scoped system prompt with strict guardrails (only Indian startup/VC topics, Inc42-only sources, no fabricated data, no investment advice)
- Conversation history passed on every turn for follow-up context
- Markdown rendering (bold, bullets, links) with a distinct **Sources** block
- Light theme, mobile-first UI (max-width 480px, centered card on desktop)

## Tech stack

- **Next.js 16** (App Router, Route Handlers)
- **React 19** + TypeScript
- **@anthropic-ai/sdk** (Claude SDK)
- Inline-styled UI + Inter font (`next/font`)

## Getting an Anthropic API key

1. Go to the **[Anthropic Console → API Keys](https://console.anthropic.com/settings/keys)**.
2. Sign in and click **Create Key**.
3. Copy the key (it starts with `sk-ant-`).

## Run locally

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file from the template
cp .env.local.example .env.local

# 3. Add your key to .env.local
#    ANTHROPIC_API_KEY=your_actual_key

# 4. Start the dev server
npm run dev
```

Open <http://localhost:3000>.

> `.env.local` is gitignored and is **never** committed. Only `.env.local.example` (a placeholder) is tracked.

## Project structure

```
app/
  api/chat/route.ts   # Streaming Claude route handler + Inc42 system prompt
  page.tsx            # Chat UI (client component)
  layout.tsx          # Root layout, Inter font, metadata
  globals.css         # Light theme + typing-indicator animation
.env.local.example    # Template for the required ANTHROPIC_API_KEY
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Go to **[vercel.com/new](https://vercel.com/new)** and import the repository.
3. In **Project Settings → Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your Anthropic key
4. Click **Deploy**.

Vercel auto-detects Next.js — no extra build configuration is needed. Redeploy after changing environment variables.

## Notes

- The route runs on the **Node.js runtime** (`export const runtime = 'nodejs'`) because the `@anthropic-ai/sdk` targets Node.
- The model is `claude-haiku-4-5` (Anthropic's fastest, most cost-effective model). Change `MODEL` in `app/api/chat/route.ts` to use a different model.
- Keep your API key server-side only. It is read from `process.env.ANTHROPIC_API_KEY` inside the route handler and is never exposed to the browser.
```
