import { Link } from 'react-router-dom';
import { BookOpen, Compass, Swords, Zap, ArrowRight, Play } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { usePermissions } from '../lib/permissions';

export default function Practice() {
    const { profile } = useAuthStore();
    const { hasGuidedTraining, hasBattleMode } = usePermissions();
    const isFreeUser = profile?.role === 'free';
    const trainingUsesAutomaticTopic = hasGuidedTraining || isFreeUser;

    const practiceModes = [
        {
            id: 'training',
            title: hasGuidedTraining ? 'Treino Guiado' : isFreeUser ? 'Treino Diario' : 'Treino Livre',
            description: hasGuidedTraining
                ? 'Abra o foco automatico reservado ao plano Elite.'
                : isFreeUser
                    ? 'Receba um topico predefinido que vai rodando entre os temas.'
                    : 'Escolha o topico manualmente e comece o treino.',
            icon: BookOpen,
            color: 'emerald',
            path: trainingUsesAutomaticTopic ? '/training' : '/training?mode=manual',
            xp: '+10 XP',
        },
        {
            id: 'speed',
            title: 'Modo Relampago',
            description: 'Responda rapido contra o tempo.',
            icon: Zap,
            color: 'yellow',
            path: '/speed-mode',
            xp: '+25 XP',
        },
        {
            id: 'battle',
            title: 'Batalha',
            description: hasBattleMode
                ? 'Desafie seus amigos e ganhe XP.'
                : 'Desafios em tempo real, exclusivos para Elite.',
            icon: Swords,
            color: 'rose',
            path: '/battle',
            xp: '+50 XP',
        },
        {
            id: 'simulation',
            title: 'Simulado de Prova',
            description: 'Teste real com nota e tempo limite.',
            icon: Compass,
            color: 'blue',
            path: '/simulation',
            xp: '+100 XP',
        },
    ];

    return (
        <div className="mx-auto max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8 flex items-center gap-6 rounded-[2rem] border-2 border-emerald-100 bg-white p-6 shadow-sm">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Play className="ml-1 h-10 w-10 fill-current" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800">
                        {profile?.goal ? `Vamos rumo a sua meta: ${profile.goal}!` : 'Escolha como quer praticar hoje!'}
                    </h1>
                    <p className="mt-1 font-medium text-slate-500">
                        Ganhe XP e mantenha a sua ofensiva diaria.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {practiceModes.map((mode) => {
                    const Icon = mode.icon;
                    const bgColors = {
                        emerald: 'bg-emerald-500 border-emerald-600 shadow-[0_4px_0_0_#047857]',
                        yellow: 'bg-yellow-400 border-yellow-500 shadow-[0_4px_0_0_#eab308] text-slate-900',
                        rose: 'bg-rose-500 border-rose-600 shadow-[0_4px_0_0_#e11d48]',
                        blue: 'bg-blue-500 border-blue-600 shadow-[0_4px_0_0_#2563eb]',
                    };

                    return (
                        <Link
                            key={mode.id}
                            to={mode.path}
                            className={`relative overflow-hidden rounded-[2rem] border-2 p-6 transition-transform active:translate-y-1 active:shadow-none hover:-translate-y-1 ${mode.color === 'emerald' ? 'border-emerald-200 bg-emerald-50 shadow-[0_4px_0_0_#a7f3d0] hover:bg-emerald-100' :
                                    mode.color === 'yellow' ? 'border-yellow-200 bg-yellow-50 shadow-[0_4px_0_0_#fde047] hover:bg-yellow-100' :
                                        mode.color === 'rose' ? 'border-rose-200 bg-rose-50 shadow-[0_4px_0_0_#fecdd3] hover:bg-rose-100' :
                                            'border-blue-200 bg-blue-50 shadow-[0_4px_0_0_#bfdbfe] hover:bg-blue-100'
                                }`}
                        >
                            <div className="mb-4 flex items-start justify-between">
                                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white ${bgColors[mode.color as keyof typeof bgColors]}`}>
                                    <Icon className="h-7 w-7" />
                                </div>
                                <div className="rounded-full bg-white/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-700">
                                    {mode.xp}
                                </div>
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">{mode.title}</h2>
                            <p className="mt-1 text-sm font-medium text-slate-600">{mode.description}</p>
                            <div className="mt-6 flex items-center gap-1 text-sm font-bold text-slate-800 opacity-60">
                                Comecar <ArrowRight className="h-4 w-4" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
