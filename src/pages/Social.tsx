import { useState, useEffect, useMemo } from 'react';
import { UserPlus, Search, Flame, ShieldAlert, Award, UserCheck, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export default function Social() {
    const { profile } = useAuthStore();
    const { areas, fetchAreas } = useAppStore();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'friends' | 'feed'>('friends');
    const [loading, setLoading] = useState(true);
    const [friends, setFriends] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    const areaNameById = useMemo(() => {
        const map = new Map<string, string>();
        areas.forEach((a: any) => map.set(a.id, a.name));
        return (id?: string | null) => (id ? map.get(id) || 'Área não definida' : 'Área não definida');
    }, [areas]);

    useEffect(() => {
        fetchAreas();
        if (!profile?.id) return;

        const loadSuggestions = async (follows: any[]) => {
            setLoadingSuggestions(true);
            try {
                const already = new Set<string>([(profile?.id as string)]);
                (follows || []).forEach(f => already.add(f.following_id));

                // 1) Amigos de amigos (prioridade)
                let fofProfiles: any[] = [];
                if (follows.length > 0) {
                    const followIds = follows.map(f => f.following_id);
                    const { data: fofRows, error: fofError } = await supabase
                        .from('user_follows')
                        .select('following_id')
                        .in('follower_id', followIds)
                        .limit(60);
                    if (fofError) throw fofError;
                    const fofIds = Array.from(new Set((fofRows || []).map(r => r.following_id))).filter(id => !already.has(id));
                    if (fofIds.length > 0) {
                        const { data: fofData, error: fofProfilesError } = await supabase
                            .from('profiles')
                            .select('id, full_name, total_xp, selected_area_id, avatar_url')
                            .in('id', fofIds)
                            .limit(12);
                        if (fofProfilesError) throw fofProfilesError;
                        fofProfiles = fofData || [];
                    }
                }

                // 2) Fallback: pessoas populares/aleatórias fora da lista "already"
                let popular: any[] = [];
                if (fofProfiles.length < 4) {
                    let popularQuery = supabase
                        .from('profiles')
                        .select('id, full_name, total_xp, selected_area_id, avatar_url')
                        .order('total_xp', { ascending: false })
                        .limit(20);

                    if (already.size > 0) {
                        const inList = `(${Array.from(already).map(id => `'${id}'`).join(',')})`;
                        popularQuery = popularQuery.not('id', 'in', inList);
                    }

                    const { data: popularData, error: popularError } = await popularQuery;
                    if (popularError) throw popularError;
                    popular = popularData || [];
                }

                let merged = [...fofProfiles, ...popular].filter((u, idx, arr) =>
                    arr.findIndex(v => v.id === u.id) === idx
                );

                // 3) Garantir que nunca volte lista vazia: se ainda não há sugestões,
                // pega os perfis mais recentes (sem filtrar) para mostrar algo.
                if (merged.length < 4) {
                    const { data: fallbackData } = await supabase
                        .from('profiles')
                        .select('id, full_name, total_xp, selected_area_id, avatar_url')
                        .order('created_at', { ascending: false })
                        .limit(6);
                    merged = [...merged, ...(fallbackData || [])].filter((u, idx, arr) =>
                        arr.findIndex(v => v.id === u.id) === idx
                    );
                }

                setSuggestions(merged);
            } catch (err) {
                console.error('Error loading suggestions:', err);
                setSuggestions([]);
            } finally {
                setLoadingSuggestions(false);
            }
        };

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Follows (Friends)
                const { data: follows, error: followError } = await supabase
                    .from('user_follows')
                    .select('following_id, profiles!user_follows_following_id_fkey(id, full_name, total_xp, avatar_style, avatar_url, selected_area_id, current_league, streak_freeze_active)')
                    .eq('follower_id', profile.id);

                if (followError) throw followError;
                setFriends(follows?.map(f => f.profiles) || []);

                // 1.1 Sugestões (amigos de amigos, depois populares)
                await loadSuggestions(follows || []);

                // 2. Feed (apenas amigos + eu) usando feed_items para conquistas/ofensiva/notÃ­cias
                const friendIds = (follows || []).map(f => f.following_id);
                const audience = friendIds.length > 0 ? [...friendIds, profile.id] : [profile.id];

                const { data: feedItems, error: feedError } = await supabase
                    .from('feed_items')
                    .select('*, profiles(full_name, avatar_url, selected_area_id)')
                    .in('user_id', audience)
                    .order('created_at', { ascending: false })
                    .limit(30);

                if (feedError) throw feedError;
                setActivities(feedItems || []);
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
                    .select('id, full_name, total_xp, selected_area_id, avatar_url')
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
                                {searchResults.map(user => {
                                    const isFollowing = friends.some(f => f.id === user.id);
                                    return (
                                        <div key={user.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/profile/${user.id}`)}>
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 overflow-hidden">
                                                    {user.avatar_url ? (
                                                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        user.full_name?.charAt(0)
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">{user.full_name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {areaNameById(user.selected_area_id)} • {user.total_xp} XP
                                                    </p>
                                                </div>
                                            </div>
                                            {isFollowing ? (
                                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest">
                                                    <UserCheck className="w-4 h-4" />
                                                    Seguindo
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleFollow(user.id)}
                                                    className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-2"
                                                >
                                                    <UserPlus className="w-4 h-4" />
                                                    Seguir
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Sugestoes de amigos ao estilo Duolingo */}
                    <div className="bg-white border-2 border-slate-100 rounded-[2rem] p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sugestoes</p>
                                <h3 className="text-lg font-black text-slate-900">Pessoas que podes conhecer</h3>
                            </div>
                            <span className="text-xs font-bold text-slate-400">{loadingSuggestions ? '...' : `${suggestions.length} encontrados`}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {(loadingSuggestions ? Array.from({ length: 6 }) : suggestions.slice(0, 6)).map((user: any, idx: number) => (
                                <div
                                    key={user?.id || idx}
                                    className="bg-slate-50 border border-slate-100 rounded-[1.4rem] p-4 flex flex-col items-center text-center gap-2 shadow-[0_6px_18px_-14px_rgba(15,23,42,0.2)]"
                                >
                                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center font-black text-slate-500 overflow-hidden">
                                        {loadingSuggestions ? (
                                            <div className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-transparent animate-spin" />
                                        ) : user?.avatar_url ? (
                                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            user?.full_name?.charAt(0)
                                        )}
                                    </div>
                                    <p className="text-sm font-black text-slate-900 truncate w-full">{loadingSuggestions ? '...' : user?.full_name}</p>
                                    {!loadingSuggestions && (
                                        <>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                                {areaNameById(user?.selected_area_id)} ??? {user?.total_xp || 0} XP
                                            </p>
                                            <button
                                                onClick={() => handleFollow(user.id)}
                                                className="w-full mt-1 bg-blue-600 text-white px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-blue-700 transition-colors"
                                            >
                                                Seguir
                                            </button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
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
                                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl font-black text-slate-400 border-2 border-slate-50 group-hover:bg-blue-600 group-hover:text-white transition-colors overflow-hidden">
                                                {friend.avatar_url ? (
                                                    <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    friend.full_name?.charAt(0)
                                                )}
                                            </div>
                                            {friend.streak_freeze_active && (
                                                <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-1 rounded-full border-2 border-white">
                                                    <ShieldAlert className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-slate-900 truncate text-lg group-hover:text-blue-600 transition-colors">{friend.full_name}</p>
                                            <div className="flex items-center gap-2 mt-1 text-xs font-bold text-slate-500 uppercase tracking-widest">
                                                <span>{areaNameById(friend.selected_area_id)}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <Flame className="w-4 h-4 text-orange-500 fill-current" />
                                                <span>{friend.total_xp} XP</span>
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
                                    <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 cursor-pointer" onClick={() => navigate(`/profile/${act.user_id}`)}>
                                        {act.profiles?.full_name?.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-2">
                                            <span>{areaNameById(act.profiles?.selected_area_id)}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                            <span>{new Date(act.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <p className="text-slate-900 font-black leading-tight">
                                            {act.content?.title || 'Nova atividade no feed'}
                                        </p>
                                        {act.content?.body && (
                                            <p className="text-slate-600 text-sm font-medium mt-1 leading-relaxed">
                                                {act.content.body}
                                            </p>
                                        )}
                                        {act.content?.streak_days && (
                                            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-100 text-orange-700 px-3 py-1 text-[11px] font-black uppercase tracking-widest">
                                                <Flame className="w-4 h-4" />
                                                {act.content.streak_days} dias de ofensiva
                                            </div>
                                        )}
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
