import { useEffect, useMemo, useState } from 'react';
import { Award, Medal, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import AreaLockCard from '../components/AreaLockCard';

export default function Ranking() {
  const navigate = useNavigate();
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
        const { data: profilesData, error } = await supabase
          .from('profiles')
          .select('id, full_name, total_xp, role')
          .eq('selected_area_id', profile.selected_area_id)
          .order('total_xp', { ascending: false })
          .limit(10);

        if (error) throw error;

        setRanking(profilesData || []);
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
            Top 10 - Ranking Nacional
          </h1>
          <p className="text-slate-500">Os estudantes com mais destaque em {selectedAreaName}.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            {selectedAreaName}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_-44px_rgba(15,23,42,0.35)]">
        {loading ? (
          <div className="flex justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600"></div>
          </div>
        ) : ranking.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Nenhum estudante registado nesta área ainda.
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
                    <span className="text-xl font-black text-slate-400">{index + 1}º</span>
                  )}
                </div>

                <div className="ml-4 flex flex-1 items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600">
                    {(item.full_name || 'U').charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p
                        className="font-black text-slate-900 cursor-pointer hover:text-emerald-600 transition-colors"
                        onClick={() => navigate(`/profile/${item.id}`)}
                      >
                        {item.full_name || 'Estudante anónimo'}
                      </p>
                      {item.role && item.role !== 'admin' && (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${item.role === 'elite' ? 'bg-purple-100 text-purple-700' :
                          item.role === 'premium' ? 'bg-amber-100 text-amber-700' :
                            item.role === 'basic' ? 'bg-sky-100 text-sky-700' :
                              'bg-slate-100 text-slate-500'
                          }`}>
                          {item.role === 'free' ? 'Gratuito' : item.role}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{selectedAreaName}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-0.5">XP</p>
                  <p className="text-2xl font-black text-emerald-600">{item.total_xp || 0}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
