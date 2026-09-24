import type { ChatMessage } from '@core/index.ts'
import { supabase } from './supabase'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function invoke<T>(fn: 'autobot-chat' | 'autobot-notify', body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new ApiError('Autobot’s brain lives in the cloud — sign in to talk to it.', 0)
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    let message = error.message
    const response = (error as { context?: Response }).context
    if (response && typeof response.json === 'function') {
      try {
        const parsed = (await response.clone().json()) as { error?: string }
        if (parsed.error) message = parsed.error
      } catch {
        // not JSON
      }
    }
    throw new ApiError(message, response?.status ?? 0)
  }
  return data as T
}

export type ChatMode = 'chat' | 'interview' | 'teach'

export interface Draft {
  subject: string
  body: string
}

export const api = {
  chat: (input: { id: string; message: string; mode: ChatMode }) =>
    invoke<{ reply: ChatMessage }>('autobot-chat', input),
  brief: () => invoke<{ reply: ChatMessage | null }>('autobot-chat', { mode: 'brief' }),
  draft: (draft: { contactId?: string; jobId?: string; channel?: 'email' | 'linkedin'; followUp?: boolean; notes?: string }) =>
    invoke<{ draft: Draft }>('autobot-chat', { mode: 'draft', draft }),
  vapidKey: () => invoke<{ publicKey: string }>('autobot-notify', { action: 'vapid' }),
  testPush: () => invoke<{ devices: number; delivered: number; errors: string[] }>('autobot-notify', { action: 'test' }),
}
