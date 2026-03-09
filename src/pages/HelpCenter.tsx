import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, X, ArrowLeft } from 'lucide-react';

interface FAQItemProps {
    question: string;
    answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border-b border-slate-100 last:border-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
            >
                <span className="font-bold text-slate-700 pr-4 leading-tight">{question}</span>
                {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                )}
            </button>
            {isOpen && (
                <div className="p-5 pt-0 text-slate-600 text-sm leading-relaxed animate-in slide-in-from-top-2 duration-200">
                    {answer}
                </div>
            )}
        </div>
    );
}

export default function HelpCenter() {
    const navigate = useNavigate();

    const sections = [
        {
            title: "Uso do MINSA Prep",
            items: [
                {
                    question: "O que é uma ofensiva?",
                    answer: "A ofensiva é o número de dias seguidos que você completou uma atividade no MINSA Prep. Mantenha seu ritmo diário para não perder sua sequência!"
                },
                {
                    question: "O que são as Ligas e divisões?",
                    answer: "As Ligas permitem que você compita com outros estudantes. Ganhe XP para subir de nível e alcançar a Liga Diamante!"
                },
                {
                    question: "Como mudo minha área de estudo?",
                    answer: "Você pode mudar sua área nas configurações do perfil. Isso atualizará as questões do Treino para focar no que você precisa."
                }
            ]
        },
        {
            title: "Assinatura e pagamentos",
            items: [
                {
                    question: "O que é o MINSA Premium e como eu assino?",
                    answer: "O Premium oferece remoção de anúncios, vidas infinitas e acesso a pacotes exclusivos de concursos. Você pode assinar na aba Premium do menu."
                },
                {
                    question: "Plano Família",
                    answer: "O Plano Família permite que você compartilhe os benefícios do Premium com até 5 amigos ou familiares em uma única assinatura."
                },
                {
                    question: "Como faço para pedir um reembolso?",
                    answer: "Reembolsos podem ser solicitados em até 7 dias após a compra, desde que o conteúdo não tenha sido extensivamente utilizado. Entre em contato pelo formulário de suporte."
                }
            ]
        }
    ];

    return (
        <div className="mx-auto max-w-2xl bg-white min-h-screen pb-20">
            {/* Header */}
            <div className="flex items-center px-4 py-4 bg-white border-b-2 border-slate-100 sticky top-0 z-10 transition-shadow">
                <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-slate-600 shrink-0">
                    <X className="w-6 h-6" />
                </button>
                <div className="flex-1 text-center pr-10">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">MINSA Prep - Central de Ajuda</span>
                </div>
            </div>

            <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-300">
                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-2 text-sky-500 font-black uppercase tracking-widest text-sm">
                        <span>Central de Ajuda</span>
                        <ChevronDown className="w-4 h-4 -rotate-90" />
                        <span className="text-slate-400 font-bold">Início</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Perguntas frequentes</h1>
                </div>

                <div className="space-y-6">
                    {sections.map((section, idx) => (
                        <div key={idx} className="bg-white rounded-[2rem] border-2 border-slate-200 overflow-hidden shadow-sm">
                            <h2 className="px-5 py-4 bg-slate-50/50 border-b-2 border-slate-100 text-sky-500 font-black text-sm uppercase tracking-wider">
                                {section.title}
                            </h2>
                            <div className="divide-y divide-slate-100">
                                {section.items.map((item, i) => (
                                    <FAQItem key={i} question={item.question} answer={item.answer} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="text-center pt-10 space-y-6">
                    <h3 className="text-xl font-black text-slate-800">Ainda tem dúvidas sobre algo?</h3>
                    <Link
                        to="/feedback"
                        className="inline-block bg-sky-500 hover:bg-sky-600 text-white font-black uppercase tracking-widest py-4 px-10 rounded-2xl shadow-[0_4px_0_0_#0284c7] active:shadow-none active:translate-y-1 transition-all"
                    >
                        Enviar Comentários
                    </Link>
                </div>
            </div>
        </div>
    );
}
