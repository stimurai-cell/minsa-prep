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

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<RootRedirect />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="training" element={<Training />} />
          <Route path="simulation" element={<Simulation />} />
          <Route path="ranking" element={<Ranking />} />
          <Route path="premium" element={<Premium />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
