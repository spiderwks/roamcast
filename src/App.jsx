import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { SessionProvider } from './lib/SessionContext'

import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import RoamerLayout from './components/RoamerLayout'
import HomePage from './pages/roamer/HomePage'
import TripsPage from './pages/roamer/TripsPage'
import NewTripPage from './pages/roamer/NewTripPage'
import ProfilePage from './pages/roamer/ProfilePage'
import SessionPage from './pages/roamer/SessionPage'
import MomentCapturePage from './pages/roamer/MomentCapturePage'
import UploadPage from './pages/roamer/UploadPage'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (user === undefined) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-full bg-surface-deep">
      <div className="text-center">
        <p className="text-lg font-medium">
          <span className="text-white">roam</span>
          <span className="text-brand-teal">cast</span>
        </p>
        <p className="text-text-muted text-xs mt-2">Loading…</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/"
          element={<ProtectedRoute><RoamerLayout /></ProtectedRoute>}
        >
          <Route index element={<HomePage />} />
          <Route path="trips" element={<TripsPage />} />
          <Route path="trips/new" element={<NewTripPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Full-screen routes (no bottom nav) */}
        <Route path="/session/:tripId" element={<ProtectedRoute><SessionPage /></ProtectedRoute>} />
        <Route path="/capture/:tripId/:dayId" element={<ProtectedRoute><MomentCapturePage /></ProtectedRoute>} />
        <Route path="/upload/:tripId" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </SessionProvider>
    </BrowserRouter>
  )
}
