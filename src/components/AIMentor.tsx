import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Brain, Target, ArrowRight, Lock, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'motion/react';

interface AIAnalysis {
    weaknesses: string[];
    strength: string;
    advice: string;
    motivation: string;
}

export default function AIMentor() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const { areas } = useAppStore();
    const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const isPaidUser = ['premium', 'elite', 'admin'].includes(profile?.role || '');

    const areaName = areas.find(a => a.id === profile?.selected_area_id)?.name || 'Saúde';

    const fetchAnalysis = async () => {
        if (!profile?.id || !isPaidUser) return;
        setLoading(true);

        try {
            const { data: topicProgress } = await supabase
                .from('user_topic_progress')
                .select('domain_score, topics(name)')
                .eq('user_id', profile.id)
                .order('domain_score', { ascending: true });

            const { data: attempts } = await supabase
                .from('quiz_attempts')
                .select('score, completed_at')
                .eq('user_id', profile.id)
                .eq('is_completed', true)
                .order('completed_at', { ascending: false })
                .limit(5);

            // Buscar todos os tópicos da área para análise completa (modo Elite)
            const { data: allTopics } = await supabase
                .from('topics')
                .select('name')
                .eq('area_id', profile.selected_area_id);

            const res = await fetch('/api/ai-mentor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: profile.full_name,
                    area: areaName,
                    topicProgress,
                    recentAttempts: attempts,
                    allTopics: allTopics || []
                })
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setAnalysis(data);

            await supabase.from('ai_mentor_logs').insert({
                user_id: profile.id,
                advice: data.advice,
                weaknesses: data.weaknesses,
                strength: data.strength
            });

        } catch (err) {
            console.error('Error fetching AI analysis:', err);
            // Optional: error message to user
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const loadLastLog = async () => {
            if (!profile?.id || !isPaidUser) return;
            const { data } = await supabase
                .from('ai_mentor_logs')
                .select('*')
                .eq('user_id', profile.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) {
                setAnalysis({
                    weaknesses: data.weaknesses,
                    strength: data.strength,
                    advice: data.advice,
                    motivation: "Mantenha o foco nos seus objetivos!"
                });
            }
        }
        loadLastLog();
    }, [profile?.id, isPaidUser]);

    if (!isPaidUser) {
        return (
            <div className="rounded-[2.5rem] border border-slate-200 bg-white p-6 md:p-8 relative overflow-hidden group">
                <div className="absolute inset-0 bg-slate-50/60 backdrop-blur-[4px] z-10 flex flex-col items-center justify-center text-center p-6">
                    <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl rotate-3 group-hover:rotate-0 transition-transform">
                        <Lock className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">Mentor IA</h3>
                    <p className="text-sm text-slate-600 mb-6 max-w-[240px] leading-relaxed">A análise inteligente de desempenho está disponível nos planos pagos.</p>
                    <button
                        onClick={() => navigate('/premium')}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-black px-8 py-3.5 rounded-2xl shadow-[0_4px_0_0_#b45309] active:shadow-none active:translate-y-1 transition-all uppercase tracking-widest text-[10px]"
                    >
                        Ver Planos Premium
                    </button>
                </div>
                <div className="opacity-10 pointer-events-none blur-[1px]">
                    <h3 className="text-lg font-black mb-4 flex items-center gap-2">
                        <Brain className="w-5 h-5" /> Mentor IA
                    </h3>
                    <div className="space-y-3">
                        <div className="h-4 bg-slate-300 rounded-full w-3/4"></div>
                        <div className="h-4 bg-slate-300 rounded-full w-1/2"></div>
                        <div className="h-24 bg-slate-200 rounded-2xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-[2.5rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_100%)] p-6 md:p-8 relative overflow-hidden shadow-[0_20px_60px_-15px_rgba(30,41,59,0.1)]">
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <Brain className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Análise do Mentor</h3>
                        <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Powered by Gemini AI</p>
                    </div>
                </div>
                <button
                    onClick={fetchAnalysis}
                    disabled={loading}
                    className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
                    title="Atualizar Análise"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                </button>
            </div>

            <AnimatePresence mode="wait">
                {!analysis ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="py-10 text-center"
                    >
                        <Brain className="w-16 h-16 text-indigo-100 mx-auto mb-4" />
                        <h4 className="text-slate-800 font-black mb-2">Pronto para sua mentoria?</h4>
                        <p className="text-sm text-slate-500 mb-6 max-w-[280px] mx-auto">Vou analisar todos os seus erros e acertos para traçar o seu melhor caminho.</p>
                        <button
                            onClick={fetchAnalysis}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-3.5 rounded-2xl shadow-[0_4px_0_0_#3730a3] active:shadow-none active:translate-y-1 transition-all"
                        >
                            Gerar Análise Agora
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="grid gap-4 mb-6 sm:grid-cols-2">
                            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-2 flex items-center gap-1">
                                    <Target className="w-3 h-3" /> Ponto Forte
                                </p>
                                <p className="text-sm font-bold text-slate-900">{analysis.strength}</p>
                            </div>
                            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                                <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-2 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Focar em
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {analysis.weaknesses.map(w => (
                                        <span key={w} className="text-xs font-bold text-slate-900 bg-white/60 px-2 py-0.5 rounded-md border border-red-200">{w}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm mb-4 relative">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <Brain className="w-20 h-20 text-indigo-900" />
                            </div>
                            <p className="text-slate-700 text-sm leading-relaxed font-medium mb-4 italic">
                                "{analysis.advice}"
                            </p>
                            <div className="flex items-center gap-3 pt-4 border-t border-slate-50">
                                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                                    <Sparkles className="w-4 h-4 fill-current" />
                                </div>
                                <p className="text-xs font-black text-slate-900 uppercase tracking-wider">{analysis.motivation}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Dynamic Ray effect */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl -z-10"></div>
        </div>
    );
}
