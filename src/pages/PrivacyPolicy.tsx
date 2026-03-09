import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicy() {
    const navigate = useNavigate();

    return (
        <div className="mx-auto max-w-3xl bg-white min-h-screen">
            <div className="flex items-center px-4 py-4 bg-white border-b-2 border-slate-100 sticky top-0 z-10 transition-shadow">
                <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-slate-600 shrink-0">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 text-center pr-10">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">MINSA Prep - Privacidade</span>
                </div>
            </div>

            <div className="p-6 md:p-12 space-y-8 animate-in fade-in duration-300">
                <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-sky-100 rounded-full">
                        <Shield className="w-12 h-12 text-sky-500" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight text-center">Política de Privacidade</h1>
                </div>

                <div className="space-y-6 text-slate-600 leading-relaxed font-medium text-sm">
                    <section>
                        <h2 className="text-lg font-black text-slate-800 mb-2 uppercase tracking-wide">1. Introdução</h2>
                        <p>
                            No MINSA Prep, respeitamos a sua privacidade e estamos comprometidos em proteger os dados pessoais que você compartilha conosco. Esta política descreve como coletamos e usamos suas informações.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-black text-slate-800 mb-2 uppercase tracking-wide">2. Dados que Coletamos</h2>
                        <p>
                            Coletamos informações como nome, e-mail e progresso de estudo (XP, respostas) para personalizar sua experiência de aprendizado e fornecer estatísticas de evolução.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-black text-slate-800 mb-2 uppercase tracking-wide">3. Uso de Informações</h2>
                        <p>
                            Seus dados são usados exclusivamente para:
                        </p>
                        <ul className="list-disc ml-5 mt-2 space-y-1">
                            <li>Gerenciar sua conta e progresso gamificado.</li>
                            <li>Melhorar nossos algoritmos de geração de questões por IA.</li>
                            <li>Comunicar atualizações importantes e suporte técnico.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-black text-slate-800 mb-2 uppercase tracking-wide">4. Segurança de Dados</h2>
                        <p>
                            Utilizamos o Supabase (infraestrutura via AWS) e protocolos de criptografias de ponta para garantir que seus dados estejam protegidos contra acessos não autorizados.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-black text-slate-800 mb-2 uppercase tracking-wide">5. Seus Direitos</h2>
                        <p>
                            Você tem o direito de acessar, corrigir ou excluir seus dados permanentemente a qualquer momento através das configurações da sua conta.
                        </p>
                    </section>
                </div>

                <div className="pt-10 border-t border-slate-100 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
                    Sua confiança é nossa maior prioridade.
                </div>
            </div>
        </div>
    );
}
