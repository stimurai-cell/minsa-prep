import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Database, CreditCard,
    LifeBuoy, User, LogOut, Menu, X, ChevronRight, Activity,
    Megaphone, HardDrive, Brain
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface AdminLayoutProps {
    children: ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export default function AdminLayout({ children, activeTab, onTabChange }: AdminLayoutProps) {
    const { profile, signOut } = useAuthStore();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Proteção de Rota
    if (profile?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 min-h-screen">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                    <X className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
                <p className="text-slate-500 mt-2">Área exclusiva para administradores do sistema.</p>
                <button onClick={() => navigate('/')} className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-full font-bold">
                    Voltar ao Início
                </button>
            </div>
        );
    }

    const navGroups = [
        {
            title: "Dashboard",
            items: [
                { id: 'dashboard', label: 'Estatísticas', icon: LayoutDashboard },
                { id: 'monitor', label: 'Actividade Real', icon: Activity }
            ]
        },
        {
            title: "Utilizadores",
            items: [
                { id: 'users', label: 'Membros', icon: Users },
                { id: 'elite', label: 'Elite', icon: Brain },
            ]
        },
        {
            title: "Conteúdo e Sistema",
            items: [
                { id: 'content', label: 'Gerir Questões', icon: Database },
                { id: 'news', label: 'Notificações e Novidades', icon: Megaphone },
                { id: 'backup', label: 'Backup', icon: HardDrive }
            ]
        },
        {
            title: "Financeiro",
            items: [
                { id: 'payments', label: 'Pagamentos', icon: CreditCard }
            ]
        },
        {
            title: "Configurações",
            items: [
                { id: 'support', label: 'Suporte', icon: LifeBuoy },
                { id: 'profile', label: 'O Meu Perfil', icon: User }
            ]
        }
    ];

    const mobileQuickLinks = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Resumo' },
        { id: 'users', icon: Users, label: 'Membros' },
        { id: 'elite', icon: Brain, label: 'Elite' },
        { id: 'news', icon: Megaphone, label: 'Alertas' },
        { id: 'payments', icon: CreditCard, label: 'Finanças' },
    ];

    const handleTabClick = (id: string) => {
        onTabChange(id);
        setMobileMenuOpen(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row pb-20 md:pb-0">
            {/* --- DESKTOP SIDEBAR --- */}
            <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200 h-screen sticky top-0 overflow-y-auto">
                <div className="p-6 border-b border-slate-100">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-700 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-md mb-2">
                        M
                    </div>
                    <h2 className="font-black text-slate-900 text-lg">MINSA Admin</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Centro de Gestão</p>
                </div>

                <div className="flex-1 py-6 px-4 space-y-8">
                    {navGroups.map((group, idx) => (
                        <div key={idx} className="space-y-2">
                            <h3 className="px-3 text-xs font-black text-slate-400 uppercase tracking-widest">
                                {group.title}
                            </h3>
                            <ul className="space-y-1">
                                {group.items.map((item) => (
                                    <li key={item.id}>
                                        <button
                                            onClick={() => handleTabClick(item.id)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all ${activeTab === item.id
                                                ? 'bg-slate-900 text-white shadow-md'
                                                : 'text-slate-600 hover:bg-slate-100'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-emerald-400' : 'text-slate-400'}`} />
                                                <span>{item.label}</span>
                                            </div>
                                            {activeTab === item.id && <ChevronRight className="w-4 h-4 text-slate-500" />}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={() => { signOut(); navigate('/'); }}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-red-600 font-bold hover:bg-red-50 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        Terminar Sessão
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT AREA --- */}
            <main className="flex-1 p-4 md:p-8 overflow-x-hidden">
                {/* Mobile Header */}
                <header className="md:hidden flex items-center justify-between mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black shadow-md">
                            M
                        </div>
                        <div>
                            <h1 className="font-black text-slate-900 leading-tight">Painel Admin</h1>
                            <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">Gestão Ativa</p>
                        </div>
                    </div>
                </header>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {children}
                </div>
            </main>

            {/* --- MOBILE BOTTOM NAVIGATION --- */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-between items-center z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                {mobileQuickLinks.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleTabClick(item.id)}
                        className={`flex flex-col items-center gap-1 p-2 ${activeTab === item.id ? 'text-slate-900' : 'text-slate-400'
                            }`}
                    >
                        <div className={`p-2 rounded-xl transition-all ${activeTab === item.id ? 'bg-slate-100' : ''
                            }`}>
                            <item.icon className="w-6 h-6" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                    </button>
                ))}

                <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="flex flex-col items-center gap-1 p-2 text-slate-400"
                >
                    <div className="p-2 rounded-xl">
                        <Menu className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider">Mais</span>
                </button>
            </nav>

            {/* --- MOBILE FULL MENU OVERLAY --- */}
            {mobileMenuOpen && (
                <div className="md:hidden fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom-full duration-300">
                    <div className="flex items-center justify-between p-6 border-b border-slate-100">
                        <h2 className="text-xl font-black text-slate-900">Menu Completo</h2>
                        <button
                            onClick={() => setMobileMenuOpen(false)}
                            className="p-2 bg-slate-100 text-slate-600 rounded-full"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-8 pb-32">
                        {navGroups.map((group, idx) => (
                            <div key={idx} className="space-y-3">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{group.title}</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {group.items.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleTabClick(item.id)}
                                            className={`flex flex-col items-center justify-center p-4 rounded-2xl border ${activeTab === item.id
                                                ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                                                : 'border-slate-200 bg-white text-slate-700 active:bg-slate-50'
                                                }`}
                                        >
                                            <item.icon className={`w-8 h-8 mb-2 ${activeTab === item.id ? 'text-emerald-400' : 'text-slate-400'}`} />
                                            <span className="text-xs font-bold">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
