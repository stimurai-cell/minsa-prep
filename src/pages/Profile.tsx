import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { Settings, Share, Flame, Zap, ShieldCheck, Crown, Award, Bell, RefreshCw, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';
import { subscribeToPush, sendPushNotification } from '../lib/pushNotifications';

const AVATAR_COLORS = [
    'bg-emerald-100 text-emerald-600',
    'bg-blue-100 text-blue-600',
    'bg-purple-100 text-purple-600',
    'bg-orange-100 text-orange-600',
    'bg-pink-100 text-pink-600',
    'bg-yellow-100 text-yellow-700',
];

export default function Profile() {
    const { profile } = useAuthStore();
    const { areas } = useAppStore();
    const [userBadges, setUserBadges] = useState<any[]>([]);
    const [followingCount, setFollowingCount] = useState(0);
    const [followersCount, setFollowersCount] = useState(0);
    const [pushStatus, setPushStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

    useEffect(() => {
        const fetchBadges = async () => {
            if (!profile?.id) return;
            const { data } = await supabase
                .from('user_badges')
                .select('*, badges(*)')
                .eq('user_id', profile.id);
            setUserBadges(data || []);
        };

        const fetchSocialCounts = async () => {
            if (!profile?.id) return;

            // Count Following
            const { count: following } = await supabase
                .from('user_follows')
                .select('*', { count: 'exact', head: true })
                .eq('follower_id', profile.id);
            setFollowingCount(following || 0);

            // Count Followers
            const { count: followers } = await supabase
                .from('user_follows')
                .select('*', { count: 'exact', head: true })
                .eq('following_id', profile.id);
            setFollowersCount(followers || 0);
        };

        fetchBadges();
        fetchSocialCounts();
    }, [profile?.id]);

    const areaName = areas.find((area) => area.id === profile?.selected_area_id)?.name || 'Área não definida';

    // We get the selected color from profile or provide a fallback color.
    // Ensure we can extract background color reliably
    const selectedColorClass = profile?.avatar_style || AVATAR_COLORS[1];
    const roleLabels: Record<string, string> = {
        'free': 'Free',
        'basic': 'Basic',
        'premium': 'Premium',
        'elite': 'Elite',
        'admin': 'MAX'
    };
    const userRoleLabel = roleLabels[profile?.role || 'free'] || 'Free';

    // Just mapping the selected bg for the header
    const headerBgMap: Record<string, string> = {
        'bg-emerald-100 text-emerald-600': 'bg-[#6EE7B7]', // emerald-300
        'bg-blue-100 text-blue-600': 'bg-[#7DD3FC]', // sky-300
        'bg-purple-100 text-purple-600': 'bg-[#D8B4FE]', // purple-300
        'bg-orange-100 text-orange-600': 'bg-[#FDBA74]', // orange-300
        'bg-pink-100 text-pink-600': 'bg-[#F9A8D4]', // pink-300
        'bg-yellow-100 text-yellow-700': 'bg-[#FDE047]', // yellow-300
    };
    const headerBgColor = headerBgMap[selectedColorClass] || 'bg-sky-300';

    const createdAtDate = profile?.created_at ? new Date(profile.created_at).getFullYear() : '2024';

    return (
        <div className="mx-auto max-w-2xl bg-slate-50 min-h-screen">

            {/* Top Color Section */}
            <div className={`relative pt-6 pb-20 px-6 ${headerBgColor} border-b-2 border-slate-200`}>
                <div className="flex justify-between items-start">
                    <h1 className="text-3xl tracking-tight font-black text-slate-900 mt-2 z-10">{profile?.full_name?.split(' ')[0] || 'Aluno'}</h1>
                    <div className="flex gap-4 items-center z-10">
                        <button className="p-2 text-slate-800 hover:bg-black/10 rounded-full transition-colors">
                            <Share className="w-6 h-6" />
                        </button>
                        <Link to="/settings" className="p-2 text-slate-800 hover:bg-black/10 rounded-full transition-colors">
                            <Settings className="w-6 h-6" />
                        </Link>
                    </div>
                </div>

                {profile?.role === 'admin' && (
                    <div className="absolute right-6 top-20 bg-black text-white px-3 py-1 font-black text-sm rounded-lg uppercase tracking-widest z-10 border-2 border-transparent shadow-[0_4px_0_0_rgba(0,0,0,1)]">
                        MAX
                    </div>
                )}
                {profile?.role === 'elite' && (
                    <div className="absolute right-6 top-20 bg-purple-600 text-white px-3 py-1 font-black text-sm rounded-lg uppercase tracking-widest z-10 shadow-[0_4px_0_0_#4c1d95]">
                        ELITE
                    </div>
                )}
                {profile?.role === 'premium' && (
                    <div className="absolute right-6 top-20 bg-yellow-400 text-yellow-900 px-3 py-1 font-black text-sm rounded-lg uppercase tracking-widest z-10 shadow-[0_4px_0_0_#ca8a04]">
                        PREMIUM
                    </div>
                )}
                {profile?.role === 'basic' && (
                    <div className="absolute right-6 top-20 bg-emerald-500 text-white px-3 py-1 font-black text-sm rounded-lg uppercase tracking-widest z-10 shadow-[0_4px_0_0_#065f46]">
                        BASIC
                    </div>
                )}

                {/* Avatar */}
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2">
                    <div className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center text-6xl font-black border-4 border-slate-50 shadow-md overflow-hidden ${!profile?.avatar_url ? selectedColorClass : 'bg-white'}`}>
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            profile?.full_name?.charAt(0).toUpperCase() || 'U'
                        )}
                    </div>
                </div>
            </div>

            <div className="px-6 pt-24 pb-8 space-y-6">

                {/* Username & Joined */}
                <div className="text-center">
                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2">
                        {profile?.full_name?.replace(/\s+/g, '_').toUpperCase() || '@ALUNO'}
                        <span>•</span>
                        AQUI DESDE {createdAtDate}
                    </p>
                </div>

                {/* Followers Mock Stats */}
                <div className="flex justify-center gap-8 py-2">
                    <div className="flex gap-2 items-center text-center">
                        <div>
                            <p className="text-xl font-black text-slate-800">1</p>
                            <p className="text-xs font-bold text-slate-400">Cursos</p>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center text-center">
                        <div>
                            <p className="text-xl font-black text-slate-800">{followingCount}</p>
                            <p className="text-xs font-bold text-slate-400">Segue</p>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center text-center">
                        <div>
                            <p className="text-xl font-black text-slate-800">{followersCount}</p>
                            <p className="text-xs font-bold text-slate-400">Seguidores</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center">
                    <Link to="/social" className="w-full bg-white text-slate-700 border-2 border-slate-200 hover:bg-slate-50 active:bg-slate-100 font-bold tracking-widest uppercase py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors">
                        <span className="text-xl leading-none">+</span> ADICIONAR AMIGOS
                    </Link>
                </div>

                <hr className="border-slate-200 my-4" />

                {/* Overview Stats */}
                <div>
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Visão Geral</h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-slate-300 transition-colors">
                            <Flame className="w-8 h-8 text-orange-500" fill="currentColor" />
                            <div>
                                <p className="text-lg font-black text-slate-800">2 <span className="text-sm">dias</span></p>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ofensiva</p>
                            </div>
                        </div>

                        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-slate-300 transition-colors">
                            <Zap className="w-8 h-8 text-yellow-500" fill="currentColor" />
                            <div>
                                <p className="text-lg font-black text-slate-800">{profile?.total_xp || 0}</p>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total XP</p>
                            </div>
                        </div>

                        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-slate-300 transition-colors">
                            <ShieldCheck className="w-8 h-8 text-emerald-500" />
                            <div>
                                <p className="text-lg font-black text-slate-800 line-clamp-1 truncate">{areaName}</p>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Área</p>
                            </div>
                        </div>

                        <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex items-center gap-4 hover:border-slate-300 transition-colors opacity-90">
                            <Crown className="w-8 h-8 text-amber-500" />
                            <div>
                                <p className="text-lg font-black text-slate-800">Bronze</p>
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Liga Atual</p>
                            </div>
                        </div>
                    </div>
                </div>

                <hr className="border-slate-200 my-4" />

                {/* Notification Diagnostic Section */}
                <div className="bg-white border-2 border-slate-200 rounded-[1.8rem] p-6 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                            <Bell className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-900 leading-tight">Sistema de Alertas</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">Diagnóstico de Notificações</p>
                        </div>
                    </div>

                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                        Se não recebes as notificações do Admin ou avisos de novos simulados, usa o botão abaixo para testar e restabelecer a tua ligação.
                    </p>

                    <button
                        onClick={async () => {
                            if (!profile?.id) return;
                            setPushStatus('testing');
                            try {
                                const success = await subscribeToPush(profile.id);
                                if (success) {
                                    await sendPushNotification({
                                        userId: profile.id,
                                        title: 'Teste de Ligação ✅',
                                        body: 'Se estás a ler isto, as tuas notificações estão 100% funcionais!',
                                        url: '/profile'
                                    });
                                    setPushStatus('success');
                                    setTimeout(() => setPushStatus('idle'), 3000);
                                } else {
                                    setPushStatus('error');
                                }
                            } catch (err: any) {
                                console.error('Error testing push:', err);
                                alert(`⚠️ Erro Técnico: ${err.message || 'Falha desconhecida'}`);
                                setPushStatus('error');
                            }
                        }}
                        disabled={pushStatus === 'testing'}
                        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_0_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none ${pushStatus === 'testing' ? 'bg-slate-100 text-slate-400' :
                            pushStatus === 'success' ? 'bg-emerald-500 text-white shadow-[#10b981]' :
                                pushStatus === 'error' ? 'bg-rose-500 text-white shadow-[#f43f5e]' :
                                    'bg-amber-100 text-amber-700 hover:bg-amber-200 shadow-[#d97706]'
                            }`}
                    >
                        {pushStatus === 'testing' ? (
                            <><RefreshCw className="w-4 h-4 animate-spin" /> Verificando...</>
                        ) : pushStatus === 'success' ? (
                            <><CheckCircle2 className="w-4 h-4" /> Notificação Enviada!</>
                        ) : pushStatus === 'error' ? (
                            '❌ Erro ao Ligar. Tenta de novo.'
                        ) : (
                            'Testar e Ligar Notificações Push'
                        )}
                    </button>
                </div>

                <hr className="border-slate-200 my-4" />

                {/* Badges Section */}
                <div>
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Minhas Medalhas</h2>
                    {userBadges.length === 0 ? (
                        <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                            <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm font-medium text-slate-500">Continue estudando para desbloquear medalhas exclusivas!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-4">
                            {userBadges.map((ub, idx) => (
                                <div key={idx} className="flex flex-col items-center text-center p-2">
                                    <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 mb-2 shadow-sm border border-amber-200">
                                        <Award className="w-8 h-8" />
                                    </div>
                                    <p className="text-[10px] font-black uppercase text-slate-700 leading-tight">{ub.badges?.name}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
