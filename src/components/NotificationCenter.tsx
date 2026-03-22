import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, BellOff, ExternalLink, Info, Megaphone, Trophy, X, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { requestNotificationPermission, syncPushSubscriptionIfGranted } from '../lib/pushNotifications';

type AppNotification = {
    id: string;
    user_id: string | null;
    title: string;
    body: string;
    type: string;
    link?: string | null;
    is_read: boolean;
    created_at: string;
};

export default function NotificationCenter() {
    const { profile } = useAuthStore();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
        'Notification' in window ? Notification.permission : 'denied'
    );

    const fetchNotifications = async () => {
        if (!profile?.id) return;

        const { data, error } = await supabase
            .from('user_notifications')
            .select('id, user_id, title, body, type, link, is_read, created_at')
            .or(`user_id.eq.${profile.id},user_id.is.null`)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error(error);
            return;
        }

        setNotifications((data || []) as AppNotification[]);
    };

    const markVisibleNotificationsAsRead = async (items: AppNotification[]) => {
        if (!profile?.id) return;

        const unreadOwnIds = items
            .filter((notification) => !notification.is_read && notification.user_id === profile.id)
            .map((notification) => notification.id);

        if (!unreadOwnIds.length) return;

        setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));

        const { error } = await supabase
            .from('user_notifications')
            .update({ is_read: true })
            .in('id', unreadOwnIds);

        if (error) {
            console.error(error);
            await fetchNotifications();
        }
    };

    useEffect(() => {
        if (!profile?.id) return;

        fetchNotifications();
        setPermissionStatus('Notification' in window ? Notification.permission : 'denied');

        if ('Notification' in window && Notification.permission === 'granted') {
            void syncPushSubscriptionIfGranted(profile.id);
        }

        const subscription = supabase
            .channel('user_notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'user_notifications'
            }, (payload) => {
                const incomingUserId = (payload.new as { user_id?: string | null })?.user_id ?? null;
                if (incomingUserId === null || incomingUserId === profile.id) {
                    fetchNotifications();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [profile?.id]);

    useEffect(() => {
        if (!isOpen || notifications.length === 0) return;
        void markVisibleNotificationsAsRead(notifications);
    }, [isOpen, notifications, profile?.id]);

    const getIcon = (type: string) => {
        switch (type) {
            case 'marketing':
                return <Zap className="w-4 h-4 text-orange-500" />;
            case 'personal':
            case 'achievement':
            case 'friend_activity':
                return <Trophy className="w-4 h-4 text-emerald-500" />;
            default:
                return <Megaphone className="w-4 h-4 text-blue-500" />;
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="relative p-2 rounded-xl bg-white border border-slate-100 shadow-sm transition-transform active:scale-95 group"
            >
                <Bell className="w-6 h-6 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-[2rem] border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="font-black text-slate-800 uppercase tracking-widest text-[10px] flex items-center gap-2">
                                <Bell className="w-3.5 h-3.5" /> Notificacoes
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <Info className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-xs font-black uppercase tracking-widest">Tudo limpo por aqui!</p>
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className="p-4 border-b border-slate-50 transition-colors hover:bg-slate-50 relative group"
                                    >
                                        <div className="flex gap-4">
                                            <div className="mt-1 p-2 bg-white rounded-xl shadow-sm border border-slate-100 shrink-0">
                                                {getIcon(notification.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-slate-900 text-sm leading-tight">{notification.title}</h4>
                                                <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">{notification.body}</p>
                                                <div className="flex items-center justify-between mt-3">
                                                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                                        {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {notification.link && (
                                                        <a
                                                            href={notification.link}
                                                            className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1"
                                                        >
                                                            Ver <ArrowRight className="w-3 h-3" />
                                                        </a>
                                                    )}
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
                                    Ver todas as notificacoes <ExternalLink className="w-3 h-3" />
                                </Link>
                            )}
                        </div>

                        <div className="p-4 bg-slate-50 text-center space-y-2">
                            {permissionStatus === 'denied' && (
                                <div className="flex items-center gap-2 justify-center text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                                    <BellOff className="w-3 h-3" />
                                    Notificacoes bloqueadas - ative nas definicoes do navegador
                                </div>
                            )}
                            {permissionStatus === 'default' && profile?.id && (
                                <button
                                    onClick={() => requestNotificationPermission(profile.id).then(setPermissionStatus)}
                                    className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline flex items-center gap-1 mx-auto"
                                >
                                    <Bell className="w-3 h-3" /> Ativar notificacoes
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
