import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import {
    Bell,
    Trash2,
    CheckCheck,
    ChevronLeft,
    Zap,
    Trophy,
    Megaphone,
    Calendar,
    Search,
    Filter
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

type Notification = {
    id: string;
    title: string;
    body: string;
    type: 'marketing' | 'personal' | 'system';
    link?: string;
    is_read: boolean;
    created_at: string;
};

export default function Notifications() {
    const { profile } = useAuthStore();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');

    useEffect(() => {
        if (profile?.id) {
            fetchNotifications();
        }
    }, [profile?.id, filter]);

    const fetchNotifications = async () => {
        setLoading(true);
        let query = supabase
            .from('user_notifications')
            .select('*')
            .order('created_at', { ascending: false });

        if (filter === 'unread') {
            query = query.eq('is_read', false);
        }

        const { data, error } = await query;

        if (error) console.error(error);
        else setNotifications(data || []);
        setLoading(false);
    };

    const markAsRead = async (id: string) => {
        await supabase.from('user_notifications').update({ is_read: true }).eq('id', id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    };

    const deleteNotification = async (id: string) => {
        const { error } = await supabase.from('user_notifications').delete().eq('id', id);
        if (!error) {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }
    };

    const markAllAsRead = async () => {
        if (!profile?.id) return;
        await supabase
            .from('user_notifications')
            .update({ is_read: true })
            .eq('user_id', profile.id)
            .eq('is_read', false);
        fetchNotifications();
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'marketing': return <Zap className="w-5 h-5 text-orange-500" />;
            case 'personal': return <Trophy className="w-5 h-5 text-emerald-500" />;
            default: return <Megaphone className="w-5 h-5 text-blue-500" />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header Area */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 leading-tight">Notificações</h1>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Seu histórico de alertas</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={markAllAsRead}
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 transition-colors"
                        >
                            <CheckCheck className="w-4 h-4" /> Marcar lidas
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 mt-8">
                {/* Filters */}
                <div className="flex gap-4 mb-8 overflow-x-auto pb-2 no-scrollbar">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm border-2 ${filter === 'all' ? 'bg-blue-600 border-blue-600 text-white shadow-blue-200' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                        Tudo
                    </button>
                    <button
                        onClick={() => setFilter('unread')}
                        className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm border-2 ${filter === 'unread' ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-200' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                        Não Lidas
                    </button>
                </div>

                {/* Content */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="bg-white rounded-[2rem] p-12 text-center border-2 border-slate-100 border-dashed">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-sm font-bold text-slate-400">Carregando...</p>
                        </div>
                    ) : notifications.length === 0 ? (
                        <div className="bg-white rounded-[2rem] p-12 text-center border-2 border-slate-100 border-dashed">
                            <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                <Bell className="w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 mb-2">Nenhuma notificação</h3>
                            <p className="text-slate-400 text-sm font-medium">Você está em dia com todos os alertas!</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            <AnimatePresence mode='popLayout'>
                                {notifications.map((n) => (
                                    <motion.div
                                        layout
                                        key={n.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, x: -50 }}
                                        className={`bg-white rounded-[2rem] border-2 transition-all p-6 group relative ${!n.is_read ? 'border-emerald-100 bg-emerald-50/20' : 'border-white hover:border-slate-100'}`}
                                    >
                                        <div className="flex gap-6">
                                            <div className="shrink-0 p-4 bg-white rounded-2xl shadow-sm border border-slate-100 h-fit">
                                                {getIcon(n.type)}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h4 className={`font-black text-lg leading-tight mb-2 ${!n.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                                                            {n.title}
                                                        </h4>
                                                        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-300 mb-4">
                                                            <span className="flex items-center gap-1">
                                                                <Calendar className="w-3 h-3" />
                                                                {new Date(n.created_at).toLocaleDateString()}
                                                            </span>
                                                            <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                                            <span>
                                                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {!n.is_read && (
                                                            <button
                                                                onClick={() => markAsRead(n.id)}
                                                                className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors"
                                                                title="Marcar como lida"
                                                            >
                                                                <CheckCheck className="w-5 h-5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => deleteNotification(n.id)}
                                                            className="p-2 hover:bg-rose-100 text-rose-500 rounded-xl transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-2xl">
                                                    {n.body}
                                                </p>

                                                {n.link && (
                                                    <button
                                                        onClick={() => navigate(n.link!)}
                                                        className="mt-6 px-6 py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                                                    >
                                                        Ver Detalhes
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
