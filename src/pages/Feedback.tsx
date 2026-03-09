import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronDown, Paperclip, Send } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';

export default function Feedback() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [problemType, setProblemType] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const problemTypes = [
        "Denunciar abuso",
        "Não consigo acessar a minha conta",
        "Relatório de erro",
        "Problema na compra ou assinatura",
        "Comentários ou sugestões de recursos",
        "Pedido de exclusão de conta"
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSubmitting(true);
        setMessage('');

        try {
            const { error } = await supabase.from('support_messages').insert({
                user_id: user.id,
                email: user.email,
                subject,
                description,
                problem_type: problemType,
                status: 'open'
            });

            if (error) throw error;

            setMessage("Comentário enviado com sucesso!");
            setTimeout(() => {
                navigate('/help');
            }, 2000);
        } catch (err: any) {
            console.error('Error sending feedback:', err);
            setMessage('Erro ao enviar comentário. Tente novamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="mx-auto max-w-2xl bg-white min-h-screen pb-20">
            {/* Header */}
            <div className="flex items-center px-4 py-4 bg-white border-b-2 border-slate-100 sticky top-0 z-10">
                <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-slate-600">
                    <X className="w-6 h-6" />
                </button>
                <div className="flex-1 text-center pr-10">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-xs truncate">Central de Ajuda - Fazer comentários</span>
                </div>
            </div>

            <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-300">
                <div className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-2 text-sky-500 font-black uppercase tracking-widest text-sm">
                        <span>Central de Ajuda</span>
                        <ChevronDown className="w-4 h-4 -rotate-90" />
                        <span className="text-slate-400 font-bold">Fazer comentários</span>
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight">Como podemos ajudar?</h1>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] border-2 border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
                    <div>
                        <h2 className="text-lg font-black text-slate-800 mb-2">Descreva o problema</h2>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
                            Conte o que está acontecendo com o máximo de detalhes possível. Isso vai nos ajudar a entender o problema.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-black text-slate-600 mb-1 uppercase tracking-wider">
                                Seu e-mail <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="email"
                                value={user?.email || ''}
                                disabled
                                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-4 py-3 text-slate-500 font-medium cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-black text-slate-600 mb-1 uppercase tracking-wider">
                                Assunto <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white font-medium"
                                placeholder="Título breve do problema"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-black text-slate-600 mb-1 uppercase tracking-wider">
                                Descrição <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                required
                                rows={4}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white font-medium resize-none"
                                placeholder="Explique os detalhes..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-black text-slate-600 mb-1 uppercase tracking-wider">
                                Tipo de problema <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    required
                                    value={problemType}
                                    onChange={(e) => setProblemType(e.target.value)}
                                    className="w-full appearance-none rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-slate-700 font-bold outline-none transition focus:border-sky-400 focus:bg-white"
                                >
                                    <option value="" disabled>SELECIONE UMA OPÇÃO</option>
                                    {problemTypes.map((type, i) => (
                                        <option key={i} value={type}>{type.toUpperCase()}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-black text-slate-600 mb-1 uppercase tracking-wider">Anexos</label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 hover:border-sky-400 hover:bg-sky-50 transition-all cursor-pointer group"
                            >
                                <Paperclip className="w-6 h-6 text-slate-400 group-hover:text-sky-500" />
                                <span className="text-sky-500 font-black text-sm uppercase tracking-widest">Adicionar arquivo</span>
                                <input type="file" ref={fileInputRef} className="hidden" />
                            </div>
                        </div>
                    </div>

                    {message && (
                        <div className="p-4 rounded-2xl bg-green-50 text-green-600 font-bold text-center animate-bounce">
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-[0_4px_0_0_#0284c7] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                        {isSubmitting ? 'Enviando...' : (
                            <>
                                <Send className="w-5 h-5" />
                                ENVIAR
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
