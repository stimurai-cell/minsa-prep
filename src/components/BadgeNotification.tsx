import { motion, AnimatePresence } from 'motion/react';
import { Award, Star, X } from 'lucide-react';
import { Badge } from '../lib/badges';

interface BadgeNotificationProps {
    badge: Badge | null;
    onClose: () => void;
}

export default function BadgeNotification({ badge, onClose }: BadgeNotificationProps) {
    if (!badge) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-6 overflow-hidden">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.8, opacity: 0, y: 20 }}
                    className="relative w-full max-w-sm rounded-[2.5rem] bg-white p-8 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] border-4 border-amber-100"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <motion.div
                        initial={{ rotate: -15, scale: 0.5 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: 'spring', damping: 12, stiffness: 120, delay: 0.2 }}
                        className="mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-[linear-gradient(135deg,#fef3c7_0%,#fde68a_100%)] text-amber-600 shadow-[0_20px_50px_-12px_rgba(245,158,11,0.3)] border-4 border-white"
                    >
                        <Award className="h-16 w-16" />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-amber-700 mb-4 border border-amber-200">
                            <Star className="w-4 h-4 fill-current" />
                            Nova Medalha Conquistada!
                        </div>

                        <h2 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">{badge.name}</h2>

                        <p className="text-slate-600 font-medium mb-8 leading-relaxed px-2">
                            {badge.description}
                        </p>

                        <button
                            onClick={onClose}
                            className="w-full bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] hover:bg-slate-800 text-white font-black py-5 rounded-[1.8rem] shadow-[0_10px_25px_-5px_rgba(15,23,42,0.4)] transition-all hover:-translate-y-0.5 active:scale-95 uppercase tracking-widest text-sm"
                        >
                            Incrível!
                        </button>
                    </motion.div>

                    {/* Decorative rays/glows */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] -z-10 bg-[radial-gradient(circle,rgba(245,158,11,0.15)_0%,transparent_70%)] opacity-50 blur-2xl"></div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
