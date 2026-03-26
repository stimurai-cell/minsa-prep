import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { translateAuthError } from '../lib/authMessages';
import { STUDY_GOALS } from '../lib/productContext';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Camera, ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react';

const AVATAR_COLORS = [
    'bg-emerald-100 text-emerald-600',
    'bg-blue-100 text-blue-600',
    'bg-purple-100 text-purple-600',
    'bg-orange-100 text-orange-600',
    'bg-pink-100 text-pink-600',
    'bg-yellow-100 text-yellow-700',
];

export default function EditProfile() {
    const { profile, user, signOut, refreshProfile } = useAuthStore();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [fullName, setFullName] = useState(profile?.full_name || '');
    const [goal, setGoal] = useState(profile?.goal || '');
    const [phone, setPhone] = useState(profile?.phone || '');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
    const [selectedAvatarColor, setSelectedAvatarColor] = useState(
        profile?.avatar_style || AVATAR_COLORS[0]
    );

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.id) return;

        setUploading(true);
        setMessage('');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', 'minsa_uploads');
            formData.append('cloud_name', 'dzvusz0u4');
            formData.append('folder', 'avatars');

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/dzvusz0u4/image/upload`,
                {
                    method: 'POST',
                    body: formData,
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Erro no Cloudinary');
            }

            const data = await response.json();
            setAvatarUrl(data.secure_url);
            setMessage('Foto carregada via Cloudinary! Salve para confirmar.');
        } catch (err: any) {
            console.error('Error uploading image:', err);
            setMessage(`Erro ao carregar imagem: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;
        setLoading(true);
        setMessage('');

        try {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    avatar_style: selectedAvatarColor,
                    avatar_url: avatarUrl,
                    goal: goal,
                    phone: phone,
                })
                .eq('id', profile.id);

            if (profileError) throw profileError;

            if (password) {
                const { error: authError } = await supabase.auth.updateUser({
                    password: password,
                });
                if (authError) throw authError;
            }

            await refreshProfile();
            setMessage('Perfil atualizado com sucesso!');
            setPassword('');
        } catch (err: any) {
            console.error(err);
            setMessage(translateAuthError(err, 'Erro ao atualizar perfil.'));
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleDeleteAccount = async () => {
        alert('O pedido de exclusão permanente de conta foi enviado aos administradores. Você será desconectado.');
        await signOut();
        navigate('/login');
    };

    return (
        <div className="mx-auto max-w-2xl bg-white min-h-screen">
            <div className="flex items-center px-4 py-4 bg-white border-b-2 border-slate-100 sticky top-0 z-10">
                <Link to="/settings" className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-xl font-black text-slate-400 uppercase tracking-widest mx-auto -translate-x-4">Editar Perfil</h1>
            </div>

            <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-300">
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleImageUpload}
                            accept="image/*"
                            className="hidden"
                        />
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`relative w-28 h-28 rounded-full flex items-center justify-center text-5xl font-black transition-colors cursor-pointer overflow-hidden ${!avatarUrl ? selectedAvatarColor : 'bg-white'}`}
                        >
                            {uploading ? (
                                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                            ) : avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                fullName.charAt(0).toUpperCase() || 'U'
                            )}
                            <div className="absolute bottom-0 right-0 bg-white p-2 border-2 border-slate-200 rounded-full shadow-sm text-slate-500 hover:text-blue-500 transition-colors">
                                <Camera className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="flex gap-2 justify-center flex-wrap mt-4">
                            {AVATAR_COLORS.map((colorClass) => (
                                <button
                                    key={colorClass}
                                    type="button"
                                    onClick={() => setSelectedAvatarColor(colorClass)}
                                    className={`w-10 h-10 rounded-full border-4 transition-all ${colorClass} ${selectedAvatarColor === colorClass ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-105'}`}
                                    aria-label="Mudar cor do avatar"
                                />
                            ))}
                        </div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Cor do Avatar</p>
                    </div>

                    <hr className="border-slate-100" />

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Qual o seu objetivo principal?</label>
                            <select
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white font-medium appearance-none"
                            >
                                <option value="" disabled>Selecione um foco</option>
                                {STUDY_GOALS.map((studyGoal) => (
                                    <option key={studyGoal} value={studyGoal}>{studyGoal}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Número de Telefone</label>
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">E-mail</label>
                            <input
                                type="text"
                                value={user?.email || ''}
                                disabled
                                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-100 px-4 py-3 text-slate-500 font-medium cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nova Senha</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white font-medium"
                            />
                            <p className="text-xs text-slate-400 mt-1 font-medium">Deixe em branco para manter a senha atual.</p>
                        </div>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-2xl text-sm font-bold text-center ${message.includes('Erro') ? 'bg-rose-50 text-rose-600' : 'bg-green-50 text-green-600'}`}>
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-sky-500 hover:bg-sky-600 text-white font-black uppercase tracking-wider py-4 rounded-2xl shadow-[0_4px_0_0_#0284c7] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                    >
                        {loading ? 'A Guardar...' : 'Salvar Alterações'}
                    </button>
                </form>

                <div className="pt-8">
                    {!showDeleteConfirm ? (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="mx-auto flex items-center gap-2 text-sm font-bold text-rose-400 hover:text-rose-500 transition-colors"
                        >
                            <ShieldAlert className="w-4 h-4" />
                            Excluir Conta Permanentemente
                        </button>
                    ) : (
                        <div className="bg-rose-50 border-2 border-rose-200 p-6 rounded-[2rem] text-center animate-in zoom-in duration-200">
                            <h3 className="text-rose-700 font-black mb-2">Tem toda a certeza?</h3>
                            <p className="text-sm text-rose-600 font-medium mb-6">
                                Todos os seus dados, XP e histórico no MINSA Prep serão apagados para sempre. Esta ação é impossível de reverter.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 bg-white border-2 border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50 uppercase tracking-widest text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    className="flex-1 bg-rose-500 text-white font-black py-3 rounded-xl shadow-[0_4px_0_0_#be123c] active:shadow-none active:translate-y-1 uppercase tracking-widest text-sm"
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
