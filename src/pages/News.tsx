import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import {
    Heart,
    MessageCircle,
    Share2,
    Trophy,
    Zap,
    Megaphone,
    Loader2,
    Clock,
    Sparkles
} from 'lucide-react';

type FeedItem = {
    id: string;
    user_id: string | null;
    type: 'achievement' | 'news' | 'battle' | 'streak';
    content: {
        title: string;
        body: string;
        icon?: string;
        streak_days?: number;
        medal_name?: string;
        score?: number;
    };
    image_url?: string;
    created_at: string;
    profiles: {
        full_name: string;
        avatar_url: string;
        role: string;
    } | null;
    reactions: { emoji: string; count: number; reacted: boolean }[];
    comments_count: number;
};

export default function News() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'news' | 'achievements'>('all');

    useEffect(() => {
        fetchFeed();
    }, [activeTab]);

    const fetchFeed = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('feed_items')
                .select(`
          *,
          profiles(full_name, avatar_url, role)
        `)
                .order('created_at', { ascending: false });

            if (activeTab === 'news') query = query.eq('type', 'news');
            if (activeTab === 'achievements') query = query.in('type', ['achievement', 'streak']);

            const { data, error } = await query;

            if (error) throw error;

            // Transform and Fetch reactions/comments counts
            // In a real high-scale app, we'd use a view or specialized RPC
            const enrichedFeed = await Promise.all((data || []).map(async (item: any) => {
                // Reactions check
                const { data: reactions } = await supabase
                    .from('feed_reactions')
                    .select('emoji, user_id')
                    .eq('feed_item_id', item.id);

                const emojiCounts = (reactions || []).reduce((acc: any, curr) => {
                    acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
                    return acc;
                }, {});

                const userEmojis = (reactions || [])
                    .filter(r => r.user_id === profile?.id)
                    .map(r => r.emoji);

                const formattedReactions = Object.entries(emojiCounts).map(([emoji, count]) => ({
                    emoji,
                    count: count as number,
                    reacted: userEmojis.includes(emoji)
                }));

                // Comments count
                const { count: commCount } = await supabase
                    .from('feed_comments')
                    .select('*', { count: 'exact', head: true })
                    .eq('feed_item_id', item.id);

                return {
                    ...item,
                    reactions: formattedReactions.length > 0 ? formattedReactions : [{ emoji: '❤️', count: 0, reacted: false }],
                    comments_count: commCount || 0
                };
            }));

            setFeed(enrichedFeed);
        } catch (err) {
            console.error('Error fetching feed:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReaction = async (itemId: string, emoji: string) => {
        if (!profile) return;

        try {
            const existing = feed.find(i => i.id === itemId)?.reactions.find(r => r.emoji === emoji && r.reacted);

            if (existing) {
                // Remove
                await supabase
                    .from('feed_reactions')
                    .delete()
                    .match({ feed_item_id: itemId, user_id: profile.id, emoji });
            } else {
                // Add
                await supabase
                    .from('feed_reactions')
                    .insert({ feed_item_id: itemId, user_id: profile.id, emoji });
            }

            fetchFeed(); // Refresh
        } catch (err) {
            console.error(err);
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'achievement': return <Trophy className="w-5 h-5 text-amber-500" />;
            case 'streak': return <Zap className="w-5 h-5 text-orange-500" />;
            case 'news': return <Megaphone className="w-5 h-5 text-blue-500" />;
            default: return <Sparkles className="w-5 h-5 text-emerald-500" />;
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-slate-100">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Novidades</h1>
                <p className="text-slate-500 font-medium">Veja o que está a acontecer na comunidade.</p>

                {/* Tabs */}
                <div className="flex gap-2 mt-6">
                    {(['all', 'news', 'achievements'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-2 rounded-full text-sm font-black transition-all uppercase tracking-wider ${activeTab === tab
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                }`}
                        >
                            {tab === 'all' ? 'Tudo' : tab === 'news' ? 'Avisos' : 'Conquistas'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm">Carregando o feed...</p>
                </div>
            ) : feed.length === 0 ? (
                <div className="bg-white rounded-[2.5rem] p-12 text-center border-2 border-dashed border-slate-100">
                    <Clock className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold uppercase tracking-widest">Ainda não há novidades por aqui.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {feed.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500"
                        >
                            {/* Post Header */}
                            <div className="p-6 pb-3 flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="relative cursor-pointer" onClick={() => item.user_id && navigate(`/profile/${item.user_id}`)}>
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 border-2 border-white shadow-sm overflow-hidden">
                                            {item.profiles?.avatar_url ? (
                                                <img src={item.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                item.profiles?.full_name?.substring(0, 1) || 'A'
                                            )}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-lg border border-slate-50 shadow-sm">
                                            {getTypeIcon(item.type)}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 leading-tight cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => item.user_id && navigate(`/profile/${item.user_id}`)}>
                                            {item.profiles?.full_name || 'Equipe MINSA Prep'}
                                        </h3>
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                            <span>•</span>
                                            <span className={item.type === 'news' ? 'text-blue-500' : 'text-emerald-500'}>
                                                {item.type}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="px-6 py-2">
                                <h4 className="text-lg font-black text-slate-800 leading-tight">
                                    {item.content.title}
                                </h4>
                                <p className="mt-2 text-slate-600 font-medium leading-relaxed">
                                    {item.content.body}
                                </p>

                                {item.image_url && (
                                    <div className="mt-4 rounded-3xl overflow-hidden border border-slate-50">
                                        <img src={item.image_url} alt="" className="w-full h-auto object-cover max-h-96" />
                                    </div>
                                )}

                                {item.type === 'streak' && (
                                    <div className="mt-4 p-6 bg-orange-50 rounded-[2rem] border border-orange-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-orange-900 font-black text-xl">🔥 {item.content.streak_days} Dias!</p>
                                            <p className="text-orange-700 text-xs font-bold uppercase tracking-widest mt-1">Ofensiva Imparável</p>
                                        </div>
                                        <Zap className="w-10 h-10 text-orange-400 fill-orange-400 animate-pulse" />
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="p-4 border-t border-slate-50 flex items-center gap-6">
                                <div className="flex items-center gap-1">
                                    {item.reactions.map(r => (
                                        <button
                                            key={r.emoji}
                                            onClick={() => handleReaction(item.id, r.emoji)}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all ${r.reacted
                                                ? 'bg-red-50 text-red-600 border border-red-100'
                                                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border border-transparent'
                                                }`}
                                        >
                                            <span className="text-lg">{r.emoji}</span>
                                            <span className="text-sm font-black">{r.count}</span>
                                        </button>
                                    ))}
                                    <button className="p-2 text-slate-300 hover:text-slate-400">
                                        <Share2 className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 ml-auto">
                                    <div className="bg-slate-100 text-slate-500 px-3 py-1 rounded-xl flex items-center gap-2">
                                        <MessageCircle className="w-4 h-4" />
                                        <span className="text-xs font-black">{item.comments_count}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
