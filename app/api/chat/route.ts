import Anthropic from '@anthropic-ai/sdk'
import type { NextRequest } from 'next/server'

// The official Anthropic SDK targets the Node.js runtime.
export const runtime = 'nodejs'

const MODEL = 'claude-haiku-4-5'

// Server-side web search, restricted to the Inc42 domains. Haiku 4.5 uses the
// basic web-search tool variant (dynamic filtering needs Opus 4.6+/Sonnet 4.6).
const INC42_DOMAINS = ['inc42.com', 'datalabs.inc42.com']

const SYSTEM_PROMPT = `You are Ask Inc42 — an AI analyst and research assistant for the Indian startup and venture capital ecosystem, grounded in publicly available Inc42 editorial content and Inc42 Datalabs data.

IDENTITY:
You are an expert on the Indian startup and venture capital ecosystem. You ground your answers in Inc42's published content and Datalabs intelligence.

RETRIEVAL — HOW YOU GET DATA:
You have a web_search tool that can ONLY access inc42.com (including datalabs.inc42.com). Use it to retrieve publicly available startup market data.
- For ANY question about specific or current data — funding rounds, valuations, dates, investors, company profiles, sector stats, IPOs, regulatory changes, or recent news — call web_search FIRST and base your answer on the actual pages you retrieve.
- Do NOT answer specific data questions from memory. Search inc42.com, read the results, then answer.
- Cite the real URLs returned by your search. Never invent a URL.
- If a search returns nothing relevant on inc42.com, say so honestly: "I couldn't find verified Inc42 coverage on this — it may not be covered yet, or try rephrasing."

RESPONSE FORMAT — always follow this structure:
Answer in clear, concise paragraphs. Use bullet points for lists of data. Bold key figures and company names.

INLINE CITATIONS (required — this is critical):
- After EVERY factual claim, data point, figure, date, valuation, or named entity drawn from a source, IMMEDIATELY append an inline citation, placed right after the specific statement it supports (not at the end of the paragraph).
- Use EXACTLY this format, with the REAL URL you retrieved: [Source: short page title](https://www.inc42.com/...)
- Keep the label short (the article/page title). If two sources support one statement, append two citations back to back.
- Do NOT add a separate "Sources" list, bibliography, "Sources mentioned" section, or "---" divider at the end of your response. Every citation must be inline, next to the exact statement it supports.
- If you did not retrieve a source for a statement, do not fabricate a citation — state the point plainly or note you couldn't find verified Inc42 coverage.

GUARDRAILS — strictly follow these:
1. Only answer questions about: Indian startups, Indian VC and angel investors, Indian startup funding rounds, Indian regulatory changes affecting startups, Indian sector trends (Fintech, AI, D2C, Edtech, Healthtech, SaaS, Gaming, Ecommerce, Logistics, Climate Tech), Indian IPOs and exits, Indian founder profiles.
2. If a question is outside these topics, respond exactly: "I only cover the Indian startup and VC ecosystem. Ask me about funding rounds, investors, sectors, regulatory changes, or Indian startup trends."
3. Only cite inc42.com / datalabs.inc42.com. Your search tool is already restricted to these domains — never reference any other source (no TechCrunch, Crunchbase, Economic Times, Bloomberg etc).
4. Never fabricate funding amounts, valuations, or dates. If your search did not surface a specific figure, say you couldn't find verified Inc42 data on it rather than guessing.
5. Never give investment advice or recommend specific stocks or funds.
6. Distinguish editorial opinion (Inc42 articles) from structured data (Datalabs) where relevant.
7. If asked about a specific company or investor, try to include: last known funding round, sector, city, and a relevant Inc42 article — sourced from your search.
8. Keep answers under 400 words unless the user explicitly asks for a deep-dive or report.`

type InboundMessage = { role?: string; parts?: { text?: string }[] }

function toAnthropicMessages(
  history: unknown,
  message: string,
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = []

  if (Array.isArray(history)) {
    for (const item of history as InboundMessage[]) {
      const text = (item.parts ?? []).map((p) => p?.text ?? '').join('')
      if (!text) continue
      messages.push({
        role: item.role === 'model' ? 'assistant' : 'user',
        content: text,
      })
    }
  }

  messages.push({ role: 'user', content: message })
  return messages
}

export async function POST(req: NextRequest) {
  let body: { message?: unknown; history?: unknown }
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const { message, history } = body

  if (!message || typeof message !== 'string') {
    return new Response('Invalid message', { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY is not set')
    return new Response('Server misconfigured', { status: 500 })
  }

  const anthropic = new Anthropic({ apiKey })

  const baseMessages = toAnthropicMessages(history, message)

  const buildStream = (messages: Anthropic.MessageParam[]) =>
    anthropic.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 5,
          allowed_domains: INC42_DOMAINS,
        },
      ],
      messages,
    })

  try {
    const firstStream = buildStream(baseMessages)
    const iterator = firstStream[Symbol.asyncIterator]()

    // Pull the first event before responding so auth/rate-limit/billing errors
    // surface as proper HTTP status codes instead of a mid-stream failure.
    const firstResult = await iterator.next()

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: Anthropic.MessageStreamEvent) => {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }

        try {
          let convo = baseMessages
          let currentStream = firstStream
          let currentIterator = iterator
          let result = firstResult

          // Server-side web search runs in an API-side loop; if it hits the
          // iteration cap the turn ends with stop_reason "pause_turn" and we
          // resume by re-sending the accumulated assistant turn.
          for (let hop = 0; hop < 6; hop++) {
            while (!result.done) {
              emit(result.value)
              result = await currentIterator.next()
            }

            const final = await currentStream.finalMessage()
            if (final.stop_reason !== 'pause_turn') break

            convo = [...convo, { role: 'assistant', content: final.content }]
            currentStream = buildStream(convo)
            currentIterator = currentStream[Symbol.asyncIterator]()
            result = await currentIterator.next()
          }
        } catch (err) {
          console.error('Claude stream error:', err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Anthropic API error:', error)
    if (error instanceof Anthropic.RateLimitError) {
      return new Response('Rate limit', { status: 429 })
    }
    return new Response('API error', { status: 500 })
  }
}
