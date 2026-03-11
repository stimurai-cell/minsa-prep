import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Bell, X, Info, CheckCircle2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type Notification = {
    id: string;
    title: string;
    body: string;
    type: string;
};

export default function ToastNotification() {
    const { profile } = useAuthStore();
    const [activeToast, setActiveToast] = useState<Notification | null>(null);

    useEffect(() => {
        if (!profile?.id) return;

        // Listen for new notifications in real-time
        const subscription = supabase
            .channel('realtime_toasts')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'user_notifications',
                filter: `user_id=eq.${profile.id}`
            }, (payload) => {
                const newNotif = payload.new as Notification;
                showToast(newNotif);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [profile?.id]);

    const showToast = (notif: Notification) => {
        setActiveToast(notif);

        // Play notification sound (optional)
        try {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { }); // Browser might block auto-play
        } catch (e) {
            console.warn('Could not play notification sound');
        }

        // Auto-hide after 6 seconds
        setTimeout(() => {
            setActiveToast(null);
        }, 6000);
    };

    return (
        <AnimatePresence>
            {activeToast && (
                <motion.div
                    initial={{ opacity: 0, y: 50, x: 50, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                    className="fixed bottom-6 right-6 z-[9999] w-full max-w-sm"
                >
                    <div className="bg-white border-2 border-emerald-500 rounded-[1.5rem] shadow-2xl p-4 flex gap-4 items-start relative overflow-hidden group">
                        {/* Progress bar line */}
                        <motion.div
                            initial={{ width: '100%' }}
                            animate={{ width: '0%' }}
                            transition={{ duration: 6, ease: "linear" }}
                            className="absolute bottom-0 left-0 h-1 bg-emerald-500"
                        />

                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                            <Bell className="w-5 h-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Novo Alerta
                            </p>
                            <h4 className="font-black text-slate-900 text-sm leading-tight truncate">
                                {activeToast.title}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium mt-1 line-clamp-2">
                                {activeToast.body}
                            </p>
                        </div>

                        <button
                            onClick={() => setActiveToast(null)}
                            className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
