import { useAuthStore } from '../../store/useAuthStore';
import { Shield, Clock, LogOut } from 'lucide-react';

export default function AdminProfile() {
    const { profile, signOut } = useAuthStore();

    return (
        <div className="animate-in fade-in duration-500 space-y-6">
            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/40 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    <div className={`relative w-40 h-40 shrink-0 rounded-[3rem] shadow-2xl flex items-center justify-center text-7xl font-black border-4 border-white overflow-hidden ${!profile?.avatar_url ? (profile?.avatar_style || 'bg-emerald-100 text-emerald-700') : 'bg-white'}`}>
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            profile?.full_name?.charAt(0) || 'A'
                        )}
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-purple-700 mb-4 shadow-sm border border-purple-200">
                            <Shield className="w-3.5 h-3.5" />
                            Administrador Master
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tight">{profile?.full_name}</h2>
                        <p className="mt-2 text-slate-500 font-medium">Logado como <span className="text-slate-900 font-bold uppercase tracking-wider">{profile?.role}</span></p>

                        <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-4 text-xs font-bold uppercase tracking-widest">
                            <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                                <Clock className="w-4 h-4 text-slate-400" />
                                Desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-PT') : '---'}
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0">
                        <button
                            onClick={async () => {
                                if (window.confirm('Tem certeza que deseja sair do painel administrativo?')) {
                                    await signOut();
                                    window.location.href = '/login';
                                }
                            }}
                            className="group flex flex-col items-center justify-center gap-2 w-32 h-32 rounded-[2rem] bg-rose-50 border-2 border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-lg shadow-rose-200/50 hover:shadow-rose-500/30"
                        >
                            <LogOut className="w-8 h-8 group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Sair Agora</span>
                        </button>
                    </div>
                </div>

                {/* Background accent */}
                <div className="absolute right-[-5%] top-[-10%] w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-slate-100 rounded-xl text-slate-500">
                            <Shield className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Segurança</p>
                    </div>
                    <p className="text-sm font-medium text-slate-600 mb-6 leading-relaxed">A sua conta possui acesso total a todos os dados sensíveis, incluindo pagamentos e logs de usuários.</p>
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 transition-all hover:bg-amber-100">
                        <p className="text-xs font-bold text-amber-800 flex items-center gap-2 uppercase tracking-wide">
                            <Shield className="w-4 h-4" />
                            Proteção Ativa
                        </p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-slate-100 rounded-xl text-slate-500">
                            <Clock className="w-5 h-5" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sessão Atual</p>
                    </div>
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mb-1">ID da Conta</p>
                            <p className="text-sm font-bold text-slate-900 font-mono truncate">{profile?.id}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                            <p className="text-[10px] text-emerald-600 uppercase tracking-widest font-black">App Instalada (PWA)</p>
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-[2rem] text-slate-900 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="relative z-10 flex flex-col h-full">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4">Ajuda Admin</p>
                        <p className="text-sm font-medium text-slate-600 mb-6 leading-relaxed flex-1">Precisa de assistência técnica ou encontrou um bug crítico no painel de administração?</p>
                        <button className="w-full py-4 bg-white hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 border border-slate-200 text-slate-700">
                            Contactar Suporte Dev
                        </button>
                    </div>
                    <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <Shield className="w-40 h-40 text-slate-900" />
                    </div>
                </div>
            </div>
        </div>
    );
}
