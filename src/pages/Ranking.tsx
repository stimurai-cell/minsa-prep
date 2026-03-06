import { useEffect, useMemo, useState } from 'react';
import { Award, Medal, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import AreaLockCard from '../components/AreaLockCard';

export default function Ranking() {
  const { profile } = useAuthStore();
  const { areas, fetchAreas } = useAppStore();
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAreas();
  }, [fetchAreas]);

  const selectedAreaName = useMemo(
    () => areas.find((area) => area.id === profile?.selected_area_id)?.name || 'Area nao definida',
    [areas, profile?.selected_area_id]
  );

  useEffect(() => {
    const fetchRanking = async () => {
      if (!profile?.selected_area_id) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('quiz_attempts')
          .select(
            `
            score,
            profiles (full_name)
          `
          )
          .eq('area_id', profile.selected_area_id)
          .eq('is_completed', true)
          .order('score', { ascending: false })
          .limit(10);

        if (error) throw error;

        const uniqueUsers = new Map<string, any>();
        data?.forEach((attempt: any) => {
          const name = attempt.profiles?.full_name;
          if (!uniqueUsers.has(name) || uniqueUsers.get(name).score < attempt.score) {
            uniqueUsers.set(name, attempt);
          }
        });

        setRanking(Array.from(uniqueUsers.values()).sort((a, b) => b.score - a.score));
      } catch (error) {
        console.error('Error fetching ranking:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [profile?.selected_area_id]);

  if (!profile?.selected_area_id) {
    return <AreaLockCard areas={areas} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <Award className="h-6 w-6 text-emerald-600" />
            Ranking da sua area
          </h1>
          <p className="text-slate-500">Comparacao entre estudantes da area {selectedAreaName}.</p>
        </div>

        <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
          {selectedAreaName}
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_-44px_rgba(15,23,42,0.35)]">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600"></div>
          </div>
        ) : ranking.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Nenhuma simulacao de prova realizada nesta area ainda.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {ranking.map((item, index) => (
              <div
                key={index}
                className={`flex items-center p-4 transition-colors hover:bg-slate-50 md:p-6 ${index < 3 ? 'bg-emerald-50/40' : ''}`}
              >
                <div className="w-12 flex justify-center">
                  {index === 0 ? (
                    <Trophy className="h-8 w-8 text-yellow-500" />
                  ) : index === 1 ? (
                    <Medal className="h-7 w-7 text-slate-400" />
                  ) : index === 2 ? (
                    <Medal className="h-7 w-7 text-amber-600" />
                  ) : (
                    <span className="text-xl font-black text-slate-400">{index + 1}o</span>
                  )}
                </div>

                <div className="ml-4 flex flex-1 items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600">
                    {item.profiles?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="font-black text-slate-900">{item.profiles?.full_name || 'Utilizador anonimo'}</p>
                    <p className="text-xs text-slate-500">Media das ultimas simulacoes de prova</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-2xl font-black text-emerald-600">{item.score}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
