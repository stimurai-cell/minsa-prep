import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sendPushNotification } from '../lib/pushNotifications';
import {
    Send,
    Megaphone,
    Users,
    User,
    Image as ImageIcon,
    Loader2,
    Bell,
    Search,
    Link as LinkIcon
} from 'lucide-react';

export default function AdminNews() {
    const [loading, setLoading] = useState(false);

    // News State
    const [newsTitle, setNewsTitle] = useState('');
    const [newsBody, setNewsBody] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [newsLink, setNewsLink] = useState('');
    const [newsType, setNewsType] = useState('news');

    // Notification State
    const [notifTitle, setNotifTitle] = useState('');
    const [notifBody, setNotifBody] = useState('');
    const [broadcast, setBroadcast] = useState(true);

    // User search for individual notification
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [searchingUsers, setSearchingUsers] = useState(false);

    useEffect(() => {
        if (!userSearchQuery || broadcast) {
            setUserSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearchingUsers(true);
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name')
                .ilike('full_name', `%${userSearchQuery}%`)
                .limit(8);
            setUserSearchResults(data || []);
            setSearchingUsers(false);
        }, 400);
        return () => clearTimeout(timer);
    }, [userSearchQuery, broadcast]);

    const handlePostNews = async () => {
        if (!newsTitle || !newsBody) return alert('Preencha o título e o corpo da notícia.');

        setLoading(true);
        try {
            const { error } = await supabase.from('feed_items').insert({
                type: newsType,
                content: {
                    title: newsTitle,
                    body: newsBody,
                    link: newsLink || undefined
                },
                image_url: imageUrl || null
            });

            if (error) throw error;

            // Disparar push notification global para a nova novidade
            await sendPushNotification({
                title: newsTitle,
                body: newsBody,
                url: '/news'
            });
            setNewsTitle('');
            setNewsBody('');
            setImageUrl('');
            setNewsLink('');
        } catch (err: any) {
            alert(`Erro: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSendNotification = async () => {
        if (!notifTitle || !notifBody) return alert('Preencha título e corpo da notificação.');
        if (!broadcast && !selectedUser) return alert('Selecione um utilizador para notificação individual.');

        setLoading(true);
        try {
            const { error } = await supabase.from('user_notifications').insert({
                user_id: broadcast ? null : selectedUser.id,
                title: notifTitle,
                body: notifBody,
                type: 'marketing'
            });

            if (error) throw error;

            // Disparar push notification real nos dispositivos Android
            await sendPushNotification({
                title: notifTitle,
                body: notifBody,
                url: '/news',
                userId: broadcast ? undefined : selectedUser.id,
            });

            alert(`✅ Notificação enviada${broadcast ? ' para todos' : ` para ${selectedUser.full_name}`}!`);
            setNotifTitle('');
            setNotifBody('');
            setSelectedUser(null);
            setUserSearchQuery('');
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
                        <p className="text-sm text-slate-500 font-medium tracking-tight">Publicar no feed de todos os utilizadores</p>
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
                            <option value="achievement">🏆 Conquista / Destaque</option>
                            <option value="streak">🔥 Evento de Ofensiva</option>
                            <option value="update">🆕 Actualização da Plataforma</option>
                            <option value="tip">💡 Dica de Estudo</option>
                            <option value="motivacao">🎯 Motivação</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Título</label>
                        <input
                            type="text"
                            placeholder="Ex: Novos Simulados Disponíveis!"
                            value={newsTitle}
                            onChange={(e) => setNewsTitle(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Mensagem / Corpo</label>
                        <textarea
                            placeholder="Escreva o conteúdo aqui, pode ser longo e inclui emojis 🎉..."
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
                                placeholder="https://cloudinary.com/..."
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-blue-400 transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Link / CTA (Opcional)</label>
                        <div className="relative">
                            <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="https://... ou /practice"
                                value={newsLink}
                                onChange={(e) => setNewsLink(e.target.value)}
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-blue-400 transition-all"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handlePostNews}
                        disabled={loading}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_4px_0_0_#2563eb] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-60"
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
                        <p className="text-sm text-slate-500 font-medium tracking-tight">Push e avisos individuais ou globais</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Toggle Global / Individual */}
                    <div className="flex bg-slate-50 p-1.5 rounded-2xl border-2 border-slate-100">
                        <button
                            onClick={() => { setBroadcast(true); setSelectedUser(null); setUserSearchQuery(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${broadcast ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400'}`}
                        >
                            <Users className="w-4 h-4" /> Global (todos)
                        </button>
                        <button
                            onClick={() => setBroadcast(false)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!broadcast ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400'}`}
                        >
                            <User className="w-4 h-4" /> Individual
                        </button>
                    </div>

                    {/* Individual user search by name */}
                    {!broadcast && (
                        <div className="space-y-2 animate-in fade-in duration-300">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Pesquisar Utilizador pelo Nome</label>
                            {selectedUser ? (
                                <div className="flex items-center justify-between bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">{selectedUser.full_name}</p>
                                    </div>
                                    <button
                                        onClick={() => { setSelectedUser(null); setUserSearchQuery(''); }}
                                        className="text-xs font-black text-rose-500 hover:text-rose-700 uppercase tracking-wider"
                                    >
                                        Alterar
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Nome do aluno..."
                                        value={userSearchQuery}
                                        onChange={(e) => setUserSearchQuery(e.target.value)}
                                        className="w-full bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:border-amber-400 transition-all"
                                    />
                                    {(userSearchResults.length > 0 || searchingUsers) && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-100 rounded-2xl shadow-xl z-10 overflow-hidden">
                                            {searchingUsers ? (
                                                <div className="p-4 flex items-center justify-center gap-2 text-slate-400">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span className="text-xs font-bold">A procurar...</span>
                                                </div>
                                            ) : (
                                                userSearchResults.map(u => (
                                                    <button
                                                        key={u.id}
                                                        onClick={() => { setSelectedUser(u); setUserSearchQuery(''); setUserSearchResults([]); }}
                                                        className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex items-center justify-between border-b border-slate-50 last:border-0"
                                                    >
                                                        <span className="text-sm font-black text-slate-900">{u.full_name}</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Título do Alerta</label>
                        <input
                            type="text"
                            placeholder="Ex: A sua ofensiva está em perigo! 🔥"
                            value={notifTitle}
                            onChange={(e) => setNotifTitle(e.target.value)}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-amber-400 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Corpo da Mensagem</label>
                        <textarea
                            placeholder="Digite o texto que o utilizador verá..."
                            value={notifBody}
                            onChange={(e) => setNotifBody(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:border-amber-400 transition-all resize-none"
                        />
                    </div>

                    <button
                        onClick={handleSendNotification}
                        disabled={loading}
                        className="w-full py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-[0_4px_0_0_#d97706] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                        Disparar Notificação {!broadcast && selectedUser ? `→ ${selectedUser.full_name.split(' ')[0]}` : broadcast ? '→ Todos' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}
