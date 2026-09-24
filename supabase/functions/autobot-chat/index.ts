// Autobot's brain: Gemini + tools, with every turn stored in chat_messages so
// the conversation (and every change it made) is the same on every device.

import { json, preflight } from '../_shared/http.ts'
import { isAllowed, secret, userFromRequest, type Db } from '../_shared/db.ts'
import { callsOf, generate, GeminiError, textOf, type GeminiContent, type GeminiPart } from '../_shared/gemini.ts'
import { loadState, type UserState } from '../_shared/state.ts'
import { systemPrompt, type ChatMode } from '../_shared/prompt.ts'
import { Toolbox, TOOL_DECLARATIONS } from '../_shared/tools.ts'
import { formatDate, live, ROLE_ASK, ROLE_LABEL, stableId, wallClock, type ChatMessage } from '../_shared/core/index.ts'

interface Body {
  mode?: ChatMode | 'draft'
  message?: string
  id?: string
  draft?: { contactId?: string; leadId?: string; jobId?: string; channel?: 'email' | 'linkedin'; followUp?: boolean; notes?: string }
}

const MODES: (ChatMode | 'draft')[] = ['chat', 'interview', 'teach', 'brief', 'draft']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  const pre = preflight(req)
  if (pre) return pre
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const auth = await userFromRequest(req)
  if (!auth) return json({ error: 'Sign in first.' }, 401)
  if (!(await isAllowed(auth.user))) return json({ error: 'This Autobot belongs to someone else.' }, 403)

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const mode = MODES.includes(body.mode ?? 'chat') ? (body.mode ?? 'chat') : 'chat'
  const message = (body.message ?? '').trim().slice(0, 8000)
  if ((mode === 'chat' || mode === 'interview' || mode === 'teach') && !message) {
    return json({ error: 'Message is empty' }, 400)
  }

  const { db, user } = auth
  let state: UserState
  try {
    state = await loadState(db, user.id, { history: mode === 'draft' ? 0 : 24 })
  } catch (e) {
    return json({ error: `Couldn’t load your data: ${(e as Error).message}` }, 500)
  }

  const apiKey = await secret('GEMINI_API_KEY', 'gemini_api_key')
  const model = (await secret('GEMINI_MODEL', 'gemini_model')) ?? 'gemini-3.6-flash'

  if (mode === 'draft') return draft(state, body.draft ?? {}, apiKey, model)
  if (mode === 'brief') return brief(db, state, apiKey, model)

  const userMessageId = body.id && UUID.test(body.id) ? body.id : crypto.randomUUID()
  // Server time for both sides of the turn keeps ordering right on every device.
  const { error: saveError } = await db.from('chat_messages').upsert(
    {
      id: userMessageId,
      user_id: user.id,
      role: 'user',
      content: message,
      meta: { mode },
      created_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  )
  if (saveError) return json({ error: saveError.message }, 500)

  if (!apiKey) {
    return reply(db, state, {
      content:
        'My brain isn’t plugged in yet — the Gemini key hasn’t been added to the server. Everything else works; I’ll talk as soon as it’s set.',
      meta: { mode, error: 'no_api_key', reply_to: userMessageId },
    })
  }

  // The device may have synced this message already; don't send it twice.
  const contents = toContents(
    state.history.filter((m) => m.id !== userMessageId),
    state.today,
  )
  contents.push({ role: 'user', parts: [{ text: message }] })
  const toolbox = new Toolbox(db, state, mode === 'interview' ? 'interview' : 'autobot')
  const system = systemPrompt(state, mode as ChatMode)

  try {
    let text = ''
    for (let round = 0; round < 6; round++) {
      const content = await generate({
        apiKey,
        model,
        system,
        contents,
        tools: TOOL_DECLARATIONS,
        signal: AbortSignal.timeout(45_000),
      })
      const calls = callsOf(content)
      if (!calls.length) {
        text = textOf(content)
        break
      }
      contents.push(content)
      const parts: GeminiPart[] = []
      for (const call of calls) {
        const response = await toolbox.run(call)
        parts.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response } })
      }
      contents.push({ role: 'user', parts })
    }
    return reply(db, state, {
      content: text || (toolbox.actions.length ? 'Done ✓' : 'Hmm, I lost my train of thought — say that again?'),
      actions: toolbox.actions,
      meta: { mode, model, reply_to: userMessageId },
    })
  } catch (e) {
    const detail = e instanceof GeminiError ? `${e.status}: ${e.message}` : (e as Error).message
    const friendly =
      e instanceof GeminiError && e.status === 429
        ? 'I’m out of thinking credits for the moment (Gemini rate limit). Give me a minute and try again.'
        : `Something broke on my side (${detail.slice(0, 160)}). Try again?`
    return reply(db, state, {
      content: friendly,
      actions: toolbox.actions,
      meta: { mode, model, error: detail.slice(0, 400), reply_to: userMessageId },
    })
  }
})

function toContents(history: ChatMessage[], today: string): GeminiContent[] {
  const out: GeminiContent[] = []
  for (const m of live(history)) {
    if (m.role === 'system' || (m.meta as { error?: unknown })?.error) continue
    const role = m.role === 'user' ? 'user' : 'model'
    let text = m.content
    const day = m.created_at ? wallClock(new Date(m.created_at)).date : today
    if (role === 'user' && day !== today) text = `(${formatDate(day, { weekday: true })}) ${text}`
    if (role === 'model' && m.actions?.length) text += `\n(Actions taken: ${m.actions.map((a) => a.label).join('; ')})`
    if (!text.trim()) continue
    const last = out[out.length - 1]
    if (last && last.role === role) last.parts.push({ text })
    else out.push({ role, parts: [{ text }] })
  }
  while (out.length && out[0].role !== 'user') out.shift()
  return out
}

async function reply(
  db: Db,
  state: UserState,
  msg: { content: string; actions?: ChatMessage['actions']; meta: Record<string, unknown>; id?: string },
): Promise<Response> {
  const row = {
    id: msg.id ?? crypto.randomUUID(),
    user_id: state.userId,
    role: 'assistant' as const,
    content: msg.content,
    actions: msg.actions ?? [],
    meta: msg.meta,
  }
  const { data, error } = await db.from('chat_messages').upsert(row, { onConflict: 'id' }).select().single()
  if (error) return json({ error: error.message, reply: row }, 500)
  return json({ reply: data })
}

async function brief(db: Db, state: UserState, apiKey: string | null, model: string): Promise<Response> {
  const id = stableId(`${state.userId}:brief:${state.today}`)
  const existing = await db.from('chat_messages').select('*').eq('id', id).maybeSingle()
  if (existing.data) return json({ reply: existing.data })
  if (!apiKey) return json({ reply: null })
  try {
    const content = await generate({
      apiKey,
      model,
      system: systemPrompt(state, 'brief'),
      contents: [{ role: 'user', parts: [{ text: 'Write my home-screen line for right now.' }] }],
      signal: AbortSignal.timeout(30_000),
    })
    const text = textOf(content)
    if (!text) return json({ reply: null })
    return reply(db, state, { id, content: text, meta: { mode: 'brief', kind: 'brief', day: state.today, model } })
  } catch {
    return json({ reply: null })
  }
}

async function draft(
  state: UserState,
  d: NonNullable<Body['draft']>,
  apiKey: string | null,
  model: string,
): Promise<Response> {
  if (!apiKey) return json({ error: 'The Gemini key isn’t set on the server yet.' }, 503)
  const contact = d.contactId ? state.contacts.find((c) => c.id === d.contactId) : undefined
  const lead = d.leadId ? state.leads.find((l) => l.id === d.leadId) : undefined
  const jobId = d.jobId ?? contact?.job_id ?? undefined
  const job = jobId ? state.jobs.find((j) => j.id === jobId) : undefined
  const channel = d.channel ?? contact?.channel ?? (lead ? 'linkedin' : 'email')
  const who = contact
    ? `${contact.name}${contact.role ? ` (${contact.role})` : ''} at ${contact.company || 'their company'}`
    : lead
      ? `${lead.name} (${ROLE_LABEL[lead.role_kind]}: "${lead.headline.slice(0, 100)}") at ${lead.company || 'their company'}`
      : 'an engineer at the company'
  // A clipped lead isn't a connection yet, so the first touch is a connection note.
  const note = Boolean(lead) && !contact && !d.followUp
  const angle = lead
    ? `\nAngle: ${ROLE_ASK[lead.role_kind]}${lead.mutuals ? ` You share mutual connections (${lead.mutual_names || lead.mutuals}) — mention one only if it reads naturally.` : ''}`
    : ''
  const ask = d.followUp
    ? `a short, friendly follow-up to ${who}, who hasn't replied to his referral request yet`
    : `a referral request to ${who}`
  const prompt = `Draft ${ask}${job ? ` for "${job.title || 'a role'}" at ${job.company}${job.url ? ` (${job.url})` : ''}` : ''}.
Channel: ${
    note
      ? 'LinkedIn connection note — no subject, and the body MUST be under 200 characters (LinkedIn cuts it off)'
      : channel === 'linkedin'
        ? 'LinkedIn message — no subject needed, under 90 words'
        : 'email — include a subject line'
  }.${angle}
Write as Pratik. Use relevant facts from <memories> (MS CS at CU Boulder, graduating soon, his strongest projects/skills if known). Specific, warm, confident, one clear ask that's easy to say yes to, no groveling, no placeholders except [link to resume] if needed.${d.notes ? `\nExtra context: ${d.notes.slice(0, 400)}` : ''}`
  try {
    const content = await generate({
      apiKey,
      model,
      system: systemPrompt(state, 'chat'),
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      responseSchema: {
        type: 'object',
        properties: { subject: { type: 'string' }, body: { type: 'string' } },
        required: ['subject', 'body'],
      },
      signal: AbortSignal.timeout(45_000),
    })
    const parsed = JSON.parse(textOf(content)) as { subject?: string; body?: string }
    return json({ draft: { subject: parsed.subject ?? '', body: parsed.body ?? '' } })
  } catch (e) {
    return json({ error: `Couldn’t draft that: ${(e as Error).message.slice(0, 200)}` }, 502)
  }
}
