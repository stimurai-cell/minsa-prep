import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
    Zap,
    X,
    Volume2,
    Timer,
    RotateCcw,
    ChevronRight,
    AlertCircle,
    Star,
    Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
    playSuccessSound,
    playErrorSound,
    playBooSound,
    playCountdownSound
} from '../lib/sounds';
import { getAlternativeLabel, prepareQuestionSet } from '../lib/quiz';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { awardXp as unifiedAwardXp } from '../lib/xp';
import { sendPushNotification } from '../lib/pushNotifications';

const TIMER_SECONDS = 45;

export default function SpeedMode() {
    const { profile, refreshProfile } = useAuthStore();
    const { areas, fetchAreas } = useAppStore();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<any[]>([]);
    const [remainingIds, setRemainingIds] = useState<string[]>([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
    const [score, setScore] = useState(0);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isAnswering, setIsAnswering] = useState(false);
    const [showIntro, setShowIntro] = useState(true);
    const [bestStreak, setBestStreak] = useState(0);
    const [showLevelUp, setShowLevelUp] = useState<string | null>(null);
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('easy');

    const ttsRef = useRef<SpeechSynthesisUtterance | null>(null);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        fetchAreas();
    }, [fetchAreas]);

    const stopTTS = useCallback(() => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
    }, []);

    const speak = useCallback((text: string) => {
        if (!window.speechSynthesis) return;
        stopTTS();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.1;
        utterance.pitch = 1.1;
        ttsRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }, [stopTTS]);

    const filterStandardQuestions = (qs: any[]) => (qs || []).filter(q => (q.alternatives || []).length === 4);

    const fetchQuestionBatch = async (ids: string[]) => {
        if (ids.length === 0) return [];
        const { data, error } = await supabase
            .from('questions')
            .select(`
          id, content, difficulty,
          alternatives (id, content, is_correct)
        `)
            .in('id', ids);

        if (error) throw error;
        // Keep the order of IDs we requested, filtrando somente alternativas A-D
        return filterStandardQuestions(ids.map(id => data.find(q => q.id === id)).filter(Boolean));
    };

    const bootQuestions = async (reset = false) => {
        if (!profile?.selected_area_id) return;
        setLoading(true);
        try {
            let currentRemaining = reset ? [] : remainingIds;

            if (currentRemaining.length === 0) {
                const { data: topics } = await supabase
                    .from('topics')
                    .select('id')
                    .eq('area_id', profile.selected_area_id);

                if (!topics || topics.length === 0) throw new Error('Área sem tópicos cadastrados.');

                const topicIds = topics.map(t => t.id);
                const { data: allIds, error: idsError } = await supabase
                    .from('questions')
                    .select('id')
                    .in('topic_id', topicIds);

                if (idsError) throw idsError;
                if (!allIds || allIds.length === 0) throw new Error('Não há questões para esta área.');

                // Shuffle IDs
                currentRemaining = allIds.map(q => q.id).sort(() => Math.random() - 0.5);
            }

            const batchToFetch = currentRemaining.slice(0, 30);
            const newRemaining = currentRemaining.slice(30);

            const fetchedQuestions = await fetchQuestionBatch(batchToFetch);

            setQuestions(prev => reset ? prepareQuestionSet(fetchedQuestions) : [...prev, ...prepareQuestionSet(fetchedQuestions)]);
            setRemainingIds(newRemaining);

        } catch (err) {
            console.error('Error booting Speed Mode:', err);
        } finally {
            setLoading(false);
        }
    };

    const startSession = () => {
        setShowIntro(false);
        setIsGameOver(false);
        setScore(0);
        setCurrentQIndex(0);
        setTimeLeft(TIMER_SECONDS);
        setDifficulty('easy');
        setRemainingIds([]);
        void bootQuestions(true);
    };

    const handleEliteMerit = async () => {
        if (!profile?.id) return;

        // 1. Post to news/feed
        await supabase.from('feed_items').insert({
            user_id: profile.id,
            type: 'achievement',
            content: {
                title: 'Novo Estudante de Elite! 🎓',
                body: `${profile.full_name || 'Um estudante'} alcançou o combo lendário de 100 questões no Modo Relâmpago!`,
                score: 100
            }
        });

        // 2. Broadcast push (simulated by sending without userId if supported or to profile followers)
        await sendPushNotification({
            title: 'Elite no MINSA Prep! 👑',
            body: `${profile.full_name || 'Alguém'} acabou de bater 100 questões seguidas! Consegues superar?`,
            url: '/news'
        });
    };

    const gameOver = useCallback(async (reason: 'wrong' | 'timeout') => {
        setIsGameOver(true);
        stopTTS();
        playBooSound();
        if (timerRef.current) window.clearInterval(timerRef.current);

        if (score > bestStreak) {
            setBestStreak(score);
        }

        if (profile?.id && score > 0) {
            const xpAmount = score * 2;
            const result = await unifiedAwardXp(profile.id, xpAmount, profile.total_xp || 0);

            try {
                await supabase.from('activity_logs').insert({
                    user_id: profile.id,
                    activity_type: 'completed_speed_mode',
                    activity_date: new Date().toISOString(),
                    activity_metadata: {
                        score: score,
                        xp: xpAmount,
                        reason: reason
                    }
                });
            } catch (logErr) {
                console.error('Error logging speed mode completion:', logErr);
            }

            if (result.success) {
                await refreshProfile(profile.id);
            }
        }
    }, [score, bestStreak, profile, refreshProfile, stopTTS]);

    const handleAnswer = async (alternativeId: string) => {
        if (isGameOver || isAnswering || showLevelUp) return;

        const currentQ = questions[currentQIndex];
        if (!currentQ) return;

        const selectedAlt = currentQ.alternatives.find((a: any) => a.id === alternativeId);

        if (selectedAlt?.is_correct) {
            playSuccessSound();
            const newScore = score + 1;
            setScore(newScore);

            // Level Up logic
            if (newScore === 6) {
                setDifficulty('medium');
                setShowLevelUp('Médio');
                setTimeout(() => setShowLevelUp(null), 3000);
            } else if (newScore === 16) {
                setDifficulty('hard');
                setShowLevelUp('Difícil');
                setTimeout(() => setShowLevelUp(null), 3000);
            }

            // Elite Merit
            if (newScore === 100) {
                void handleEliteMerit();
            }

            nextQuestion();
        } else {
            playErrorSound();
            await gameOver('wrong');
        }
    };

    const nextQuestion = useCallback(() => {
        if (currentQIndex < questions.length - 1) {
            setCurrentQIndex(prev => prev + 1);
            setTimeLeft(TIMER_SECONDS);
        } else {
            void bootQuestions();
            setCurrentQIndex(prev => prev + 1);
            setTimeLeft(TIMER_SECONDS);
        }
    }, [currentQIndex, questions.length]);

    // Timer logic
    useEffect(() => {
        if (showIntro || isGameOver || loading || !questions.length || showLevelUp) return;

        timerRef.current = window.setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    void gameOver('timeout');
                    return 0;
                }
                if (prev <= 6) {
                    playCountdownSound();
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) window.clearInterval(timerRef.current);
        };
    }, [showIntro, isGameOver, loading, questions.length, gameOver, showLevelUp]);

    // TTS logic
    useEffect(() => {
        if (showIntro || isGameOver || loading || !questions.length || showLevelUp) return;

        const q = questions[currentQIndex];
        if (q) {
            const textToRead = `${q.content}. ... ... Preste atenção às opções: ... ... ${q.alternatives.map((a: any, i: number) => `Opção ${getAlternativeLabel(i).toUpperCase()}: ... ${a.content}`).join('. ... ')}`;
            speak(textToRead);
        }
    }, [currentQIndex, questions, showIntro, isGameOver, loading, speak, showLevelUp]);

    if (showIntro) {
        return (
            <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0f172a] px-6 text-white">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-center"
                >
                    <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-yellow-400 text-slate-900 shadow-[0_0_50px_rgba(250,204,21,0.4)]">
                        <Zap className="h-12 w-12" fill="currentColor" />
                    </div>
                    <h1 className="text-4xl font-black italic tracking-tighter sm:text-6xl uppercase">MODO RELÂMPAGO</h1>
                    <p className="mt-6 text-lg text-slate-400">
                        Responda o máximo que conseguir sem errar. <br />
                        A dificuldade aumenta conforme avança! <br />
                        <span className="font-bold text-yellow-400">45 segundos</span> por questão.
                    </p>

                    <div className="mt-12 flex flex-col gap-4">
                        <button
                            onClick={startSession}
                            className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white px-8 py-5 text-xl font-black uppercase tracking-widest text-slate-900 transition hover:scale-105 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-yellow-400 opacity-0 transition group-hover:opacity-10" />
                            INICIAR CORRIDA
                            <ChevronRight className="h-6 w-6" />
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-white"
                        >
                            Voltar ao painel
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    if (isGameOver) {
        return (
            <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0f172a] px-6 text-white">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="w-full max-w-sm rounded-[3rem] border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl"
                >
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-red-500/20 text-red-500">
                        <AlertCircle className="h-10 w-10" />
                    </div>
                    <h2 className="text-3xl font-black">GAME OVER!</h2>
                    <p className="mt-2 text-slate-400">A sua corrida terminou.</p>

                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-white/5 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Combo Atual</p>
                            <p className="text-4xl font-black text-yellow-400">{score}</p>
                        </div>
                        <div className="rounded-2xl bg-white/5 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Melhor Streak</p>
                            <p className="text-4xl font-black text-emerald-400">{bestStreak || score}</p>
                        </div>
                    </div>

                    <div className="mt-10 flex flex-col gap-3">
                        <button
                            onClick={startSession}
                            className="flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 py-4 text-lg font-black uppercase text-slate-900 transition hover:scale-105"
                        >
                            <RotateCcw className="h-5 w-5" />
                            Tentar novamente
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="py-3 text-sm font-bold uppercase text-slate-500 hover:text-white"
                        >
                            Sair para o painel
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    const currentQ = questions[currentQIndex];

    return (
        <div className="flex min-h-[100dvh] flex-col bg-[#0f172a] text-white overflow-hidden relative">
            <AnimatePresence>
                {showLevelUp && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 2 }}
                        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            className="mb-8"
                        >
                            <Star className="h-32 w-32 text-yellow-400 fill-yellow-400" />
                        </motion.div>
                        <h2 className="text-5xl font-black uppercase tracking-tighter text-white text-center px-6">
                            Nível Superior! <br />
                            <span className="text-yellow-400">DESAFIO {showLevelUp.toUpperCase()}</span>
                        </h2>
                        <motion.p
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="mt-8 text-xl font-bold text-slate-400"
                        >
                            Prepare-se...
                        </motion.p>
                    </motion.div>
                )}

                {score >= 100 && (
                    <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
                        {[...Array(20)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ top: -20, left: `${Math.random() * 100}%` }}
                                animate={{ top: '110%', rotate: 360 }}
                                transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, ease: "linear", delay: Math.random() * 2 }}
                                className="absolute"
                            >
                                <Sparkles className="h-6 w-6 text-yellow-400" />
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-5 backdrop-blur-md relative z-10">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-slate-900">
                        <Zap className="h-6 w-6" fill="currentColor" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Combo Ativo</p>
                        <p className="text-xl font-black leading-none">{score}</p>
                    </div>
                    <div className={`ml-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ring-1 ${difficulty === 'easy' ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20' :
                            difficulty === 'medium' ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20' :
                                'bg-rose-500/10 text-rose-400 ring-rose-500/20'
                        }`}>
                        {difficulty === 'easy' ? 'Fácil' : difficulty === 'medium' ? 'Médio' : 'Difícil'}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 ring-1 ring-white/10">
                        <Timer className={`h-5 w-5 ${timeLeft <= 5 ? 'animate-pulse text-red-500' : 'text-slate-400'}`} />
                        <span className={`text-xl font-black tabular-nums ${timeLeft <= 5 ? 'text-red-500' : 'text-white'}`}>
                            0:{timeLeft.toString().padStart(2, '0')}
                        </span>
                    </div>
                    <button
                        onClick={() => {
                            stopTTS();
                            navigate('/dashboard');
                        }}
                        className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-white"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 flex-col justify-center px-6 py-12 relative z-10">
                <div className="mx-auto w-full max-w-2xl">
                    <AnimatePresence mode="wait">
                        {!currentQ ? (
                            <div key="loading" className="text-center">
                                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
                                <p className="mt-4 font-bold text-slate-400">A preparar o próximo desafio...</p>
                            </div>
                        ) : (
                            <motion.div
                                key={currentQ.id}
                                initial={{ x: 30, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -30, opacity: 0 }}
                                className="space-y-8"
                            >
                                <div className="space-y-4 text-center sm:text-left">
                                    <div className="inline-flex items-center gap-2 rounded-lg bg-yellow-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-yellow-400">
                                        <Volume2 className="h-3 w-3" />
                                        Ouça com atenção
                                    </div>
                                    <h2 className="text-2xl font-black leading-tight sm:text-4xl text-balance">
                                        {currentQ.content}
                                    </h2>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    {currentQ.alternatives.map((alt: any, idx: number) => (
                                        <button
                                            key={alt.id}
                                            disabled={!!showLevelUp}
                                            onClick={() => handleAnswer(alt.id)}
                                            className="group flex items-start gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-yellow-400/50 hover:bg-white/10 active:scale-[0.98] disabled:opacity-50"
                                        >
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg font-black uppercase text-slate-400 group-hover:bg-yellow-400 group-hover:text-slate-900">
                                                {getAlternativeLabel(idx)}
                                            </div>
                                            <span className="text-lg font-medium leading-tight text-slate-200 group-hover:text-white">
                                                {alt.content}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Footer / Progress Bar */}
            <div className="h-2 w-full bg-slate-800 relative z-10">
                <motion.div
                    className="h-full bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]"
                    initial={{ width: "100%" }}
                    animate={{ width: `${(timeLeft / TIMER_SECONDS) * 100}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                />
            </div>
        </div>
    );
}
