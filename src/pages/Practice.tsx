import { Link } from 'react-router-dom';
import { BookOpen, Compass, Swords, Zap, ArrowRight, Play } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

const PRACTICE_MODES = [
    {
        id: 'training',
        title: 'Treino Diário',
        description: 'Pratique tópicos específicos ao seu ritmo.',
        icon: BookOpen,
        color: 'emerald',
        path: '/training',
        xp: '+10 XP',
    },
    {
        id: 'speed',
        title: 'Modo Relâmpago',
        description: 'Responda rápido contra o tempo.',
        icon: Zap,
        color: 'yellow',
        path: '/speed-mode',
        xp: '+25 XP',
    },
    {
        id: 'battle',
        title: 'Batalha',
        description: 'Desafie seus amigos e ganhe XP.',
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

export default function Practice() {
    const { profile } = useAuthStore();

    return (
        <div className="mx-auto max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mb-8 p-6 bg-white border-2 border-emerald-100 rounded-[2rem] shadow-sm flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <Play className="w-10 h-10 fill-current ml-1" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-slate-800">
                        {profile?.goal ? `Vamos rumo à sua meta: ${profile.goal}!` : 'Escolha como quer praticar hoje!'}
                    </h1>
                    <p className="font-medium text-slate-500 mt-1">
                        Ganhe XP e mantenha a sua ofensiva diária.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PRACTICE_MODES.map((mode) => {
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
                            className={`relative overflow-hidden rounded-[2rem] border-2 p-6 transition-transform active:translate-y-1 active:shadow-none hover:-translate-y-1 ${mode.color === 'emerald' ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 shadow-[0_4px_0_0_#a7f3d0]' :
                                    mode.color === 'yellow' ? 'bg-yellow-50 hover:bg-yellow-100 border-yellow-200 shadow-[0_4px_0_0_#fde047]' :
                                        mode.color === 'rose' ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 shadow-[0_4px_0_0_#fecdd3]' :
                                            'bg-blue-50 hover:bg-blue-100 border-blue-200 shadow-[0_4px_0_0_#bfdbfe]'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className={`flex w-14 h-14 items-center justify-center rounded-2xl text-white ${bgColors[mode.color as keyof typeof bgColors]}`}>
                                    <Icon className="h-7 w-7" />
                                </div>
                                <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/60 text-slate-700">
                                    {mode.xp}
                                </div>
                            </div>
                            <h2 className="text-xl font-bold text-slate-800">{mode.title}</h2>
                            <p className="mt-1 text-sm font-medium text-slate-600">{mode.description}</p>
                            <div className="mt-6 flex items-center text-sm font-bold text-slate-800 gap-1 opacity-60">
                                Começar <ArrowRight className="w-4 h-4" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
