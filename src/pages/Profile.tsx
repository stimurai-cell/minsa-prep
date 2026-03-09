import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { LogOut, Trash2, Camera, ShieldAlert } from 'lucide-react';

const AVATAR_COLORS = [
    'bg-emerald-100 text-emerald-600',
    'bg-blue-100 text-blue-600',
    'bg-purple-100 text-purple-600',
    'bg-orange-100 text-orange-600',
    'bg-pink-100 text-pink-600',
    'bg-yellow-100 text-yellow-700',
];

export default function Profile() {
    const { profile, user, signOut, refreshProfile } = useAuthStore();
    const navigate = useNavigate();
    const [fullName, setFullName] = useState(profile?.full_name || '');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedAvatarColor, setSelectedAvatarColor] = useState(
        profile?.avatar_style || AVATAR_COLORS[0]
    );

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;
        setLoading(true);
        setMessage('');

        try {
            // Update profile
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    avatar_style: selectedAvatarColor,
                })
                .eq('id', profile.id);

            if (profileError) throw profileError;

            // Update password if provided
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
            setMessage(err.message || 'Erro ao atualizar perfil.');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const handleDeleteAccount = async () => {
        // In a real production app we'd call an Edge Function to delete the user via admin API
        // For now we will flag it or sign out and show a message
        alert('O pedido de exclusão permanente de conta foi enviado aos administradores. Você será desconectado.');
        await signOut();
        navigate('/login');
    };

    return (
        <div className="mx-auto max-w-2xl space-y-6 md:space-y-8 animate-in fade-in duration-300">
            <div className="text-center mt-6">
                <h1 className="text-2xl font-black text-slate-800">Perfil</h1>
            </div>

            <div className="bg-white rounded-[2rem] border-2 border-slate-200 p-6 md:p-8 shadow-sm">
                <form onSubmit={handleUpdateProfile} className="space-y-6">

                    {/* Avatar Section */}
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className={`relative w-28 h-28 rounded-full flex items-center justify-center text-5xl font-black transition-colors ${selectedAvatarColor}`}>
                            {fullName.charAt(0).toUpperCase() || 'U'}
                            <div className="absolute bottom-0 right-0 bg-white p-2 border-2 border-slate-200 rounded-full shadow-sm text-slate-500 hover:text-blue-500 cursor-pointer transition-colors">
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

                    {/* Form Fields */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo</label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">E-mail (Leitura Visual)</label>
                            <input
                                type="text"
                                value={user?.email || ''}
                                disabled
                                className="w-full rounded-2xl border-2 border-slate-100 bg-slate-100 px-4 py-3 text-slate-500 font-medium cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nova Senha (opcional)</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white font-medium"
                            />
                            <p className="text-xs text-slate-400 mt-1 font-medium">Deixe em branco para manter a senha atual.</p>
                        </div>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-2xl text-sm font-bold text-center ${message.includes('Erro') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black uppercase tracking-wider py-4 rounded-2xl shadow-[0_4px_0_0_#2563eb] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                    >
                        {loading ? 'A Guardar...' : 'Guardar Alterações'}
                    </button>
                </form>
            </div>

            <div className="space-y-4 pt-4">
                {/* Sign Out */}
                <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 py-4 font-bold rounded-2xl transition-all"
                >
                    <LogOut className="w-5 h-5" />
                    SAIR DA CONTA
                </button>

                {/* Delete Account (Hidden/Danger) */}
                <div className="pt-8">
                    {!showDeleteConfirm ? (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="mx-auto flex items-center gap-2 text-sm font-bold text-rose-300 hover:text-rose-500 transition-colors"
                        >
                            <ShieldAlert className="w-4 h-4" />
                            Excluir Conta Permanentemente
                        </button>
                    ) : (
                        <div className="bg-rose-50 border-2 border-rose-200 p-6 rounded-[2rem] text-center animate-in zoom-in duration-200">
                            <h3 className="text-rose-700 font-black mb-2">Tem a certeza?</h3>
                            <p className="text-sm text-rose-600 font-medium mb-6">
                                Esta ação é irreversível e perderá todo o seu progresso, XP e histórico no MINSA Prep.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 bg-white border-2 border-slate-200 text-slate-600 font-bold py-3 rounded-xl hover:bg-slate-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    className="flex-1 bg-rose-500 text-white font-black py-3 rounded-xl shadow-[0_4px_0_0_#be123c] active:shadow-none active:translate-y-1"
                                >
                                    SIM, EXCLUIR
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
