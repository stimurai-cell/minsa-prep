import { useEffect, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';

import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineSync from './components/OfflineSync';
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
import BattleArena from './pages/BattleArena';
import SpeedMode from './pages/SpeedMode';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Practice from './pages/Practice';
import Social from './pages/Social';
import News from './pages/News';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import EditProfile from './pages/EditProfile';
import HelpCenter from './pages/HelpCenter';
import Feedback from './pages/Feedback';
import TermsOfUse from './pages/TermsOfUse';
import PrivacyPolicy from './pages/PrivacyPolicy';
import PublicExam from './pages/PublicExam';
import Leagues from './pages/Leagues';
import UserProfileView from './pages/UserProfileView';
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
  const { user, loading, checkSession, updateLastActive } = useAuthStore();
  const { needsUpdate } = useVersionCheck();

  useEffect(() => {
    checkSession();

    // PWA: Capturar o evento de instalação para uso global
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [checkSession]);

  useEffect(() => {
    if (user && !loading) {
      updateLastActive();
      const interval = setInterval(updateLastActive, 120000); // 2 mins
      return () => clearInterval(interval);
    }
  }, [user, loading, updateLastActive]);

  return (
    <BrowserRouter>
      <OfflineSync />
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
      <ErrorBoundary>
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
            <Route path="battle/:matchId" element={<BattleArena />} />
            <Route path="speed-mode" element={<SpeedMode />} />
            <Route path="practice" element={<Practice />} />
            <Route path="social" element={<Social />} />
            <Route path="news" element={<News />} />
            <Route path="profile" element={<Profile />} />
            <Route path="profile/:userId" element={<UserProfileView />} />
            <Route path="settings" element={<Settings />} />
            <Route path="settings/profile" element={<EditProfile />} />
            <Route path="help" element={<HelpCenter />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="terms" element={<TermsOfUse />} />
            <Route path="privacy" element={<PrivacyPolicy />} />
            <Route path="contest" element={<PublicExam />} />
            <Route path="leagues" element={<Leagues />} />
            <Route path="ranking" element={<Ranking />} />
            <Route path="premium" element={<Premium />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
