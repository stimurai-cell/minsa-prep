import { useState, useEffect } from 'react';
import { UserPlus, Search, Flame, ShieldAlert, Award, UserCheck, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

export default function Social() {
    const { profile } = useAuthStore();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'friends' | 'feed'>('friends');
    const [loading, setLoading] = useState(true);
    const [friends, setFriends] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (!profile?.id) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Follows (Friends)
                const { data: follows, error: followError } = await supabase
                    .from('user_follows')
                    .select('following_id, profiles!user_follows_following_id_fkey(id, full_name, total_xp, avatar_style, current_league, streak_freeze_active)')
                    .eq('follower_id', profile.id);

                if (followError) throw followError;
                setFriends(follows?.map(f => f.profiles) || []);

                // 2. Fetch Activities for Feed
                const { data: acts, error: actError } = await supabase
                    .from('user_activities')
                    .select('*, profiles(full_name, avatar_style)')
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (actError) throw actError;
                setActivities(acts || []);
            } catch (err) {
                console.error('Error fetching social data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [profile?.id]);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, total_xp, selected_area_id')
                .ilike('full_name', `%${query}%`)
                .neq('id', profile?.id)
                .limit(5);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleFollow = async (targetId: string) => {
        if (!profile?.id) return;
        try {
            const { error } = await supabase
                .from('user_follows')
                .insert({ follower_id: profile.id, following_id: targetId });

            if (error) throw error;
            // Refresh friends list
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert('Erro ao seguir utilizador.');
        }
    };

    return (
        <div className="mx-auto max-w-2xl pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md pt-4 pb-4 border-b-2 border-slate-100 flex gap-4 -mx-4 px-4 mb-6">
                <button
                    onClick={() => setActiveTab('friends')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-2xl transition-colors ${activeTab === 'friends'
                        ? 'bg-blue-100 text-blue-600 border-2 border-blue-200 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-50'
                        }`}
                >
                    Amigos
                </button>
                <button
                    onClick={() => setActiveTab('feed')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-2xl transition-colors ${activeTab === 'feed'
                        ? 'bg-blue-100 text-blue-600 border-2 border-blue-200 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-50'
                        }`}
                >
                    Novidades
                </button>
            </div>

            {activeTab === 'friends' && (
                <div className="space-y-8">
                    {/* Add Friend Button / Invite System */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-[2rem] p-6 shadow-sm mb-6">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                <Search className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-800">Procurar Amigos</h2>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest">Encontre seus colegas</p>
                            </div>
                        </div>

                        <div className="relative group">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
                                placeholder="Digite o nome do estudante..."
                                className="w-full bg-white border-2 border-slate-200 rounded-2xl px-5 py-4 pl-12 pr-16 focus:border-blue-400 outline-none transition-all font-medium text-slate-800"
                            />
                            <div
                                className="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer"
                                onClick={() => handleSearch(searchQuery)}
                            >
                                <Search className="w-5 h-5 text-slate-400" />
                            </div>

                            <button
                                onClick={() => handleSearch(searchQuery)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-50 text-blue-600 p-2 rounded-xl hover:bg-blue-100 transition-colors"
                                title="Pesquisar"
                            >
                                <Search className="w-5 h-5" />
                            </button>

                            {isSearching && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>

                        {/* Search Results Dropdown */}
                        {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
                            <div className="mt-2 bg-white border-2 border-slate-100 rounded-2xl p-4 text-center text-sm text-slate-500 font-medium">
                                Nenhum estudante encontrado com este nome.
                            </div>
                        )}

                        {searchResults.length > 0 && (
                            <div className="mt-2 bg-white border-2 border-slate-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                                {searchResults.map(user => (
                                    <div key={user.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${user.id}`)}>
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">
                                                {user.full_name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-900">{user.full_name}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.total_xp} XP</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleFollow(user.id)}
                                            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                                        >
                                            Seguir
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-50 border-2 border-slate-100 rounded-[2rem] p-6 shadow-sm mb-6">
                        <h2 className="text-lg font-black text-slate-800 mb-2">Traga mais gente!</h2>
                        <p className="text-sm text-slate-500 mb-4">A melhor forma de crescer é estudando acompanhado.</p>
                        <button
                            onClick={() => {
                                const message = encodeURIComponent("Vem treinar comigo no MINSA Prep! A melhor plataforma para nos prepararmos para o Concurso Público da Saúde. 🚀\nCria a tua conta em: " + window.location.origin);
                                window.open(`https://wa.me/?text=${message}`, '_blank');
                            }}
                            className="w-full flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-2xl font-bold shadow-[0_4px_0_0_#128c7e] active:shadow-none active:translate-y-1 transition-all"
                        >
                            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            Convidar via WhatsApp
                        </button>
                    </div>

                    {/* Friends Grid */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm font-bold text-slate-400 tracking-widest uppercase">A carregar amigos...</p>
                        </div>
                    ) : friends.length === 0 ? (
                        <div className="text-center py-20 bg-white border-2 border-dashed border-slate-200 rounded-[2.5rem] px-8">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                                <UserPlus className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Sem conexões ainda</h3>
                            <p className="text-slate-500 font-medium max-w-sm mx-auto">
                                Procure por colegas no campo de busca acima ou convide seus amigos pelo WhatsApp.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {friends.map(friend => (
                                <div
                                    key={friend.id}
                                    onClick={() => navigate(`/profile/${friend.id}`)}
                                    className="bg-white border-2 border-slate-100 rounded-[2rem] p-5 hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-black text-slate-400 border-2 border-slate-50 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                {friend.full_name?.charAt(0)}
                                            </div>
                                            {friend.streak_freeze_active && (
                                                <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-full border-2 border-white">
                                                    <ShieldAlert className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-slate-900 truncate text-lg group-hover:text-blue-600 transition-colors">{friend.full_name}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <Flame className="w-4 h-4 text-orange-500 fill-current" />
                                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{friend.total_xp} XP</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${friend.current_league === 'Ouro' ? 'bg-yellow-100 text-yellow-700' :
                                            friend.current_league === 'Prata' ? 'bg-slate-100 text-slate-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                            Liga {friend.current_league || 'Bronze'}
                                        </span>
                                        <button className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <UserCheck className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ) as any)}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'feed' && (
                <div className="space-y-6">
                    {activities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                <Award className="w-12 h-12 text-slate-300" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-700 mb-2">Feed Silencioso</h2>
                            <p className="text-slate-500 font-medium">As conquistas dos seus amigos aparecerão aqui!</p>
                        </div>
                    ) : (
                        activities.map(act => (
                            <div key={act.id} className="bg-white border-2 border-slate-100 rounded-[2rem] p-6 shadow-sm hover:border-indigo-100 transition-all">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-600">
                                        {act.profiles?.full_name?.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-slate-900 font-medium">
                                            <span className="font-black hover:text-indigo-600 cursor-pointer" onClick={() => navigate(`/profile/${act.user_id}`)}>
                                                {act.profiles?.full_name}
                                            </span>
                                            {" "}{act.activity_type === 'high_score' ? 'alcançou uma nova pontuação recorde!' :
                                                act.activity_type === 'achievement' ? 'ganhou uma nova medalha!' : 'acabou de começar um novo treino!'}
                                        </p>
                                        <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">
                                            {new Date(act.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

        </div>
    );
}
