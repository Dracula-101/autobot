// Minimal Gemini REST client with function calling.

export interface GeminiFunctionCall {
  name: string
  args?: Record<string, unknown>
  id?: string
}

export interface GeminiPart {
  text?: string
  thought?: boolean
  thoughtSignature?: string
  functionCall?: GeminiFunctionCall
  functionResponse?: { name: string; id?: string; response: Record<string, unknown> }
}

export interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

export interface FunctionDeclaration {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface GenerateOptions {
  apiKey: string
  model: string
  system: string
  contents: GeminiContent[]
  tools?: FunctionDeclaration[]
  /** Ask for JSON matching this schema instead of prose */
  responseSchema?: Record<string, unknown>
  signal?: AbortSignal
}

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export async function generate(opts: GenerateOptions): Promise<GeminiContent> {
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.contents,
  }
  if (opts.tools?.length) {
    body.tools = [{ functionDeclarations: opts.tools }]
    body.toolConfig = { functionCallingConfig: { mode: 'AUTO' } }
  }
  if (opts.responseSchema) {
    body.generationConfig = { responseMimeType: 'application/json', responseSchema: opts.responseSchema }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
    body: JSON.stringify(body),
    signal: opts.signal,
  })
  if (!res.ok) {
    const raw = await res.text()
    let detail = raw
    try {
      detail = (JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? raw
    } catch {
      // keep raw text
    }
    throw new GeminiError(detail.slice(0, 400), res.status)
  }
  const data = (await res.json()) as {
    candidates?: { content?: GeminiContent; finishReason?: string }[]
    promptFeedback?: { blockReason?: string }
  }
  const content = data.candidates?.[0]?.content
  if (!content?.parts?.length) {
    const reason = data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? 'empty reply'
    throw new GeminiError(`No reply (${reason})`, 502)
  }
  return { role: 'model', parts: content.parts }
}

export function textOf(content: GeminiContent): string {
  return content.parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
    .trim()
}

export function callsOf(content: GeminiContent): GeminiFunctionCall[] {
  return content.parts.flatMap((p) => (p.functionCall ? [p.functionCall] : []))
}
