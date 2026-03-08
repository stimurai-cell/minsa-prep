import { useEffect, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';

import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Training from './pages/Training';
import Simulation from './pages/Simulation';
import Ranking from './pages/Ranking';
import Admin from './pages/Admin';
import Premium from './pages/Premium';
import OnboardingQuiz from './pages/OnboardingQuiz';
import Battle from './pages/Battle';
import SpeedMode from './pages/SpeedMode';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { useVersionCheck } from './hooks/useVersionCheck';
import { RefreshCw } from 'lucide-react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function RootRedirect() {
  const { profile, loading } = useAuthStore();

  if (loading) return null;
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  const { checkSession } = useAuthStore();
  const { needsUpdate } = useVersionCheck();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    const { updateLastActive, user } = useAuthStore.getState();
    if (user) {
      updateLastActive();
      const interval = setInterval(updateLastActive, 120000); // Update every 2 mins
      return () => clearInterval(interval);
    }
  }, [checkSession]); // Refresh when session changes

  return (
    <BrowserRouter>
      {needsUpdate && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-yellow-400 p-2 text-center text-sm font-bold text-slate-900 shadow-lg">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Nova versão disponível!
            <button
              onClick={() => window.location.reload()}
              className="ml-2 rounded-lg bg-slate-900 px-3 py-1 text-white hover:bg-slate-800"
            >
              Atualizar agora
            </button>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<RootRedirect />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="onboarding-quiz" element={<OnboardingQuiz />} />
          <Route path="training" element={<Training />} />
          <Route path="simulation" element={<Simulation />} />
          <Route path="battle" element={<Battle />} />
          <Route path="speed-mode" element={<SpeedMode />} />
          <Route path="ranking" element={<Ranking />} />
          <Route path="premium" element={<Premium />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
