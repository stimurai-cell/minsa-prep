import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
    Zap,
    X,
    Volume2,
    Timer,
    Trophy,
    RotateCcw,
    ChevronRight,
    AlertCircle
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

const TIMER_SECONDS = 60;

export default function SpeedMode() {
    const { profile, refreshProfile } = useAuthStore();
    const { areas, fetchAreas } = useAppStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
    const [score, setScore] = useState(0);
    const [isGameOver, setIsGameOver] = useState(false);
    const [isAnswering, setIsAnswering] = useState(false);
    const [showIntro, setShowIntro] = useState(true);
    const [bestStreak, setBestStreak] = useState(0);

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
        utterance.lang = 'pt-BR'; // pt-BR usually sounds slightly more natural in some browsers than pt-PT
        utterance.rate = 0.85; // Slower for better clarity
        utterance.pitch = 1.0;
        ttsRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }, [stopTTS]);

    const bootQuestions = async () => {
        if (!profile?.selected_area_id) return;
        setLoading(true);
        try {
            const { data: topics } = await supabase
                .from('topics')
                .select('id')
                .eq('area_id', profile.selected_area_id);

            if (!topics || topics.length === 0) throw new Error('No topics found');

            const topicIds = topics.map(t => t.id);
            const { data, error } = await supabase
                .from('questions')
                .select(`
          id, content, difficulty,
          alternatives (id, content, is_correct)
        `)
                .in('topic_id', topicIds)
                .order('id') // We will shuffle in prepareQuestionSet
                .limit(100);

            if (error) throw error;
            if (data) {
                setQuestions(prepareQuestionSet(data));
            }
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
        void bootQuestions();
    };

    const gameOver = useCallback(async (reason: 'wrong' | 'timeout') => {
        setIsGameOver(true);
        stopTTS();
        playBooSound();
        if (timerRef.current) window.clearInterval(timerRef.current);

        if (score > bestStreak) {
            setBestStreak(score);
        }

        // Award XP based on score
        if (profile?.id && score > 0) {
            const xpAmount = score * 2; // 2 XP per correct answer in speed mode
            const result = await unifiedAwardXp(profile.id, xpAmount, profile.total_xp || 0);

            // Log speed mode completion
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
        if (isGameOver || isAnswering) return;

        const currentQ = questions[currentQIndex];
        if (!currentQ) return;

        const selectedAlt = currentQ.alternatives.find((a: any) => a.id === alternativeId);

        if (selectedAlt?.is_correct) {
            playSuccessSound();
            setScore(prev => prev + 1);
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
            // Re-boot more questions if reached end
            void bootQuestions();
            setCurrentQIndex(0);
            setTimeLeft(TIMER_SECONDS);
        }
    }, [currentQIndex, questions.length]);

    // Timer logic
    useEffect(() => {
        if (showIntro || isGameOver || loading || !questions.length) return;

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
    }, [showIntro, isGameOver, loading, questions.length, gameOver]);

    // TTS logic for new questions
    useEffect(() => {
        if (showIntro || isGameOver || loading || !questions.length) return;

        const q = questions[currentQIndex];
        if (q) {
            const textToRead = `${q.content}. ... ... Preste atenção às opções: ... ... ${q.alternatives.map((a: any, i: number) => `Opção ${getAlternativeLabel(i).toUpperCase()}: ... ${a.content}`).join('. ... ')}`;
            speak(textToRead);
        }
    }, [currentQIndex, questions, showIntro, isGameOver, loading, speak]);

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
                    <h1 className="text-4xl font-black italic tracking-tighter sm:text-6xl">MODO RELÂMPAGO</h1>
                    <p className="mt-6 text-lg text-slate-400">
                        Responda o máximo que conseguir. <br />
                        <span className="font-bold text-yellow-400">1 minuto</span> por questão. <br />
                        Errou uma? <span className="text-red-400">Game Over.</span>
                    </p>

                    <div className="mt-12 flex flex-col gap-4">
                        <button
                            onClick={startSession}
                            className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-white px-8 py-5 text-xl font-black uppercase tracking-widest text-slate-900 transition hover:scale-105 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-yellow-400 opacity-0 transition group-hover:opacity-10" />
                            INICIAR AGORA
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
                    <p className="mt-2 text-slate-400">O tempo acabou ou você errou.</p>

                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-white/5 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Acertos</p>
                            <p className="text-4xl font-black text-yellow-400">{score}</p>
                        </div>
                        <div className="rounded-2xl bg-white/5 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Recorde</p>
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
        <div className="flex min-h-[100dvh] flex-col bg-[#0f172a] text-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-slate-900">
                        <Zap className="h-6 w-6" fill="currentColor" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Combo</p>
                        <p className="text-xl font-black leading-none">{score}</p>
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
            <div className="flex flex-1 flex-col justify-center px-6 py-12">
                <div className="mx-auto w-full max-w-2xl">
                    <AnimatePresence mode="wait">
                        {!currentQ ? (
                            <div key="loading" className="text-center">
                                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
                                <p className="mt-4 font-bold text-slate-400">Carregando desafios...</p>
                            </div>
                        ) : (
                            <motion.div
                                key={currentQ.id}
                                initial={{ x: 30, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -30, opacity: 0 }}
                                className="space-y-8"
                            >
                                <div className="space-y-4">
                                    <div className="inline-flex items-center gap-2 rounded-lg bg-yellow-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-yellow-400">
                                        <Volume2 className="h-3 w-3" />
                                        Ouvindo questão...
                                    </div>
                                    <h2 className="text-2xl font-black leading-tight sm:text-4xl">
                                        {currentQ.content}
                                    </h2>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    {currentQ.alternatives.map((alt: any, idx: number) => (
                                        <button
                                            key={alt.id}
                                            onClick={() => handleAnswer(alt.id)}
                                            className="group flex items-start gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-yellow-400/50 hover:bg-white/10 active:scale-[0.98]"
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
            <div className="h-1.5 w-full bg-slate-800">
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
