import {
  ArrowRight,
  BookOpen,
  Download,
  LogIn,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import AppLogo from '../components/AppLogo';
import { PRODUCT_CONTEXT } from '../lib/productContext';

const featureCards = [
  {
    icon: BookOpen,
    title: 'Aprender e Rever',
    desc: 'Estude a sua area com clareza, ritmo e revisao inteligente.',
  },
  {
    icon: Zap,
    title: 'Treino Leve',
    desc: 'Pratique de forma dinamica, descontraida e constante.',
  },
  {
    icon: Target,
    title: 'Medir Evolucao',
    desc: 'Teste o seu nivel e acompanhe o progresso real.',
  },
  {
    icon: ShieldCheck,
    title: 'Foco Atual',
    desc: 'Preparacao reforcada para o Concurso Publico da Saude.',
  },
] as const;

export default function Welcome() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-minsa-gradient p-4 text-white">
      <main className="z-10 w-full max-w-4xl space-y-12">
        <header className="space-y-6 text-center">
          {!isStandalone && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-8 flex flex-col items-center gap-2"
            >
              <button
                onClick={handleInstallClick}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-900 shadow-xl transition-all hover:bg-slate-100"
              >
                <Download className="h-4 w-4" />
                Baixar App (PWA)
              </button>
              {showInstallHelp && (
                <div className="mt-2 max-w-xs animate-in rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-left text-[10px] text-emerald-100 duration-300">
                  <p className="mb-1 text-center font-bold uppercase tracking-tight">Como instalar:</p>
                  <p className="mb-1">
                    <strong>iOS:</strong> Compartilhar &gt; Adicionar a Tela de Inicio.
                  </p>
                  <p>
                    <strong>Android:</strong> Menu do navegador &gt; Instalar aplicativo.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-200 backdrop-blur-md"
          >
            <Sparkles className="h-4 w-4" />
            Estudo inteligente para a saude
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex justify-center"
          >
            <div className="flex items-center gap-5 rounded-[2rem] border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl">
              <AppLogo className="h-24 w-24 rounded-[2.5rem] border border-white/20 bg-white/90 p-2 shadow-2xl" />
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-300">MINSA</p>
                <p className="text-4xl font-black tracking-tight text-white md:text-5xl">MINSA Prep</p>
              </div>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-4xl font-black tracking-tighter md:text-6xl"
          >
            A evolucao do estudo
            <br />
            <span className="text-emerald-400">em Angola</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-300 md:text-xl"
          >
            {PRODUCT_CONTEXT.vision} Feito para estudo continuo na saude, com foco especial no
            Concurso Publico da Saude neste momento.
          </motion.p>
        </header>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="w-full sm:w-auto"
          >
            <Link
              to="/register"
              className="group flex w-full items-center justify-center gap-3 rounded-[2rem] bg-emerald-500 px-8 py-5 text-lg font-black uppercase tracking-tight text-white shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] hover:bg-emerald-400"
            >
              <UserPlus className="h-6 w-6" />
              Criar conta
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
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
              className="flex w-full items-center justify-center gap-3 rounded-[2rem] border-2 border-white/20 bg-white/5 px-8 py-5 text-lg font-black uppercase tracking-tight text-white backdrop-blur-md transition-all hover:bg-white/10"
            >
              <LogIn className="h-6 w-6" />
              Ja tenho conta
            </Link>
          </motion.div>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          {featureCards.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1 + index * 0.1 }}
              className="group rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur-md transition-colors hover:bg-white/10"
            >
              <item.icon className="mb-4 h-8 w-8 text-emerald-400 transition-transform group-hover:scale-110" />
              <h3 className="mb-2 text-base font-bold">{item.title}</h3>
              <p className="text-xs leading-relaxed text-slate-400">{item.desc}</p>
            </motion.div>
          ))}
        </section>

        <div className="flex flex-col items-center gap-4">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.5 }}
            className="text-center text-xs font-medium uppercase tracking-[0.2em] text-slate-500"
          >
            Junta-te a milhares de estudantes e profissionais em Angola
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            transition={{ duration: 1, delay: 1.8 }}
            className="mt-4 inline-flex cursor-default items-center gap-2 rounded-lg border border-teal-500/10 bg-teal-500/5 px-3 py-1.5 grayscale transition-all hover:grayscale-0"
            title="FarmoGentileza - Fazemos gentileza na saude"
          >
            <span className="text-center text-[10px] font-bold uppercase tracking-widest text-teal-400">
              Uma iniciativa FarmoGentileza
              <br />
              <span className="text-[8px] font-normal opacity-80">Fazemos Gentileza Na Saude</span>
            </span>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
