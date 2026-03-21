import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, PlayCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';

const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/LuQgEqGH12TKciAdcYPocj';

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
    const firstTopicId = topics[0]?.id;

    if (firstTopicId) {
      navigate(`/training?mode=manual&session=1&topic=${firstTopicId}`);
      return;
    }

    navigate('/training?mode=manual');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-[1.6rem] border bg-white p-8 shadow">
        <h1 className="text-2xl font-black text-slate-900">Quiz rápido de boas-vindas</h1>
        <p className="mt-3 text-sm text-slate-600">
          Este quiz rápido (5 questões) ajuda a situar o seu nível e já gera os primeiros pontos de XP.
        </p>

        <div className="mt-6 rounded-[1.4rem] border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-black text-slate-900">Entre na comunidade do WhatsApp</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Assim que terminar o cadastro, o candidato ja pode juntar-se a comunidade para receber orientacoes, avisos e manter-se proximo da preparacao.
              </p>
              <a
                href={WHATSAPP_COMMUNITY_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <MessageCircle className="h-5 w-5" />
                Entrar na comunidade
              </a>
            </div>
          </div>
        </div>

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
