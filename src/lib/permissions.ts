/**
 * MINSA Prep — Ficheiro Central de Permissões
 *
 * Lógica de Planos (role):
 *  - free    : treino livre (fácil, médio, misto), 30 questões/dia, 1 simulação/semana, ranking básico
 *  - basic   : simulações ilimitadas, treino diário sem limite (EXCETO difícil), ranking completo, histórico de provas
 *  - premium : tudo do basic + modo difícil + banco completo de questões (mas sem radar avançado)
 *  - elite   : tudo do premium + radar de fraquezas + simulação nacional + estatísticas em PDF + modo batalha XP Plus
 *  - admin   : acesso total (sem restrições)
 *
 * Lógica de Extras (active_packages[]):
 *  - pacote_offline       : download de questões para uso offline
 *  - pacote_concurso      : simulador focado em concurso público
 *  - simulacao_oficial_extra : simulação oficial extra
 *  - intensivo_farmacia   : questões intensivas de farmácia
 *  - intensivo_enfermagem : questões intensivas de enfermagem
 */

export type UserRole = 'free' | 'basic' | 'premium' | 'elite' | 'admin';

export interface UserPermissions {
    // --- Treino ---
    canAccessHardDifficulty: boolean;    // Modo Difícil (premium+)
    dailyQuestionLimit: number | null;   // null = ilimitado; free = 30
    canAccessFullQuestionBank: boolean;  // Banco completo (premium+)

    // --- Simulações ---
    simulationsPerWeek: number | null;   // null = ilimitado; free = 1
    canAccessSimulation: boolean;        // basic+

    // --- Ranking ---
    hasFullRanking: boolean;             // basic+

    // --- Estatísticas ---
    hasHistorico: boolean;               // basic+
    hasWeaknessRadar: boolean;           // elite+ (Radar de Fraquezas)
    hasStatisticsPDF: boolean;           // elite+

    // --- Funcionalidades Elite ---
    hasNationalSimulation: boolean;      // elite+ (Simulação Nacional)
    hasBattleMode: boolean;              // elite+ (Modo Batalha XP Plus)

    // --- Extras (compra avulsa) ---
    hasOfflinePackage: boolean;          // pacote_offline
    hasConcursoModule: boolean;          // pacote_concurso
    hasExtraSimulacao: boolean;          // simulacao_oficial_extra
    hasIntensivoFarmacia: boolean;       // intensivo_farmacia
    hasIntensivoEnfermagem: boolean;     // intensivo_enfermagem
}

/**
 * Calcula todas as permissões a partir do role e dos pacotes extras activos do utilizador.
 */
export function getPermissions(
    role: UserRole | string | undefined,
    activePackages: string[] = []
): UserPermissions {
    const r = (role || 'free') as UserRole;
    const isAdmin = r === 'admin';
    const isElite = isAdmin || r === 'elite';
    const isPremium = isElite || r === 'premium';
    const isBasic = isPremium || r === 'basic';

    const hasPackage = (id: string) => activePackages.includes(id);

    return {
        // Treino
        canAccessHardDifficulty: isPremium,
        dailyQuestionLimit: isBasic ? null : 30,
        canAccessFullQuestionBank: isPremium,

        // Simulações
        simulationsPerWeek: isBasic ? null : 1,
        canAccessSimulation: isBasic,

        // Ranking & histórico
        hasFullRanking: isBasic,
        hasHistorico: isBasic,

        // Estatísticas avançadas
    hasWeaknessRadar: isElite,
        hasStatisticsPDF: isElite,

        // Funcionalidades Elite
        hasNationalSimulation: isElite,
        hasBattleMode: isElite,

        // Pacotes extras (compra avulsa)
        hasOfflinePackage: isAdmin || hasPackage('pacote_offline'),
        hasConcursoModule: isAdmin || hasPackage('pacote_concurso'),
        hasExtraSimulacao: isAdmin || hasPackage('simulacao_oficial_extra'),
        hasIntensivoFarmacia: isAdmin || hasPackage('intensivo_farmacia'),
        hasIntensivoEnfermagem: isAdmin || hasPackage('intensivo_enfermagem'),
    };
}

/**
 * Hook helper — podes usar assim nos componentes:
 *   const perms = usePermissions();
 *   if (!perms.canAccessHardDifficulty) ...
 */
import { useAuthStore } from '../store/useAuthStore';

export function usePermissions(): UserPermissions {
    const { profile } = useAuthStore();
    return getPermissions(profile?.role, (profile as any)?.active_packages || []);
}
