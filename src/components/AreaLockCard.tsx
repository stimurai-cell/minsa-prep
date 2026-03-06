import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

interface Area {
  id: string;
  name: string;
}

interface AreaLockCardProps {
  areas: Area[];
  title?: string;
  description?: string;
}

export default function AreaLockCard({
  areas,
  title = 'Defina a sua area de estudo',
  description = 'Escolha a area que mais combina com o seu plano para comecar a praticar.',
}: AreaLockCardProps) {
  const { user, refreshProfile } = useAuthStore();
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!user?.id || !selectedAreaId) {
      setError('Selecione uma area para continuar.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ selected_area_id: selectedAreaId })
        .eq('id', user.id);

      if (updateError) {
        throw updateError;
      }

      await refreshProfile(user.id);
    } catch (err: any) {
      setError(err?.message || 'Nao foi possivel guardar a area.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-[2rem] border border-emerald-200 bg-[linear-gradient(135deg,#f2fbf6_0%,#ffffff_55%,#eef8ff_100%)] p-6 md:p-8 shadow-[0_24px_80px_-36px_rgba(16,185,129,0.45)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">
                Configuracao obrigatoria
              </p>
              <h1 className="mt-2 text-2xl font-black text-slate-900">{title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white/80 p-4">
              <label className="mb-2 block text-sm font-semibold text-slate-800">Area principal</label>
              <select
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500"
              >
                <option value="" disabled>
                  Selecione a sua area
                </option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
              <button
                onClick={handleSave}
                disabled={!selectedAreaId || saving}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'A guardar...' : 'Guardar area e continuar'}
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
