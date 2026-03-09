import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Flame,
    Award,
    ShieldCheck,
    ArrowLeft,
    UserPlus,
    UserMinus,
    Target,
    BarChart3,
    BookOpen
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { motion } from 'framer-motion';

export default function UserProfileView() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { profile: currentUser } = useAuthStore();
    const [userProfile, setUserProfile] = useState<any>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);

    useEffect(() => {
        if (!userId) return;

        const fetchUserData = async () => {
            setLoading(true);
            try {
                // Fetch Profile
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*, areas!profiles_selected_area_id_fkey(name)')
                    .eq('id', userId)
                    .single();

                if (error) throw error;
                setUserProfile(data);

                // Check Follow Status
                if (currentUser?.id) {
                    const { data: follow } = await supabase
                        .from('user_follows')
                        .select('*')
                        .eq('follower_id', currentUser.id)
                        .eq('following_id', userId)
                        .maybeSingle();

                    setIsFollowing(!!follow);
                }
            } catch (err) {
                console.error(err);
                navigate('/social');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [userId, currentUser?.id, navigate]);

    const handleToggleFollow = async () => {
        if (!currentUser?.id || !userId) return;
        setFollowLoading(true);
        try {
            if (isFollowing) {
                await supabase
                    .from('user_follows')
                    .delete()
                    .eq('follower_id', currentUser.id)
                    .eq('following_id', userId);
                setIsFollowing(false);
            } else {
                await supabase
                    .from('user_follows')
                    .insert({ follower_id: currentUser.id, following_id: userId });
                setIsFollowing(true);

                // Log activity
                await supabase.from('user_activities').insert({
                    user_id: currentUser.id,
                    activity_type: 'follow',
                    content: `Começou a seguir ${userProfile.full_name}`
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setFollowLoading(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">A carregar perfil...</p>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto pb-24">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-slate-500 font-bold hover:text-slate-900 transition-colors mb-6 group"
            >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                VOLTAR
            </button>

            {/* Profile Header Card */}
            <div className="bg-white rounded-[3rem] border-2 border-slate-100 p-8 shadow-xl shadow-slate-100/50 mb-8 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-32 -mt-32 -z-0"></div>

                <div className="relative z-10 flex flex-col items-center md:flex-row md:items-start gap-8">
                    <div className="relative">
                        <div className={`w-32 h-32 rounded-[2.5rem] flex items-center justify-center text-5xl font-black border-4 border-white shadow-lg overflow-hidden ${!userProfile.avatar_url ? userProfile.avatar_style : 'bg-white'}`}>
                            {userProfile.avatar_url ? (
                                <img src={userProfile.avatar_url} alt={userProfile.full_name} className="w-full h-full object-cover" />
                            ) : (
                                userProfile.full_name?.charAt(0)
                            )}
                        </div>
                        {userProfile.streak_freeze_active && (
                            <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white p-2 rounded-2xl border-4 border-white shadow-md">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 text-center md:text-left">
                        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-2">
                            <h1 className="text-3xl font-black text-slate-900 leading-tight">
                                {userProfile.full_name}
                            </h1>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase tracking-widest">
                                {userProfile.current_league || 'Bronze'}
                            </span>
                        </div>
                        <p className="text-slate-500 font-medium text-lg mb-6 flex items-center justify-center md:justify-start gap-2">
                            <BookOpen className="w-5 h-5 text-emerald-500" />
                            {userProfile.areas?.name || 'Estudante da Saúde'}
                        </p>

                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                            <button
                                onClick={handleToggleFollow}
                                disabled={followLoading}
                                className={`flex items-center gap-2 px-8 py-4 rounded-2xl font-bold transition-all shadow-md active:translate-y-1 active:shadow-none ${isFollowing
                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
                                    }`}
                            >
                                {isFollowing ? <UserMinus className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                                {isFollowing ? 'A SEGUIR' : 'SEGUIR ESTUDANTE'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-orange-50 border-2 border-orange-100 p-6 rounded-[2rem] text-center shadow-sm">
                    <p className="text-xs font-black text-orange-600 uppercase tracking-widest mb-2">Ofensiva</p>
                    <div className="flex items-center justify-center gap-2 text-3xl font-black text-orange-600 leading-none">
                        <Flame className="w-7 h-7 fill-current" />
                        <span>7</span>
                    </div>
                    <p className="text-[10px] font-bold text-orange-400 mt-2">DIAS SEGUIDOS</p>
                </div>

                <div className="bg-indigo-50 border-2 border-indigo-100 p-6 rounded-[2rem] text-center shadow-sm">
                    <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-2">Experiência</p>
                    <div className="flex items-center justify-center gap-2 text-3xl font-black text-indigo-600 leading-none">
                        <Award className="w-7 h-7" />
                        <span>{userProfile.total_xp}</span>
                    </div>
                    <p className="text-[10px] font-bold text-indigo-400 mt-2">XP TOTAL</p>
                </div>

                <div className="col-span-2 md:col-span-1 bg-emerald-50 border-2 border-emerald-100 p-6 rounded-[2rem] text-center shadow-sm">
                    <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-2">Objetivo</p>
                    <div className="flex items-center justify-center gap-2 text-2xl font-black text-emerald-600 leading-none">
                        <Target className="w-6 h-6" />
                        <span className="truncate">{userProfile.goal || 'Estudar'}</span>
                    </div>
                    <p className="text-[10px] font-bold text-emerald-400 mt-2 whitespace-nowrap">META DO ESTUDANTE</p>
                </div>
            </div>

            {/* Evolution Card */}
            <div className="bg-white rounded-[2.5rem] border-2 border-slate-100 p-8">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                        <BarChart3 className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800">Evolução Recente</h3>
                </div>

                <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
                    <p className="font-bold">Gráfico de desempenho público</p>
                    <p className="text-xs mt-1">Este estudante optou por compartilhar sua evolução.</p>
                </div>
            </div>
        </div>
    );
}
