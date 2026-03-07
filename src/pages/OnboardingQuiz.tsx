import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';

export default function OnboardingQuiz() {
  const { profile } = useAuthStore();
  const { topics, fetchTopics } = useAppStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const areaId = profile?.selected_area_id;
    if (!areaId) {
      setLoading(false);
      return;
    }

    void (async () => {
      setLoading(true);
      await fetchTopics(areaId);
      setLoading(false);
    })();
  }, [profile?.selected_area_id, fetchTopics]);

  const startQuickQuiz = () => {
    if (!topics || topics.length === 0) {
      // fallback: go to training page and let it auto-select
      navigate('/training');
      return;
    }

    const firstTopic = topics[0];
    navigate(`/training?session=1&topic=${firstTopic.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-[1.6rem] border bg-white p-8 shadow">
        <h1 className="text-2xl font-black text-slate-900">Quiz rápido de boas-vindas</h1>
        <p className="mt-3 text-sm text-slate-600">
          Este quiz rápido (5 questões) ajuda a situar o seu nível e já gera os primeiros pontos de XP.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={startQuickQuiz}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <PlayCircle className="h-5 w-5" />
            Iniciar quiz rápido
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            Ir ao painel
          </button>
        </div>
      </div>
    </div>
  );
}
