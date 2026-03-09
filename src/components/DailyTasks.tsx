import React, { useEffect, useState } from 'react';
import { Trophy, CheckCircle2, Circle, Star, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDailyTasksProgress, DailyTaskProgress } from '../lib/dailyTasks';
import { useAuthStore } from '../store/useAuthStore';

export default function DailyTasks() {
    const { profile } = useAuthStore();
    const [tasks, setTasks] = useState<DailyTaskProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCelebration, setShowCelebration] = useState(false);

    const fetchTasks = async () => {
        if (!profile?.id) return;
        const progress = await getDailyTasksProgress(profile.id);
        setTasks(progress);
        setLoading(false);
    };

    useEffect(() => {
        fetchTasks();
        // Refresh tasks every minute to catch background updates if any
        const interval = setInterval(fetchTasks, 60000);
        return () => clearInterval(interval);
    }, [profile?.id]);

    const completedCount = tasks.filter(t => t.completed).length;
    const allCompleted = tasks.length > 0 && completedCount === tasks.length;

    if (loading && tasks.length === 0) return null;

    return (
        <div className="bg-white rounded-[2rem] border-2 border-slate-100 p-6 shadow-xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-yellow-500" />
                        Missões do Dia
                    </h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {completedCount} de {tasks.length} Concluídas
                    </p>
                </div>
                {allCompleted && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="bg-yellow-400 text-white p-2 rounded-xl shadow-lg shadow-yellow-400/30"
                    >
                        <Star className="w-5 h-5 fill-current" />
                    </motion.div>
                )}
            </div>

            <div className="space-y-4">
                {tasks.map((task, idx) => (
                    <div key={task.id} className="relative">
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-bold ${task.completed ? 'text-emerald-600' : 'text-slate-700'}`}>
                                {task.label}
                            </span>
                            <span className="text-xs font-black text-slate-400">
                                {task.current} / {task.target}
                            </span>
                        </div>
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (task.current / task.target) * 100)}%` }}
                                className={`h-full rounded-full ${task.completed
                                        ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                                        : 'bg-gradient-to-r from-indigo-400 to-indigo-500'
                                    }`}
                            />
                        </div>
                        {task.completed && (
                            <motion.div
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="absolute -right-1 -top-1"
                            >
                                <div className="bg-emerald-100 text-emerald-600 p-1 rounded-full border-2 border-white shadow-sm">
                                    <CheckCircle2 className="w-3 h-3" />
                                </div>
                            </motion.div>
                        )}
                    </div>
                ))}
            </div>

            {allCompleted && (
                <div className="mt-6 pt-5 border-t border-slate-50 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                        <Zap className="w-6 h-6 fill-current" />
                    </div>
                    <div>
                        <p className="text-xs font-black text-orange-600 uppercase tracking-wider">Bônus Ativo</p>
                        <p className="text-sm font-bold text-slate-600">Você completou tudo hoje! +10 XP Bônus</p>
                    </div>
                </div>
            )}

            {/* Decorative background circle */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-slate-50 rounded-full group-hover:bg-indigo-50/50 transition-colors -z-0" />
        </div>
    );
}
