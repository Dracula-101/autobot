import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useApp, useSyncStatus } from './lib/app'
import { Autobot } from './components/Autobot'
import { Layout } from './components/Shell'
import { TodayPage } from './pages/Today'
import { ChatPage } from './pages/Chat'
import { HuntPage } from './pages/Hunt'
import { PrepPage } from './pages/Prep'
import { BodyPage } from './pages/Body'
import { MePage } from './pages/Me'
import { MemoryPage } from './pages/Memory'
import { ChangesPage } from './pages/Changes'
import { AuthPage } from './pages/Auth'
import { WelcomePage } from './pages/Welcome'

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3">
      <Autobot size={88} mood="thinking" />
      <p className="text-[14px] font-bold text-ink-3">Waking up…</p>
    </div>
  )
}

function Guard({ children }: { children: ReactNode }) {
  const { ready, cloud, user, store, profile, settings } = useApp()
  const { hydrated } = useSyncStatus()
  const { pathname } = useLocation()
  if (!ready) return <Splash />
  if (cloud && !user) return <Navigate to="/auth" replace />
  if (!store) return <Splash />
  if (hydrated && profile && !settings.onboarded && pathname !== '/welcome') return <Navigate to="/welcome" replace />
  return <>{children}</>
}

export default function App() {
  const { ready, user, cloud } = useApp()
  return (
    <Routes>
      <Route path="/auth" element={ready && (!cloud || user) ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route
        path="/welcome"
        element={
          <Guard>
            <WelcomePage />
          </Guard>
        }
      />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route index element={<TodayPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="hunt" element={<HuntPage />} />
        <Route path="prep" element={<PrepPage />} />
        <Route path="body" element={<BodyPage />} />
        <Route path="me" element={<MePage />} />
        <Route path="me/memory" element={<MemoryPage />} />
        <Route path="me/changes" element={<ChangesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
