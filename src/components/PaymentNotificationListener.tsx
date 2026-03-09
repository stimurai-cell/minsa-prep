import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function PaymentNotificationListener() {
    const { profile } = useAuthStore();
    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
        if (!isAdmin) return;

        // Request notification permission on mount for admins
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }

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
                    const newRequest = payload.new;

                    if ("Notification" in window && Notification.permission === "granted") {
                        new Notification("Novo Pagamento Recebido! 💰", {
                            body: `${newRequest.payer_name} enviou um comprovativo para o plano ${newRequest.plan_name}.`,
                            icon: "https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/qosfbrnflucygej3us4h.png"
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
