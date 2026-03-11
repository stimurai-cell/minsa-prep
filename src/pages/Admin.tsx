import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

// Admin Components
import AdminLayout from './Admin/AdminLayout';
import AdminDashboard from './Admin/AdminDashboard';
import AdminUsers from './Admin/AdminUsers';
import AdminFinance from './Admin/AdminFinance';
import AdminContent from './Admin/AdminContent';
import AdminMonitor from './Admin/AdminMonitor';
import AdminSupport from './Admin/AdminSupport';
import AdminProfile from './Admin/AdminProfile';

import AdminBackup from '../components/AdminBackup';
import AdminNews from '../components/AdminNews';

export default function Admin() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'dashboard');

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
  }, [profile, navigate]);

  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  // O AdminLayout reencaminhará ou mostrará "Acesso Restrito" se o role não for admin,
  // mas adicionamos aqui proteção extra para nem tentar renderizar o layout.
  if (profile?.role !== 'admin') {
    return null;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'users':
        return <AdminUsers />;
      case 'payments':
        return <AdminFinance />;
      case 'content':
        return <AdminContent />;
      case 'monitor':
        return <AdminMonitor />;
      case 'support':
        return <AdminSupport />;
      case 'profile':
        return <AdminProfile />;
      case 'backup':
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-2xl font-black text-gray-900 border-b border-gray-100 pb-4">Backup e Importação</h2>
            <AdminBackup />
          </div>
        );
      case 'news':
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-2xl font-black text-gray-900 border-b border-gray-100 pb-4">Gestão Social e Alertas</h2>
            <AdminNews />
          </div>
        );
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTabContent()}
    </AdminLayout>
  );
}
