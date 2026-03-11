import { ShieldCheck, Zap, ArrowRight, UserPlus, LogIn, Sparkles, BookOpen, Target, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

export default function Welcome() {
    const [isStandalone, setIsStandalone] = useState(false);
    const [showInstallHelp, setShowInstallHelp] = useState(false);

    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
            setIsStandalone(true);
        }
    }, []);

    const handleInstallClick = async () => {
        const promptEvent = (window as any).deferredPrompt;
        if (promptEvent) {
            promptEvent.prompt();
            const { outcome } = await promptEvent.userChoice;
            if (outcome === 'accepted') {
                (window as any).deferredPrompt = null;
            }
        } else {
            setShowInstallHelp(true);
        }
    };

    return (
        <div className="min-h-screen bg-minsa-gradient flex flex-col items-center justify-center p-4 text-white overflow-hidden relative">
            {/* Elementos corporativos de fundo sem luz estourada */}

            <main className="max-w-4xl w-full z-10 space-y-12">
                <header className="text-center space-y-6">
                    {!isStandalone && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="flex flex-col items-center gap-2 mb-8"
                        >
                            <button
                                onClick={handleInstallClick}
                                className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-xs font-black text-slate-900 transition-all hover:bg-slate-100 uppercase tracking-widest shadow-xl"
                            >
                                <Download className="h-4 w-4" />
                                Baixar App (PWA)
                            </button>
                            {showInstallHelp && (
                                <div className="mt-2 max-w-xs rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[10px] text-emerald-100 text-left animate-in fade-in duration-300">
                                    <p className="font-bold mb-1 uppercase tracking-tight text-center">Como instalar:</p>
                                    <p className="mb-1"><strong>iOS:</strong> Compartilhar &gt; Adicionar à Tela de Início.</p>
                                    <p><strong>Android:</strong> Menu (...) &gt; Instalar aplicativo.</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-200 border border-white/10"
                    >
                        <Sparkles className="h-4 w-4" />
                        O Futuro da Preparação Profissional
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="flex justify-center"
                    >
                        <div className="h-24 w-64 bg-white/90 backdrop-blur-xl rounded-[2.5rem] p-4 shadow-2xl border border-white/20">
                            <img
                                src="https://res.cloudinary.com/dzvusz0u4/image/upload/v1773051625/abj60fbildawqtq47qgu.png"
                                alt="MINSA Prep Logo"
                                className="h-full w-full object-contain"
                            />
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="text-4xl md:text-6xl font-black tracking-tighter"
                    >
                        A Evolução do Estudo <br /><span className="text-emerald-400">em Angola</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed"
                    >
                        A plataforma N.º 1 para todos os profissionais de saúde e afins. Aprenda, treine, teste habilidades e conquiste a sua vaga.
                    </motion.p>
                </header>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.8 }}
                        className="w-full sm:w-auto"
                    >
                        <Link
                            to="/register"
                            className="group flex w-full items-center justify-center gap-3 rounded-[2rem] bg-emerald-500 px-8 py-5 text-lg font-black uppercase tracking-tight text-white shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 transition-all hover:scale-[1.02]"
                        >
                            <UserPlus className="h-6 w-6" />
                            Criar conta
                            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.8 }}
                        className="w-full sm:w-auto"
                    >
                        <Link
                            to="/login"
                            className="flex w-full items-center justify-center gap-3 rounded-[2rem] border-2 border-white/20 bg-white/5 backdrop-blur-md px-8 py-5 text-lg font-black uppercase tracking-tight text-white hover:bg-white/10 transition-all"
                        >
                            <LogIn className="h-6 w-6" />
                            Já tenho conta
                        </Link>
                    </motion.div>
                </div>

                <section className="grid md:grid-cols-4 gap-4">
                    {[
                        { icon: BookOpen, title: "Aprender e Rever", desc: "Consolide conceitos fundamentais da saúde." },
                        { icon: Zap, title: "Treino e Lazer", desc: "Pratique de forma dinâmica e descontraída." },
                        { icon: Target, title: "Testar Habilidades", desc: "Avalie seu nível técnico com precisão." },
                        { icon: ShieldCheck, title: "Foco no Concurso", desc: "Simulados 100% fiéis aos editais MINSA." }
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 1.0 + (i * 0.1) }}
                            className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 transition-colors group"
                        >
                            <item.icon className="h-8 w-8 text-emerald-400 mb-4 group-hover:scale-110 transition-transform" />
                            <h3 className="text-base font-bold mb-2">{item.title}</h3>
                            <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                        </motion.div>
                    ))}
                </section>

                <div className="flex flex-col items-center gap-4">
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 1.5 }}
                        className="text-center text-xs text-slate-500 font-medium uppercase tracking-[0.2em]"
                    >
                        Junta-te a +5.000 profissionais em Angola
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.6 }}
                        transition={{ duration: 1, delay: 1.8 }}
                        className="inline-flex items-center gap-2 rounded-lg bg-teal-500/5 px-3 py-1.5 border border-teal-500/10 cursor-default grayscale hover:grayscale-0 transition-all mt-4"
                        title="FarmoGentileza - Fazemos Gentileza Na Saúde"
                    >
                        <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest text-center">
                            Uma iniciativa FarmoGentileza 🇦🇴<br />
                            <span className="text-[8px] opacity-80 font-normal">"Fazemos Gentileza Na Saúde"</span>
                        </span>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
