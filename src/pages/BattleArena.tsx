import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Swords, Trophy, Timer, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { filterPlayableQuestions, stripAlternativePrefix } from '../lib/quiz';
import { motion, AnimatePresence } from 'motion/react';

export default function BattleArena() {
    const { matchId } = useParams();
    const { profile } = useAuthStore();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [match, setMatch] = useState<any>(null);
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [opponentProgress, setOpponentProgress] = useState(0);
    const [hasSyncedFinish, setHasSyncedFinish] = useState(false);
    const pollRef = useRef<NodeJS.Timeout | null>(null);

    const seededShuffle = <T,>(items: T[], seed: string) => {
        // Mulberry32 PRNG for reproducible ordem
        const hashSeed = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) || 1;
        let t = hashSeed;
        const random = () => {
            t += 0x6D2B79F5;
            let r = Math.imul(t ^ (t >>> 15), 1 | t);
            r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
            return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
        };

        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };

    const buildQuestionSet = (qs: any[], seed: string) => seededShuffle(qs, seed).map((q, idx) => ({
        ...q,
        alternatives: seededShuffle(q.alternatives || [], `${seed}-${idx}`).map((alternative: any) => ({
            ...alternative,
            content: stripAlternativePrefix(alternative.content || '')
        }))
    }));

    useEffect(() => {
        const fetchMatchAndQuestions = async () => {
            if (!matchId || !profile?.id) return;

            const { data: matchData } = await supabase
                .from('battle_matches')
                .select('*, challenger:challenger_id(full_name), opponent:opponent_id(full_name)')
                .eq('id', matchId)
                .single();

            const isParticipant = matchData && (matchData.challenger_id === profile.id || matchData.opponent_id === profile.id);

            if (!matchData || !isParticipant || matchData.status !== 'active') {
                navigate('/battle');
                return;
            }

            setMatch(matchData);
            const isChallenger = profile.id === matchData.challenger_id;
            setOpponentProgress(isChallenger ? matchData.opponent_score : matchData.challenger_score);

            // Fetch 10 questions for the battle
            const topicId = (await supabase.from('topics').select('id').eq('area_id', matchData.area_id).limit(1).single()).data?.id;

            const { data: qs } = await supabase
                .from('questions')
                .select('*, alternatives(*)')
                .eq('topic_id', topicId || '')
                .order('created_at', { ascending: true })
                .limit(10);

            if (qs) {
                const valid = filterPlayableQuestions(qs || []);
                setQuestions(buildQuestionSet(valid, matchData.id));
            }
            setLoading(false);
        };

        fetchMatchAndQuestions();

        // Realtime for opponent progress
        const channel = supabase
            .channel(`battle:${matchId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battle_matches', filter: `id=eq.${matchId}` }, (payload) => {
                const isChallenger = profile?.id === payload.new.challenger_id;
                setMatch(payload.new);
                setOpponentProgress(isChallenger ? payload.new.opponent_score : payload.new.challenger_score);

                if (payload.new.status === 'completed') {
                    setIsFinished(true);
                    setScore(isChallenger ? payload.new.challenger_score : payload.new.opponent_score);
                }
            })
            .subscribe();

        // Polling de segurança (0.4s) para reduzir latência percebida
        pollRef.current = setInterval(fetchMatchAndQuestions, 400);

        return () => {
            supabase.removeChannel(channel);
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [matchId, profile?.id]);

    const handleAnswer = async (isCorrect: boolean) => {
        const newScore = isCorrect ? score + 1 : score;
        setScore(newScore);

        // Update score in real-time
        const isChallenger = profile?.id === match.challenger_id;
        await supabase
            .from('battle_matches')
            .update({
                [isChallenger ? 'challenger_score' : 'opponent_score']: newScore
            })
            .eq('id', matchId);

        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setIsFinished(true);
            // Finish match logic here
        }
    };

    const finalizeMatch = async (finalScore: number) => {
        if (!match || hasSyncedFinish) return;

        setHasSyncedFinish(true);
        const isChallenger = profile?.id === match.challenger_id;
        const { data: fresh } = await supabase
            .from('battle_matches')
            .select('challenger_score, opponent_score, challenger_id, opponent_id')
            .eq('id', matchId)
            .single();

        const challengerScore = isChallenger ? finalScore : (fresh?.challenger_score ?? match.challenger_score ?? 0);
        const opponentScoreFinal = isChallenger ? (fresh?.opponent_score ?? opponentProgress) : finalScore;

        // Critério: quem acertou mais; em empate, declarar empate (winner_id null)
        const winnerId =
            challengerScore === opponentScoreFinal
                ? null
                : challengerScore > opponentScoreFinal
                    ? match.challenger_id
                    : match.opponent_id;

        await supabase
            .from('battle_matches')
            .update({
                status: 'completed',
                challenger_score: challengerScore,
                opponent_score: opponentScoreFinal,
                winner_id: winnerId,
                completed_at: new Date().toISOString()
            })
            .eq('id', matchId);
    };

    useEffect(() => {
        if (isFinished) {
            finalizeMatch(score);
        }
    }, [isFinished, score, match]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white"><Loader2 className="animate-spin w-8 h-8" /></div>;

    if (isFinished) {
        return (
            <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
                <Trophy className="w-20 h-20 text-amber-500 mb-6" />
                <h1 className="text-4xl font-black mb-2">Batalha Finalizada!</h1>
                <p className="text-slate-400 mb-8">
                    Resultado: {match?.winner_id
                        ? (match?.winner_id === profile?.id ? 'Você venceu!' : 'Seu oponente venceu.')
                        : 'Empate (mesma pontuação).'}
                </p>
                <div className="bg-white/10 p-6 rounded-3xl backdrop-blur-md border border-white/20 w-full max-w-sm mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-bold">Sua Pontuação</span>
                        <span className="text-2xl font-black">{score} / {questions.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-bold">Oponente</span>
                        <span className="text-2xl font-black text-fuchsia-300">{opponentProgress} / {questions.length}</span>
                    </div>
                </div>
                <button onClick={() => navigate('/battle')} className="bg-indigo-600 hover:bg-indigo-700 px-8 py-3 rounded-xl font-black">Voltar ao Menu</button>
            </div>
        );
    }

    const currentQ = questions[currentIndex];

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6 md:p-12">
            <div className="max-w-3xl mx-auto flex flex-col h-full">
                <div className="flex justify-between items-center mb-12">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                            <Swords className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="font-black text-xl">Batalha XP</h2>
                            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-widest">{currentIndex + 1} de {questions.length} questões</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-slate-500">Oponente</p>
                            <p className="text-xl font-black text-fuchsia-400">{opponentProgress} pts</p>
                        </div>
                        <div className="h-10 w-[1px] bg-white/10"></div>
                        <div className="text-right">
                            <p className="text-[10px] font-black uppercase text-slate-500">Você</p>
                            <p className="text-xl font-black text-emerald-400">{score} pts</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                    <h1 className="text-2xl md:text-3xl font-black mb-10 leading-snug">
                        {currentQ.content}
                    </h1>

                    <div className="grid gap-4">
                        {currentQ.alternatives.map((alt: any, idx: number) => (
                            <button
                                key={alt.id}
                                onClick={() => handleAnswer(alt.is_correct)}
                                className="group relative w-full text-left p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 hover:border-indigo-500/50 transition-all active:scale-[0.98]"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-sm font-black group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                                        {['A', 'B', 'C', 'D'][idx]}
                                    </div>
                                    <span className="font-medium text-lg text-slate-200">{alt.content}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
