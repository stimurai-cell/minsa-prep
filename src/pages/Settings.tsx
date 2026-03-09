import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { ChevronRight, LogOut, ExternalLink, Settings as SettingsIcon } from 'lucide-react';

export default function Settings() {
    const { signOut } = useAuthStore();
    const navigate = useNavigate();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="mx-auto max-w-2xl bg-slate-50 min-h-screen">
            <div className="flex items-center justify-between px-4 py-4 bg-white border-b-2 border-slate-100 sticky top-0 z-10">
                <h1 className="text-xl font-black text-slate-400 uppercase tracking-widest mx-auto translate-x-3">Configurações</h1>
                <Link to="/profile" className="text-sky-500 font-bold tracking-wide uppercase text-sm pr-2">Pronto</Link>
            </div>

            <div className="p-4 space-y-6 animate-in fade-in duration-300">

                {/* Account Section */}
                <div className="bg-white rounded-2xl border-2 border-slate-200 divide-y-2 divide-slate-100 overflow-hidden">
                    <Link to="/settings/profile" className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors active:bg-slate-100">
                        <span className="font-bold text-slate-700">Perfil</span>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                    </Link>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors active:bg-slate-100 text-left">
                        <span className="font-bold text-slate-700">Notificações</span>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors active:bg-slate-100 text-left">
                        <span className="font-bold text-slate-700">Preferências de Cursos</span>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                    <button className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors active:bg-slate-100 text-left">
                        <span className="font-bold text-slate-700">Configurações de privacidade</span>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Support Section */}
                <div>
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Suporte</h2>
                    <div className="bg-white rounded-2xl border-2 border-slate-200 divide-y-2 divide-slate-100 overflow-hidden">
                        <Link to="/help" className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors active:bg-slate-100 text-left">
                            <span className="font-bold text-slate-700">Central de Ajuda</span>
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                        </Link>
                    </div>
                </div>

                {/* Sign Out */}
                <button
                    onClick={handleSignOut}
                    className="w-full bg-white border-2 border-slate-200 text-sky-500 font-bold uppercase tracking-wider py-4 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition-colors mb-6"
                >
                    Sair
                </button>

                {/* Footer Links */}
                <div className="flex flex-col gap-3 px-2 pb-12">
                    <Link to="/terms" className="text-left text-xs font-bold text-sky-500 uppercase tracking-widest hover:text-sky-600 w-fit">
                        Termos de Uso
                    </Link>
                    <Link to="/privacy" className="text-left text-xs font-bold text-sky-500 uppercase tracking-widest hover:text-sky-600 w-fit">
                        Política de Privacidade
                    </Link>
                </div>

            </div>
        </div>
    );
}
