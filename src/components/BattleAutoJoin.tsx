import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

// Escuta batalhas envolvendo o usuário e garante entrada automática
export default function BattleAutoJoin() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const lastMatchRef = useRef<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!profile?.id) return;

    const enterIfActive = async () => {
      const { data } = await supabase
        .from('battle_matches')
        .select('id, status, challenger_id, opponent_id')
        .eq('status', 'active')
        .or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
        .limit(1)
        .single();

      if (data && data.id !== lastMatchRef.current) {
        lastMatchRef.current = data.id;
        navigate(`/battle/${data.id}`);
      }
    };

    enterIfActive();
    // Fallback de polling a cada 2s para reduzir latência se o realtime atrasar
    pollRef.current = setInterval(enterIfActive, 2000);

    const channel = supabase
      .channel(`battle-live-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_matches',
          filter: `challenger_id=eq.${profile.id}`
        },
        (payload) => {
          if (payload.new.status === 'active' && payload.new.id !== lastMatchRef.current) {
            lastMatchRef.current = payload.new.id;
            navigate(`/battle/${payload.new.id}`);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_matches',
          filter: `opponent_id=eq.${profile.id}`
        },
        (payload) => {
          if (payload.new.status === 'active' && payload.new.id !== lastMatchRef.current) {
            lastMatchRef.current = payload.new.id;
            navigate(`/battle/${payload.new.id}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [profile?.id, navigate]);

  return null;
}
