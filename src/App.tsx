import { useEffect, ReactNode, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { supabase } from './lib/supabase';

import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import OfflineSync from './components/OfflineSync';
import ToastNotification from './components/ToastNotification';
import { useVersionCheck } from './hooks/useVersionCheck';
import { RefreshCw } from 'lucide-react';
import PaymentNotificationListener from './components/PaymentNotificationListener';
import BattleAutoJoin from './components/BattleAutoJoin';

import { WifiOff } from 'lucide-react';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Training = lazy(() => import('./pages/Training'));
const Simulation = lazy(() => import('./pages/Simulation'));
const Ranking = lazy(() => import('./pages/Ranking'));
const Admin = lazy(() => import('./pages/Admin'));
const Premium = lazy(() => import('./pages/Premium'));
const OnboardingQuiz = lazy(() => import('./pages/OnboardingQuiz'));
const Battle = lazy(() => import('./pages/Battle'));
const BattleArena = lazy(() => import('./pages/BattleArena'));
const SpeedMode = lazy(() => import('./pages/SpeedMode'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Practice = lazy(() => import('./pages/Practice'));
const Social = lazy(() => import('./pages/Social'));
const News = lazy(() => import('./pages/News'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));
const Feedback = lazy(() => import('./pages/Feedback'));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Leagues = lazy(() => import('./pages/Leagues'));
const UserProfileView = lazy(() => import('./pages/UserProfileView'));
const Welcome = lazy(() => import('./pages/Welcome'));
const Notifications = lazy(() => import('./pages/Notifications'));
const EliteWelcome = lazy(() => import('./pages/EliteWelcome'));
const EliteAssessment = lazy(() => import('./pages/EliteAssessment'));
const EliteStrategy = lazy(() => import('./pages/EliteStrategy'));
const ElitePlanPreview = lazy(() => import('./pages/ElitePlanPreview'));

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthStore();

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>;
  if (!user) return <Navigate to="/welcome" replace />;

  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
    </div>
  );
}

function RootRedirect() {
  const { user, profile, loading } = useAuthStore();

  if (loading) return null;
  if (!user) return <Navigate to="/welcome" replace />;
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  const { user, loading, checkSession, updateLastActive } = useAuthStore();
  const { needsUpdate } = useVersionCheck();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOfflineAlert, setShowOfflineAlert] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowOfflineAlert(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setShowOfflineAlert(true);
      setTimeout(() => setShowOfflineAlert(false), 5000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/reset-password') {
        window.location.replace('/reset-password');
        return;
      }

      void checkSession();
    });

    return () => subscription.unsubscribe();
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
      <PaymentNotificationListener />
      <BattleAutoJoin />
      <ToastNotification />
      {showOfflineAlert && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-orange-500 p-2 text-center text-sm font-bold text-white shadow-lg animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-center gap-2">
            <WifiOff className="h-4 w-4" />
            Você está offline. Algumas funcionalidades podem estar limitadas.
          </div>
        </div>
      )}
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
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/welcome" element={<Welcome />} />
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
              <Route path="contest" element={<Navigate to="/simulation" replace />} />
              <Route path="leagues" element={<Leagues />} />
              <Route path="ranking" element={<Ranking />} />
              <Route path="premium" element={<Premium />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="admin" element={<Admin />} />
              <Route path="question-studio" element={<Navigate to="/admin?tab=content" replace />} />
              <Route path="elite-welcome" element={<EliteWelcome />} />
              <Route path="elite-assessment" element={<EliteAssessment />} />
              <Route path="elite-strategy" element={<EliteStrategy />} />
              <Route path="elite-plan-preview" element={<ElitePlanPreview />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
