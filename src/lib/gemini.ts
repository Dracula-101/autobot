export type ChatMsg = { role: 'user' | 'model'; text: string }

const KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim()

export function geminiConfigured(): boolean {
  return Boolean(KEY && KEY.length > 10)
}

export async function askBuddy(messages: ChatMsg[], context: string): Promise<string> {
  if (!geminiConfigured()) {
    throw new Error('Gemini key not configured on this build.')
  }

  const system = `You are Autobot — a lock-in buddy in Boulder (timezone America/Denver / MDT). Voice: warm, short, concrete — not cutesy, not corporate. Priorities: job hunt → LeetCode → fitness. Tue/Thu classes: Linux SysAdmin 12:30–1:45 ECCR 1B55, Computer Graphics 3:30–4:45 ECCR 200, Pro Masters Project 5:00–6:15 ECCS 1B12. Home is not for deep work. If they ask to mark something done or missed, include one line ACTION:done:<short task hint> or ACTION:missed:<short task hint> then a normal sentence. Context:\n${context}`

  const contents = [
    { role: 'user', parts: [{ text: system }] },
    { role: 'model', parts: [{ text: 'Got it. I’m with you — what’s up?' }] },
    ...messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    })),
  ]

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
    encodeURIComponent(KEY!)

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 160)}`)
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  return (
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim() ||
    'Blank reply — try again?'
  )
}
