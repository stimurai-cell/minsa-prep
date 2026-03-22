import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { sendPushNotification, syncPushSubscriptionIfGranted } from '../lib/pushNotifications';

export default function PaymentNotificationListener() {
    const { profile } = useAuthStore();
    const isAdmin = profile?.role === 'admin';

    // Solicitar permissão e subscrever para push quando o utilizador abre o app
    useEffect(() => {
        if (!profile?.id) return;
        if ('Notification' in window && Notification.permission === 'granted') {
            void syncPushSubscriptionIfGranted(profile.id);
        }
    }, [profile?.id]);

    // Ouvir novos pagamentos e enviar push ao admin
    useEffect(() => {
        if (!isAdmin) return;

        const channel = supabase
            .channel('payment_requests_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'payment_requests',
                },
                (payload) => {
                    const newRequest = payload.new as any;

                    // Push nativo via Service Worker (funciona com app fechada)
                    sendPushNotification({
                        title: '💰 Novo Pagamento Recebido!',
                        body: `${newRequest.payer_name} enviou um comprovativo para o plano ${newRequest.plan_name}.`,
                        url: '/admin',
                    });

                    // Fallback: Web Notification se o app estiver aberto e com foco
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('💰 Novo Pagamento Recebido!', {
                            body: `${newRequest.payer_name} enviou um comprovativo para o plano ${newRequest.plan_name}.`,
                            icon: 'https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/qosfbrnflucygej3us4h.png',
                            tag: `payment-${newRequest.id}`,
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isAdmin]);

    return null;
}
