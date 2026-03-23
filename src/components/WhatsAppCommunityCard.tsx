import { ExternalLink, MessageCircle, Users } from 'lucide-react';
import { WHATSAPP_COMMUNITY_URL } from '../lib/community';

interface WhatsAppCommunityCardProps {
  title?: string;
  description?: string;
  compact?: boolean;
}

export default function WhatsAppCommunityCard({
  title = 'Entrar na comunidade do WhatsApp',
  description = 'Fale com outros estudantes, acompanhe avisos e entre direto na comunidade oficial do MINSA Prep.',
  compact = false,
}: WhatsAppCommunityCardProps) {
  if (compact) {
    return (
      <a
        href={WHATSAPP_COMMUNITY_URL}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-3 rounded-[1.6rem] border border-[#25D366]/25 bg-[#25D366]/10 px-4 py-4 text-left shadow-sm transition hover:bg-[#25D366]/15"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-sm">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-900">{title}</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#128C7E]">Comunidade oficial</p>
          </div>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-[#128C7E]" />
      </a>
    );
  }

  return (
    <div className="rounded-[2rem] border-2 border-[#25D366]/20 bg-gradient-to-br from-[#f0fff5] to-[#ecfdf3] p-5 shadow-sm md:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] bg-[#25D366] text-white shadow-lg shadow-[#25D366]/20">
          <Users className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#128C7E]">Comunidade oficial</p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">{title}</h3>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{description}</p>
        </div>
      </div>

      <a
        href={WHATSAPP_COMMUNITY_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-[1.4rem] bg-[#25D366] px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_16px_30px_-18px_rgba(37,211,102,0.95)] transition hover:-translate-y-0.5 hover:bg-[#1ebe5a]"
      >
        <MessageCircle className="h-5 w-5" />
        Abrir comunidade
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
