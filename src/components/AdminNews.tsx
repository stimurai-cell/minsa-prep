import { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    Send,
    Megaphone,
    Users,
    User,
    Type,
    Image as ImageIcon,
    Loader2,
    Bell
} from 'lucide-react';

export default function AdminNews() {
    const [loading, setLoading] = useState(false);

    // News State
    const [newsTitle, setNewsTitle] = useState('');
    const [newsBody, setNewsBody] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [newsType, setNewsType] = useState('news');

    // Notification State
    const [notifTitle, setNotifTitle] = useState('');
    const [notifBody, setNotifBody] = useState('');
    const [targetUserId, setTargetUserId] = useState('');
    const [broadcast, setBroadcast] = useState(true);

    const handlePostNews = async () => {
        if (!newsTitle || !newsBody) return alert('Preecha o título e o corpo da notícia.');

        setLoading(true);
        try {
            const { error } = await supabase.from('feed_items').insert({
                type: newsType,
                content: { title: newsTitle, body: newsBody },
                image_url: imageUrl || null
            });

            if (error) throw error;

            alert('Notícia publicada no feed!');
            setNewsTitle('');
            setNewsBody('');
            setImageUrl('');
        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSendNotification = async () => {
        if (!notifTitle || !notifBody) return alert('Preencha título e corpo da notificação.');

        setLoading(true);
        try {
            const { error } = await supabase.from('user_notifications').insert({
                user_id: broadcast ? null : (targetUserId || null),
                title: notifTitle,
                body: notifBody,
                type: 'marketing'
            });

            if (error) throw error;

            alert('Notificação enviada!');
            setNotifTitle('');
            setNotifBody('');
            setTargetUserId('');
        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Create Feed Post */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                        <Megaphone className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 leading-tight">Postar Novidades</h3>
                        <p className="text-sm text-slate-500 font-medium tracking-tight">Publicar no feed estilo Duolingo</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Post</label>
                        <select
                            value={newsType}
                            onChange={(e) => setNewsType(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 transition-all"
                        >
                            <option value="news">📢 Aviso Geral</option>
                            <option value="achievement">🏆 Conquista Especial</option>
                            <option value="streak">🔥 Evento de Ofensiva</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 text-sm font-bold">Título</label>
                        <input
                            type="text"
                            placeholder="Ex: Novos Simulados Disponíveis!"
                            value={newsTitle}
                            onChange={(e) => setNewsTitle(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mensagem</label>
                        <textarea
                            placeholder="Escreva o conteúdo aqui..."
                            value={newsBody}
                            onChange={(e) => setNewsBody(e.target.value)}
                            rows={4}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 transition-all resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">URL da Imagem (Opcional)</label>
                        <div className="relative">
                            <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="https://exemplo.com/imagem.png"
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-blue-400 transition-all"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handlePostNews}
                        disabled={loading}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_4px_0_0_#2563eb] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        Publicar Novidade
                    </button>
                </div>
            </div>

            {/* Direct/Mass Notification */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                        <Bell className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 leading-tight">Enviar Notificação</h3>
                        <p className="text-sm text-slate-500 font-medium tracking-tight">Push e avisos no app</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex bg-slate-50 p-1.5 rounded-2xl border-2 border-slate-100">
                        <button
                            onClick={() => setBroadcast(true)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${broadcast ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400'}`}
                        >
                            <Users className="w-4 h-4" /> Global
                        </button>
                        <button
                            onClick={() => setBroadcast(false)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!broadcast ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400'}`}
                        >
                            <User className="w-4 h-4" /> Individual
                        </button>
                    </div>

                    {!broadcast && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ID do Usuário</label>
                            <input
                                type="text"
                                placeholder="UUID do aluno..."
                                value={targetUserId}
                                onChange={(e) => setTargetUserId(e.target.value)}
                                className="w-full bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-amber-400 transition-all font-mono"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Título do Alerta</label>
                        <input
                            type="text"
                            placeholder="Ex: Sua ofensiva está em perigo!"
                            value={notifTitle}
                            onChange={(e) => setNotifTitle(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-amber-400 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Corpo da Mensagem</label>
                        <textarea
                            placeholder="Digite o texto que o usuário verá no celular..."
                            value={notifBody}
                            onChange={(e) => setNotifBody(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-amber-400 transition-all resize-none"
                        />
                    </div>

                    <button
                        onClick={handleSendNotification}
                        disabled={loading}
                        className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_4px_0_0_#d97706] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        Disparar Notificação
                    </button>
                </div>
            </div>
        </div>
    );
}
