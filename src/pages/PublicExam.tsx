import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Building2,
    Calendar,
    Clock,
    FileText,
    Gavel,
    ShieldAlert,
    Star,
    Timer,
    ArrowRight,
    TrendingUp,
    Award
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export default function PublicExam() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [contestStats, setContestStats] = useState({
        completedSims: 0,
        avgScore: 0,
        questionsCount: 0
    });

    // Simulando data do edital (Espaço Genérico)
    const editalStatus = {
        title: "Próximo Concurso MINSA",
        subtitle: "Aguardando publicação oficial do edital 2026",
        status: "Em preparação",
        color: "bg-amber-100 text-amber-700 border-amber-200"
    };

    useEffect(() => {
        // Simular carregamento de estatísticas específicas de concurso
        setLoading(false);
    }, []);

    const specialExams = [
        {
            id: 'legis_geral',
            title: "Legislação Geral da Saúde",
            description: "Leis e regulamentos básicos do sistema nacional de saúde.",
            icon: <Gavel className="w-6 h-6" />,
            questions: 40,
            time: "60 min",
            color: "sky"
        },
        {
            id: 'etica_deon',
            title: "Ética e Deontologia Professional",
            description: "Código de ética para profissionais de saúde em Angola.",
            icon: <ShieldAlert className="w-6 h-6" />,
            questions: 30,
            time: "45 min",
            color: "emerald"
        },
        {
            id: 'simulado_geral',
            title: "Simulado Geral Concurso",
            description: "Mistura de especialidade + legislação (Edital base).",
            icon: <FileText className="w-6 h-6" />,
            questions: 50,
            time: "90 min",
            color: "violet",
            isHot: true
        }
    ];

    if (loading) {
        return <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest animate-pulse">Carregando Módulo...</div>;
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6 pb-20 p-4 md:p-8 animate-in fade-in duration-500">
            {/* Header Especial */}
            <div className="rounded-[2.5rem] bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300 mb-4 border border-emerald-500/30">
                        <Award className="w-3.5 h-3.5" />
                        Módulo Especializado
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
                        Concurso Público <br />
                        <span className="text-emerald-400">MINSA 2026</span>
                    </h1>
                    <p className="mt-4 text-slate-300 max-w-xl text-sm font-medium leading-relaxed">
                        Prepare-se com foco total no edital oficial. Simulados cronometrados,
                        legislação atualizada e estatísticas de aprovação.
                    </p>
                </div>

                {/* Efeito visual de fundo */}
                <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-[100px]"></div>
                <Building2 className="absolute right-8 bottom-8 w-32 h-32 text-white/5" />
            </div>

            {/* Espaço Genérico do Edital */}
            <div className={`rounded-3xl border-2 p-6 flex flex-col md:flex-row items-center justify-between gap-4 ${editalStatus.color}`}>
                <div className="flex items-center gap-4 text-center md:text-left">
                    <div className="p-3 bg-white/50 rounded-2xl">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-black text-lg">{editalStatus.title}</h2>
                        <p className="text-xs font-bold uppercase tracking-widest opacity-80">{editalStatus.subtitle}</p>
                    </div>
                </div>
                <div className="px-6 py-2 bg-white rounded-full font-black text-xs uppercase tracking-widest shadow-sm">
                    {editalStatus.status}
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_0.6fr]">
                {/* Sessão de Simulados */}
                <div className="space-y-6">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Timer className="w-6 h-6 text-sky-500" />
                        Simulados Específicos
                    </h3>

                    <div className="space-y-4">
                        {specialExams.map((exam) => (
                            <div
                                key={exam.id}
                                className="group relative bg-white rounded-[2rem] border-2 border-slate-100 p-6 hover:border-emerald-500 transition-all hover:shadow-xl hover:shadow-emerald-500/5 cursor-pointer"
                                onClick={() => navigate(`/simulation?session=1&type=${exam.id}`)}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white bg-${exam.color}-500 shadow-lg shadow-${exam.color}-500/20`}>
                                        {exam.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-black text-slate-800">{exam.title}</h4>
                                            {exam.isHot && (
                                                <span className="bg-rose-100 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                    Popular
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium line-clamp-1">{exam.description}</p>
                                        <div className="flex items-center gap-4 mt-3">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                                <FileText className="w-3 h-3" />
                                                {exam.questions} Questões
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                                <Clock className="w-3 h-3" />
                                                {exam.time}
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-6 h-6 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar com Dicas e Leis */}
                <div className="space-y-6">
                    <div className="bg-sky-50 rounded-[2rem] border-2 border-sky-100 p-6">
                        <h3 className="text-sm font-black text-sky-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Dica de Candidato
                        </h3>
                        <p className="text-sm text-sky-900 leading-relaxed font-medium italic">
                            "Domine a Lei nº 21/92 (Lei do Sistema Nacional de Saúde). Ela representa cerca de 15% das questões de legislação nos concursos anteriores."
                        </p>
                    </div>

                    <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-6">
                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Biblioteca de Leis</h3>
                        <div className="space-y-3">
                            {["Estatuto da Carreira de Enfermagem", "Lei Geral do Trabalho (Resumo)", "Normas Éticas do MINSA"].map((lei, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors cursor-not-allowed opacity-60">
                                    <span className="text-xs font-bold text-slate-600 truncate mr-2">{lei}</span>
                                    <Link to="#" className="text-sky-500 font-black text-[10px] uppercase">PDF</Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Aviso Premium */}
            {profile?.role !== 'premium' && profile?.role !== 'elite' && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-[2rem] p-8 text-center space-y-4">
                    <Star className="w-12 h-12 text-amber-500 mx-auto fill-amber-500" />
                    <h2 className="text-2xl font-black text-slate-800">Desbloqueie o Sucesso</h2>
                    <p className="text-slate-600 text-sm font-medium">
                        O Módulo de Concurso Público completo (simulados ilimitados, ranking nacional e revisão por lei)
                        é exclusivo para membros Premium.
                    </p>
                    <button
                        onClick={() => navigate('/premium')}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-black px-8 py-4 rounded-2xl shadow-[0_4px_0_0_#d97706] active:shadow-none active:translate-y-1 transition-all uppercase tracking-widest text-sm"
                    >
                        Quero ser Premium
                    </button>
                </div>
            )}
        </div>
    );
}
