import { useLocation } from 'react-router-dom'
import { ChatPanel } from '../components/ChatPanel'

export function ChatPage() {
  const prefill = (useLocation().state as { prefill?: string } | null)?.prefill ?? ''
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[860px] flex-col lg:border-x lg:border-line">
      <ChatPanel initialInput={prefill} />
    </div>
  )
}
