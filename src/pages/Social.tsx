import { useState } from 'react';
import { UserPlus, Search, Flame, ShieldAlert, Award } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

// Mock data to demonstrate the UI until the DB logic is fully integrated
const MOCK_FRIENDS = [
    { id: '1', name: 'Joey', avatar: 'J', xp: 479, streak: 12, atRisk: true },
    { id: '2', name: 'Mauro Alexandre', avatar: 'M', xp: 85, streak: 3, atRisk: true },
    { id: '3', name: 'Finesa Maria', avatar: 'F', xp: 1250, streak: 45, atRisk: false },
    { id: '4', name: 'Alfredo Bumba', avatar: 'A', xp: 320, streak: 5, atRisk: false },
];

export default function Social() {
    const { profile } = useAuthStore();
    const [activeTab, setActiveTab] = useState<'friends' | 'feed'>('friends');

    const atRiskFriends = MOCK_FRIENDS.filter(f => f.atRisk);
    const otherFriends = MOCK_FRIENDS.filter(f => !f.atRisk).sort((a, b) => b.xp - a.xp);

    return (
        <div className="mx-auto max-w-2xl pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md pt-4 pb-4 border-b-2 border-slate-100 flex gap-4 -mx-4 px-4 mb-6">
                <button
                    onClick={() => setActiveTab('friends')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-2xl transition-colors ${activeTab === 'friends'
                        ? 'bg-blue-100 text-blue-600 border-2 border-blue-200 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-50'
                        }`}
                >
                    Amigos
                </button>
                <button
                    onClick={() => setActiveTab('feed')}
                    className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider rounded-2xl transition-colors ${activeTab === 'feed'
                        ? 'bg-blue-100 text-blue-600 border-2 border-blue-200 shadow-sm'
                        : 'text-slate-400 hover:bg-slate-50'
                        }`}
                >
                    Novidades
                </button>
            </div>

            {activeTab === 'friends' && (
                <div className="space-y-8">
                    {/* Add Friend Button / Invite System */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-[2rem] p-6 shadow-sm mb-6">
                        <h2 className="text-xl font-black text-slate-800 mb-2">Traga os seus amigos!</h2>
                        <p className="text-sm text-slate-600 font-medium mb-6">
                            Estudar em grupo aumenta as suas chances de aprovação. Convide os seus colegas para o MINSA Prep e acompanhem a evolução uns dos outros.
                        </p>
                        <button
                            onClick={() => {
                                const message = encodeURIComponent("Vem treinar comigo no MINSA Prep! A melhor plataforma para nos prepararmos para o Concurso Público da Saúde. 🚀\nCria a tua conta em: " + window.location.origin);
                                window.open(`https://wa.me/?text=${message}`, '_blank');
                            }}
                            className="w-full flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#128C7E] text-white p-4 rounded-2xl font-bold shadow-[0_4px_0_0_#128c7e] active:shadow-none active:translate-y-1 transition-all"
                        >
                            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                            Convidar via WhatsApp
                        </button>
                    </div>

                    <button className="w-full flex items-center justify-between p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <Search className="w-6 h-6" />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-slate-800">Procurar pelo nome</p>
                                <p className="text-sm font-medium text-slate-500">Adicione alguém que já usa o app</p>
                            </div>
                        </div>
                    </button>

                    {/* At Risk Section */}
                    {atRiskFriends.length > 0 && (
                        <div className="bg-orange-50 border-2 border-orange-200 rounded-[2rem] p-6 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <ShieldAlert className="w-7 h-7 text-orange-500" />
                                <h2 className="text-xl font-extrabold text-orange-600">Ofensivas em risco!</h2>
                            </div>

                            <div className="space-y-4">
                                {atRiskFriends.map(friend => (
                                    <div key={friend.id} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-orange-100">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full border-2 border-slate-200 bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-lg">
                                                {friend.avatar}
                                            </div>
                                            <span className="font-bold text-slate-800 text-lg">{friend.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-orange-500 font-bold bg-orange-100 px-3 py-1.5 rounded-xl">
                                            <Flame className="w-5 h-5 fill-current" />
                                            <span>{friend.xp}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button className="mt-6 w-full py-3.5 bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-2xl shadow-[0_4px_0_0_#2563eb] active:translate-y-1 active:shadow-none transition-all">
                                👋 DAR OI PARA INCENTIVAR
                            </button>
                        </div>
                    )}

                    {/* Other Friends Ranking */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-700 mb-4 px-2">Outros amigos</h3>
                        <div className="space-y-3">
                            {otherFriends.map((friend, idx) => (
                                <div key={friend.id} className="flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-slate-200 transition-colors bg-white">
                                    <div className="flex items-center gap-4">
                                        <span className="text-base font-bold text-slate-400 w-4 text-center">{idx + 1}</span>
                                        <div className="w-12 h-12 rounded-full border-2 border-slate-200 bg-slate-50 flex items-center justify-center font-bold text-slate-600 text-lg">
                                            {friend.avatar}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-lg">{friend.name}</p>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{friend.xp} XP</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'feed' && (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                        <Award className="w-12 h-12 text-slate-300" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-700 mb-2">Feed de Conquistas</h2>
                    <p className="text-slate-500 font-medium">
                        Siga mais amigos para ver as vitórias e avanços deles aqui no seu feed!
                    </p>
                    <button
                        onClick={() => setActiveTab('friends')}
                        className="mt-8 px-6 py-3 bg-slate-900 text-white font-bold rounded-2xl shadow-[0_4px_0_0_#334155] active:translate-y-1 active:shadow-none transition-all"
                    >
                        Adicionar amigos
                    </button>
                </div>
            )}

        </div>
    );
}
