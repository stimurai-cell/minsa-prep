import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfUse() {
    const navigate = useNavigate();

    return (
        <div className="mx-auto max-w-3xl bg-white min-h-screen">
            <div className="flex items-center px-4 py-4 bg-white border-b-2 border-slate-100 sticky top-0 z-10 transition-shadow">
                <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-slate-600 shrink-0">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 text-center pr-10">
                    <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">MINSA Prep - Legal</span>
                </div>
            </div>

            <div className="p-6 md:p-12 space-y-8 animate-in fade-in duration-300">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight text-center">Termos de Uso</h1>

                <div className="space-y-6 text-slate-600 leading-relaxed font-medium">
                    <section>
                        <h2 className="text-xl font-black text-slate-800 mb-3 uppercase tracking-wide text-sm">1. Aceitação dos Termos</h2>
                        <p>
                            Ao utilizar o MINSA Prep, você concorda em cumprir e vincular-se a estes Termos de Uso. Esta plataforma é destinada à preparação educacional para exames de saúde e concursos públicos.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-800 mb-3 uppercase tracking-wide text-sm">2. Uso do Conteúdo</h2>
                        <p>
                            Todo o conteúdo fornecido, incluindo questões, resumos e simulações, é de propriedade do MINSA Prep ou licenciado para uso. É proibida a redistribuição ou venda de qualquer material sem autorização prévia.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-800 mb-3 uppercase tracking-wide text-sm">3. Isenção de Responsabilidade</h2>
                        <p>
                            Embora nos esforcemos para fornecer dados atualizados e precisos baseados na legislação angolana e padrões internacionais de saúde, o MINSA Prep não garante a aprovação em exames. O sucesso depende do esforço individual do estudante.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-800 mb-3 uppercase tracking-wide text-sm">4. Conduta do Usuário</h2>
                        <p>
                            O usuário compromete-se a utilizar a plataforma de forma ética, respeitando os demais estudantes e não tentando burlar os sistemas de gamificação ou segurança.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-800 mb-3 uppercase tracking-wide text-sm">5. Modificações</h2>
                        <p>
                            Reservamo-nos o direito de atualizar estes termos periodicamente. O uso continuado da plataforma após alterações constitui aceitação dos novos termos.
                        </p>
                    </section>
                </div>

                <div className="pt-10 border-t border-slate-100 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
                    Última atualização: 09 de Março de 2026
                </div>
            </div>
        </div>
    );
}
