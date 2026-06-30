'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type CSSProperties } from 'react'

/* ---- Inc42 design tokens ---- */
const INK = '#141414' // drawer / brand black
const BG = '#FFFFFF' // app background
const ASSISTANT_BG = '#F7F4EE' // tinted assistant row
const SECONDARY = '#EDE8DE'
const BORDER = '#E7E2D8'
const ACCENT = '#E8401C'
const TEXT = '#1A1A1A'
const TEXT_2 = '#6B6560'
const BACKDROP = '#E4DFD4' // desktop area around the phone frame
const DRAWER_TEXT = '#E9E6DF'
const DRAWER_MUTED = '#9A958C'

type Msg = { role: 'user' | 'model'; parts: { text: string }[] }

const SUGGESTIONS = [
  {
    title: 'Active B2B SaaS investors',
    prompt: 'Which investors are most active in B2B SaaS this quarter?',
  },
  {
    title: 'BNPL regulation in India',
    prompt: 'What happened to BNPL regulation in India recently?',
  },
  {
    title: 'Top Series A deals, 2025',
    prompt: 'What were the top Series A deals in India in 2025?',
  },
  {
    title: 'Active fintech angels',
    prompt: 'Who are the most active angel investors in Indian fintech?',
  },
]

/* ---- Lightweight markdown rendering (bold, links, bullets, headings) ---- */

const sourcePillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  verticalAlign: 'middle',
  background: SECONDARY,
  border: `1px solid ${BORDER}`,
  color: ACCENT,
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.2,
  padding: '2px 8px 2px 6px',
  borderRadius: 999,
  textDecoration: 'none',
  margin: '0 3px',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const regex = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    if (match[1] !== undefined) {
      const raw = match[2].trim()
      const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
      const label = match[1]
      if (/^\s*sources?\b/i.test(label)) {
        // Inline source citation → compact clickable pill button.
        let display = label.replace(/^\s*sources?\s*[:–—-]?\s*/i, '').trim()
        if (!display) display = 'Inc42'
        const short = display.length > 30 ? `${display.slice(0, 29).trimEnd()}…` : display
        nodes.push(
          <a
            key={`${keyPrefix}-src-${i}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={display}
            style={sourcePillStyle}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"
                stroke={ACCENT}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {short}
          </a>,
        )
      } else {
        nodes.push(
          <a
            key={`${keyPrefix}-l-${i}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: ACCENT, textDecoration: 'underline', fontWeight: 500 }}
          >
            {label}
          </a>,
        )
      }
    } else if (match[3] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{match[3]}</strong>)
    }
    lastIndex = regex.lastIndex
    i++
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

function renderBlocks(lines: string[], keyPrefix: string): React.ReactNode[] {
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const trimmed = lines[i].trim()

    if (trimmed === '' || /^-{3,}$/.test(trimmed)) {
      i++
      continue
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      blocks.push(
        <p
          key={`${keyPrefix}-h-${key++}`}
          style={{ margin: '12px 0 4px', fontWeight: 700, fontSize: 14.5 }}
        >
          {renderInline(heading[2], `${keyPrefix}-hi-${key}`)}
        </p>,
      )
      i++
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={`${keyPrefix}-ul-${key++}`} style={{ margin: '7px 0', paddingLeft: 18 }}>
          {items.map((it, idx) => (
            <li key={idx} style={{ marginBottom: 5 }}>
              {renderInline(it, `${keyPrefix}-li-${key}-${idx}`)}
            </li>
          ))}
        </ul>,
      )
      continue
    }

    blocks.push(
      <p key={`${keyPrefix}-p-${key++}`} style={{ margin: '7px 0', lineHeight: 1.55 }}>
        {renderInline(trimmed, `${keyPrefix}-pi-${key}`)}
      </p>,
    )
    i++
  }

  return blocks
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split('\n')

  // Citations are now inline pills. If the model still appends a trailing
  // "📚 Sources mentioned" list, drop it (and any dangling "---" before it).
  const srcIdx = lines.findIndex((l) => /📚\s*sources/i.test(l))
  const bodyLines = srcIdx === -1 ? lines : lines.slice(0, srcIdx)
  while (bodyLines.length && /^-{3,}$/.test(bodyLines[bodyLines.length - 1].trim())) {
    bodyLines.pop()
  }

  return <>{renderBlocks(bodyLines, 'body')}</>
}

/* ---- Avatars ---- */
function AssistantAvatar() {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: 7,
        background: ACCENT,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize: 11,
        letterSpacing: -0.5,
      }}
    >
      42
    </div>
  )
}

function UserAvatar() {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        borderRadius: '50%',
        background: INK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="8" r="3.4" stroke="#fff" strokeWidth="1.8" />
        <path
          d="M5 19.5c0-3.2 3.1-5 7-5s7 1.8 7 5"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map((n) => (
        <span
          key={n}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: ACCENT,
            display: 'inline-block',
            animation: 'dotPulse 1.2s infinite ease-in-out',
            animationDelay: `${n * 0.15}s`,
          }}
        />
      ))}
    </span>
  )
}

const LOGO_RATIO = 2000 / 595 // ≈ 3.361

function Logo({ height }: { height: number }) {
  return (
    <Image
      src="/inc42-logo.png"
      alt="Inc42"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      priority
      style={{ display: 'block', height, width: 'auto' }}
    />
  )
}

export default function Page() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 600px)')
    const apply = () => setIsDesktop(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function replaceLast(arr: Msg[], text: string): Msg[] {
    const copy = arr.slice()
    const last = copy[copy.length - 1]
    copy[copy.length - 1] = { ...last, parts: [{ text }] }
    return copy
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim()
    if (!text || isStreaming) return

    setInput('')
    setDrawerOpen(false)
    const history = messages
    const userMsg: Msg = { role: 'user', parts: [{ text }] }
    const placeholder: Msg = { role: 'model', parts: [{ text: '' }] }
    setMessages([...messages, userMsg, placeholder])
    setIsStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })

      if (!res.ok || !res.body) {
        const errText =
          res.status === 429
            ? 'Too many requests — please wait a moment before asking again.'
            : 'Something went wrong. Please try again in a moment.'
        setMessages((prev) => replaceLast(prev, errText))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += decoder.decode(value, { stream: true })
        setMessages((prev) => replaceLast(prev, acc))
      }
      if (!acc.trim()) {
        setMessages((prev) =>
          replaceLast(prev, 'Something went wrong. Please try again in a moment.'),
        )
      }
    } catch {
      setMessages((prev) =>
        replaceLast(prev, 'Something went wrong. Please try again in a moment.'),
      )
    } finally {
      setIsStreaming(false)
    }
  }

  function newChat() {
    if (isStreaming) return
    setMessages([])
    setInput('')
    setDrawerOpen(false)
    inputRef.current?.focus()
  }

  const canSend = input.trim().length > 0 && !isStreaming
  const showEmptyState = messages.length === 0

  return (
    <div style={{ ...styles.viewport, padding: isDesktop ? 24 : 0 }}>
      <div
        style={{
          ...styles.phone,
          borderRadius: isDesktop ? 26 : 0,
          maxWidth: isDesktop ? 420 : '100%',
          boxShadow: isDesktop ? '0 18px 50px rgba(20,20,20,0.22)' : 'none',
        }}
      >
        {/* Drawer overlay */}
        <div
          style={{
            ...styles.drawerOverlay,
            opacity: drawerOpen ? 1 : 0,
            pointerEvents: drawerOpen ? 'auto' : 'none',
          }}
          onClick={() => setDrawerOpen(false)}
        />

        {/* Drawer */}
        <aside
          style={{
            ...styles.drawer,
            transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          }}
        >
          <div style={styles.drawerTop}>
            <div style={{ padding: '6px 6px 14px' }}>
              <span style={styles.logoChip}>
                <Logo height={22} />
              </span>
            </div>
            <button type="button" onClick={newChat} style={styles.newChatBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
              New chat
            </button>

            <div style={styles.drawerLabel}>Suggested</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.prompt}
                  type="button"
                  onClick={() => send(s.prompt)}
                  style={styles.drawerItem}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.drawerFooter}>
            <div style={{ fontWeight: 700, color: DRAWER_TEXT }}>Ask Inc42</div>
            <div>AI analyst · Indian startup &amp; VC ecosystem</div>
            <div style={{ marginTop: 6, color: DRAWER_MUTED }}>Powered by Claude</div>
          </div>
        </aside>

        {/* App bar */}
        <header style={styles.appbar}>
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setDrawerOpen(true)}
            style={styles.iconBtn}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke={TEXT} strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div style={styles.appbarTitle}>
            <Logo height={18} />
            <span style={{ fontSize: 10.5, color: TEXT_2, marginTop: 3 }}>
              Ask Inc42 · Claude
            </span>
          </div>
          <button
            type="button"
            onClick={newChat}
            style={styles.iconBtn}
            aria-label="New chat"
            title="New chat"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                stroke={TEXT}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </header>

        {/* Conversation */}
        <div style={styles.scroll}>
          {showEmptyState ? (
            <div style={styles.emptyWrap}>
              <div style={{ marginBottom: 20 }}>
                <Logo height={46} />
              </div>
              <h1 style={styles.heroTitle}>Ask me anything about the Indian startup ecosystem</h1>
              <p style={styles.heroSub}>
                Grounded in Inc42 editorial and Datalabs data — answers cite real inc42.com sources.
              </p>
              <div style={styles.cardStack}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.prompt}
                    type="button"
                    onClick={() => send(s.prompt)}
                    style={styles.card}
                  >
                    <div style={{ fontWeight: 600, color: TEXT, fontSize: 13.5 }}>{s.title}</div>
                    <div style={{ color: TEXT_2, fontSize: 12, marginTop: 2 }}>{s.prompt}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              {messages.map((m, idx) => {
                const text = m.parts[0]?.text ?? ''
                const isUser = m.role === 'user'
                const isLast = idx === messages.length - 1
                const streamingEmpty = isStreaming && isLast && !isUser && text === ''
                return (
                  <div
                    key={idx}
                    style={{
                      ...styles.row,
                      background: isUser ? BG : ASSISTANT_BG,
                      borderBottom: `1px solid ${BORDER}`,
                    }}
                  >
                    {isUser ? <UserAvatar /> : <AssistantAvatar />}
                    <div style={styles.msgContent}>
                      <div style={styles.msgAuthor}>{isUser ? 'You' : 'Ask Inc42'}</div>
                      {isUser ? (
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{text}</div>
                      ) : streamingEmpty ? (
                        <TypingDots />
                      ) : (
                        <MarkdownMessage content={text} />
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div style={styles.composerWrap}>
          <div style={styles.composer}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask about startups, funding, investors..."
              rows={1}
              style={styles.textarea}
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={!canSend}
              aria-label="Send"
              style={{
                ...styles.sendBtn,
                background: canSend ? ACCENT : BORDER,
                cursor: canSend ? 'pointer' : 'default',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 19V5M12 5l-6 6M12 5l6 6"
                  stroke="#fff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          <div style={styles.disclaimer}>
            Retrieves from inc42.com · can make mistakes — verify key figures.
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---- Styles ---- */
const styles: Record<string, CSSProperties> = {
  viewport: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: BACKDROP,
  },
  phone: {
    position: 'relative',
    width: '100%',
    height: '100%',
    maxHeight: 920,
    display: 'flex',
    flexDirection: 'column',
    background: BG,
    overflow: 'hidden',
  },
  drawerOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 25,
    transition: 'opacity 0.25s ease',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '80%',
    maxWidth: 300,
    background: INK,
    color: DRAWER_TEXT,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: 12,
    zIndex: 30,
    transition: 'transform 0.25s ease',
  },
  drawerTop: { display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' },
  newChatBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    background: 'transparent',
    border: `1px solid #3A3A3A`,
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    padding: '10px 12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  drawerLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: DRAWER_MUTED,
    padding: '16px 8px 4px',
  },
  drawerItem: {
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    color: DRAWER_TEXT,
    fontSize: 13.5,
    padding: '9px 10px',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  drawerFooter: {
    fontSize: 11.5,
    color: DRAWER_MUTED,
    lineHeight: 1.5,
    padding: '12px 8px 6px',
    borderTop: `1px solid #2A2A2A`,
  },
  appbar: {
    flexShrink: 0,
    height: 54,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 8px',
    borderBottom: `1px solid ${BORDER}`,
    background: BG,
  },
  appbarTitle: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    lineHeight: 1.2,
  },
  logoChip: {
    display: 'inline-flex',
    background: '#fff',
    borderRadius: 8,
    padding: '7px 11px',
  },
  iconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 9,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  scroll: { flex: 1, overflowY: 'auto', background: BG, WebkitOverflowScrolling: 'touch' },
  emptyWrap: {
    minHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '24px 18px',
  },
  heroLogo: {
    width: 52,
    height: 52,
    borderRadius: 13,
    background: ACCENT,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 22,
    letterSpacing: -1,
    marginBottom: 16,
  },
  heroTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: TEXT,
    textAlign: 'center',
    lineHeight: 1.3,
  },
  heroSub: {
    margin: '8px 0 0',
    fontSize: 13,
    color: TEXT_2,
    textAlign: 'center',
    maxWidth: 320,
  },
  cardStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  card: {
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: '12px 14px',
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  row: {
    display: 'flex',
    gap: 12,
    padding: '16px 16px',
  },
  msgContent: { flex: 1, minWidth: 0, color: TEXT, fontSize: 14 },
  msgAuthor: {
    fontSize: 11.5,
    fontWeight: 700,
    color: TEXT,
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  composerWrap: {
    flexShrink: 0,
    padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
    background: BG,
    borderTop: `1px solid ${BORDER}`,
  },
  composer: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 7,
    background: '#fff',
    border: `1px solid ${BORDER}`,
    borderRadius: 24,
    padding: 5,
    boxShadow: '0 2px 8px rgba(20,20,20,0.05)',
  },
  textarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    resize: 'none',
    fontSize: 15,
    color: TEXT,
    fontFamily: 'inherit',
    padding: '9px 12px',
    maxHeight: 140,
    lineHeight: 1.45,
  },
  sendBtn: {
    flexShrink: 0,
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s ease',
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 11,
    color: TEXT_2,
    marginTop: 7,
  },
}
