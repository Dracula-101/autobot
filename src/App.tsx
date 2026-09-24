import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { Layout } from './components/Layout'
import { TodayPage } from './pages/TodayPage'
import { WeekPage } from './pages/WeekPage'
import { SettingsPage } from './pages/SettingsPage'
import { AuthPage } from './pages/AuthPage'
import { OnboardingPage } from './pages/OnboardingPage'

function Guard({ children }: { children: React.ReactNode }) {
  const { profile, authLoading } = useApp()
  if (authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-sage/30" />
      </div>
    )
  }
  if (!profile.onboarded) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route index element={<TodayPage />} />
        <Route path="week" element={<WeekPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const basename =
    import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

  return (
    <AppProvider>
      <BrowserRouter basename={basename === '' ? undefined : basename}>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  )
}
