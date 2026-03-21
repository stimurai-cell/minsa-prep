import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

// Escuta batalhas apenas para quem pode usar o modo Batalha.
export default function BattleAutoJoin() {
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const lastMatchRef = useRef<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const hasBattleMode = profile?.role === 'elite' || profile?.role === 'admin';

  useEffect(() => {
    if (!profile?.id || !hasBattleMode) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    let active = true;

    const enterIfActive = async () => {
      if (!navigator.onLine) return;

      try {
        const { data, error } = await supabase
          .from('battle_matches')
          .select('id, status, challenger_id, opponent_id')
          .eq('status', 'active')
          .or(`challenger_id.eq.${profile.id},opponent_id.eq.${profile.id}`)
          .limit(1)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.warn('Battle auto join polling failed:', error);
          return;
        }

        if (data && data.id !== lastMatchRef.current) {
          lastMatchRef.current = data.id;
          navigate(`/battle/${data.id}`);
        }
      } catch (error) {
        if (active) {
          console.warn('Battle auto join polling crashed:', error);
        }
      }
    };

    void enterIfActive();
    pollRef.current = setInterval(() => {
      void enterIfActive();
    }, 5000);

    const channel = supabase
      .channel(`battle-live-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'battle_matches',
          filter: `challenger_id=eq.${profile.id}`,
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
          filter: `opponent_id=eq.${profile.id}`,
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
      active = false;
      supabase.removeChannel(channel);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasBattleMode, navigate, profile?.id]);

  return null;
}
