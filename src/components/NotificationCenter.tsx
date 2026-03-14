import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Bell, X, Check, ArrowRight, Info, Zap, Trophy, Megaphone, BellOff, CheckCheck, ExternalLink } from 'lucide-react';
import { requestNotificationPermission } from '../lib/pushNotifications';
import { Link } from 'react-router-dom';

type Notification = {
    id: string;
    title: string;
    body: string;
    type: 'marketing' | 'personal' | 'system';
    link?: string;
    is_read: boolean;
    created_at: string;
};

export default function NotificationCenter() {
    const { profile } = useAuthStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
        'Notification' in window ? Notification.permission : 'denied'
    );

    useEffect(() => {
        if (profile?.id) {
            fetchNotifications();

            // Subscrever para push notifications automaticamente
            requestNotificationPermission(profile.id).then(setPermissionStatus);

            const subscription = supabase
                .channel('user_notifications')
                .on('postgres_changes', {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'user_notifications',
                    filter: `user_id=eq.${profile.id}`
                }, () => {
                    fetchNotifications();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(subscription);
            };
        }
    }, [profile?.id]);

    const fetchNotifications = async () => {
        if (!profile?.id) return;

        const { data, error } = await supabase
            .from('user_notifications')
            .select('*')
            .or(`user_id.eq.${profile.id},user_id.is.null`)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) console.error(error);
        else {
            setNotifications(data || []);
            setUnreadCount(data?.filter(n => !n.is_read).length || 0);
        }
    };

    const markAsRead = async (id: string) => {
        await supabase.from('user_notifications').update({ is_read: true }).eq('id', id);
        fetchNotifications();
    };

    const markAllAsRead = async () => {
        if (!profile?.id) return;
        await supabase
            .from('user_notifications')
            .update({ is_read: true })
            .or(`user_id.eq.${profile.id},user_id.is.null`)
            .eq('is_read', false);
        fetchNotifications();
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'marketing': return <Zap className="w-4 h-4 text-orange-500" />;
            case 'personal': return <Trophy className="w-4 h-4 text-emerald-500" />;
            default: return <Megaphone className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-xl bg-white border border-slate-100 shadow-sm transition-transform active:scale-95 group"
            >
                <Bell className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-[2rem] border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <Bell className="w-3.5 h-3.5" /> Notificações
                            </h3>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button
                                        onClick={markAllAsRead}
                                        className="p-1.5 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors group/btn"
                                        title="Marcar todas como lidas"
                                    >
                                        <CheckCheck className="w-4 h-4" />
                                    </button>
                                )}
                                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <Info className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-xs font-black uppercase tracking-widest">Tudo limpo por aqui!</p>
                                </div>
                            ) : (
                                notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className={`p-4 border-b border-slate-50 transition-colors hover:bg-slate-50 relative group ${!n.is_read ? 'bg-emerald-50/30' : ''}`}
                                    >
                                        {!n.is_read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-full" />}
                                        <div className="flex gap-4">
                                            <div className="mt-1 p-2 bg-white rounded-xl shadow-sm border border-slate-100 shrink-0">
                                                {getIcon(n.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-slate-900 text-sm leading-tight">{n.title}</h4>
                                                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{n.body}</p>
                                                <div className="flex items-center justify-between mt-3">
                                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        {!n.is_read && (
                                                            <button
                                                                onClick={() => markAsRead(n.id)}
                                                                className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
                                                            >
                                                                Marcar lida
                                                            </button>
                                                        )}
                                                        {n.link && (
                                                            <a
                                                                href={n.link}
                                                                className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1"
                                                            >
                                                                Ver <ArrowRight className="w-3 h-3" />
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}

                            {notifications.length > 0 && (
                                <Link
                                    to="/notifications"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-center gap-2 p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-slate-50 border-t border-slate-50 transition-colors"
                                >
                                    Ver todas as notificações <ExternalLink className="w-3 h-3" />
                                </Link>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 text-center space-y-2">
                            {permissionStatus === 'denied' && (
                                <div className="flex items-center gap-2 justify-center text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                                    <BellOff className="w-3 h-3" />
                                    Notificações bloqueadas — active nas definições do browser
                                </div>
                            )}
                            {permissionStatus === 'default' && profile?.id && (
                                <button
                                    onClick={() => requestNotificationPermission(profile.id).then(setPermissionStatus)}
                                    className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline flex items-center gap-1 mx-auto"
                                >
                                    <Bell className="w-3 h-3" /> Ativar notificações push
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
