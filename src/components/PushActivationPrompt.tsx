import { useEffect, useState } from 'react';
import { Bell, BellOff, CheckCircle2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { requestNotificationPermission, syncPushSubscriptionIfGranted } from '../lib/pushNotifications';

const REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

const buildReminderKey = (userId: string) => `minsa-push-reminder:${userId}`;

export default function PushActivationPrompt() {
    const { profile } = useAuthStore();
    const [isVisible, setIsVisible] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(
        'Notification' in window ? Notification.permission : 'denied'
    );
    const [activating, setActivating] = useState(false);
    const [helperText, setHelperText] = useState('');

    useEffect(() => {
        if (!profile?.id || !('Notification' in window)) {
            setIsVisible(false);
            return;
        }

        let cancelled = false;

        const refreshPromptState = async () => {
            const currentPermission = Notification.permission;
            setPermissionStatus(currentPermission);

            if (currentPermission === 'granted') {
                await syncPushSubscriptionIfGranted(profile.id);
                localStorage.removeItem(buildReminderKey(profile.id));
                if (!cancelled) {
                    setHelperText('');
                    setIsVisible(false);
                }
                return;
            }

            const nextReminderAt = Number(localStorage.getItem(buildReminderKey(profile.id)) || '0');
            if (!cancelled) {
                setIsVisible(Date.now() >= nextReminderAt);
            }
        };

        void refreshPromptState();

        return () => {
            cancelled = true;
        };
    }, [profile?.id]);

    const remindLater = () => {
        if (!profile?.id) return;
        localStorage.setItem(buildReminderKey(profile.id), String(Date.now() + REMINDER_INTERVAL_MS));
        setHelperText('');
        setIsVisible(false);
    };

    const handleActivate = async () => {
        if (!profile?.id) return;

        setActivating(true);
        setHelperText('');

        try {
            const permission = await requestNotificationPermission(profile.id);
            setPermissionStatus(permission);

            if (permission === 'granted') {
                localStorage.removeItem(buildReminderKey(profile.id));
                setIsVisible(false);
                return;
            }

            localStorage.setItem(buildReminderKey(profile.id), String(Date.now() + REMINDER_INTERVAL_MS));
            setHelperText(
                permission === 'denied'
                    ? 'As notificacoes ficaram bloqueadas neste aparelho. Voce pode reativar nas definicoes do navegador.'
                    : 'Nao foi possivel ativar agora. Vamos voltar a lembrar daqui a alguns dias.'
            );
        } finally {
            setActivating(false);
        }
    };

    if (!profile?.id || !('Notification' in window)) {
        return null;
    }

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
                    <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={remindLater}
                        className="absolute inset-0 bg-slate-950/35"
                        aria-label="Fechar lembrete de notificacoes"
                    />

                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.98 }}
                        transition={{ duration: 0.2 }}
                        className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_28px_90px_-44px_rgba(15,23,42,0.45)]"
                    >
                        <button
                            type="button"
                            onClick={remindLater}
                            className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Lembrar depois"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        <div className="flex items-start gap-4">
                            <div className="rounded-[1.4rem] bg-emerald-50 p-3 text-emerald-600">
                                {permissionStatus === 'denied' ? <BellOff className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
                            </div>
                            <div className="pr-10">
                                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-600">
                                    Avisos do telefone
                                </p>
                                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                                    Ative as notificacoes e nao perca novidades importantes.
                                </h3>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                            <p>Receba alertas mesmo com a app fechada.</p>
                            <p>Saiba quando houver avisos, conquistas e lembretes de estudo.</p>
                            <p>Voce so precisa ativar uma vez neste aparelho.</p>
                        </div>

                        {helperText && (
                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                                {helperText}
                            </div>
                        )}

                        {permissionStatus === 'granted' && (
                            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" />
                                Notificacoes ja ativas
                            </div>
                        )}

                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={remindLater}
                                className="inline-flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Lembrar depois
                            </button>

                            <button
                                type="button"
                                onClick={handleActivate}
                                disabled={activating || permissionStatus === 'granted'}
                                className="inline-flex flex-1 items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {permissionStatus === 'denied'
                                    ? 'Tentar novamente'
                                    : activating
                                        ? 'A ativar...'
                                        : 'Ativar notificacoes'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
