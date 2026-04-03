import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bell, BellOff, ExternalLink, Info, Megaphone, Trophy, X, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { requestNotificationPermission, syncPushSubscriptionIfGranted } from '../lib/pushNotifications';
import { fetchHydratedNotifications, markNotificationsAsRead, type HydratedNotification } from '../lib/notifications';

export default function NotificationCenter() {
    const { profile } = useAuthStore();
    const [notifications, setNotifications] = useState<HydratedNotification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
        'Notification' in window ? Notification.permission : 'denied'
    );

    const fetchNotifications = async () => {
        if (!profile?.id) return;

        try {
            const data = await fetchHydratedNotifications(profile.id, 100);
            setNotifications(data.slice(0, 10));
            setUnreadCount(data.filter((notification) => !notification.is_read).length);
        } catch (error) {
            console.error(error);
            return;
        }
    };

    const markVisibleNotificationsAsRead = async (items: HydratedNotification[]) => {
        if (!profile?.id) return;
        const unreadVisible = items.filter((notification) => !notification.is_read);
        if (!unreadVisible.length) return;

        setNotifications((prev) => prev.map((notification) => ({ ...notification, is_read: true })));
        setUnreadCount((current) => Math.max(0, current - unreadVisible.length));

        try {
            await markNotificationsAsRead(profile.id, unreadVisible);
        } catch (error) {
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
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-[1.2rem] rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-lg">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
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
                                        {!notification.is_read && (
                                            <span className="absolute right-4 top-4 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                        )}
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
