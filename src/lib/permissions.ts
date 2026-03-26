/**
 * Central permission map for MINSA Prep.
 *
 * Roles:
 *  - free    : treino livre, 30 questoes/dia, 1 simulacao/semana, ranking basico
 *  - basic   : alias legado interno; hoje equivale ao nucleo do Premium
 *  - premium : simulacoes ilimitadas, treino sem limite, banco completo e offline
 *  - elite   : tudo do premium + radar, simulacao nacional, PDF e batalha
 *  - admin   : acesso total
 *
 * Extras:
 *  - pacote_offline         : legado; mantido so por compatibilidade antiga
 *  - pacote_concurso        : simulador focado em concurso publico
 *  - simulacao_oficial_extra: simulacao oficial extra
 *  - intensivo_farmacia     : questoes intensivas de farmacia
 *  - intensivo_enfermagem   : questoes intensivas de enfermagem
 */

export type UserRole = 'free' | 'basic' | 'premium' | 'elite' | 'admin';

export interface UserPermissions {
  hasGuidedTraining: boolean;
  canAccessHardDifficulty: boolean;
  dailyQuestionLimit: number | null;
  canAccessFullQuestionBank: boolean;
  simulationsPerWeek: number | null;
  canAccessSimulation: boolean;
  hasFullRanking: boolean;
  hasHistorico: boolean;
  hasWeaknessRadar: boolean;
  hasStatisticsPDF: boolean;
  hasNationalSimulation: boolean;
  hasBattleMode: boolean;
  hasOfflinePackage: boolean;
  hasConcursoModule: boolean;
  hasExtraSimulacao: boolean;
  hasIntensivoFarmacia: boolean;
  hasIntensivoEnfermagem: boolean;
}

export function getPermissions(
  role: UserRole | string | undefined,
  activePackages: string[] = []
): UserPermissions {
  const resolvedRole = (role || 'free') as UserRole;
  const isAdmin = resolvedRole === 'admin';
  const isElite = isAdmin || resolvedRole === 'elite';
  const isPremium = isElite || resolvedRole === 'premium';
  const hasPremiumCoreAccess = isPremium || resolvedRole === 'basic';

  const hasPackage = (id: string) => activePackages.includes(id);

  return {
    hasGuidedTraining: isElite,
    canAccessHardDifficulty: isPremium,
    dailyQuestionLimit: hasPremiumCoreAccess ? null : 30,
    canAccessFullQuestionBank: isPremium,
    simulationsPerWeek: hasPremiumCoreAccess ? null : 1,
    canAccessSimulation: hasPremiumCoreAccess,
    hasFullRanking: hasPremiumCoreAccess,
    hasHistorico: hasPremiumCoreAccess,
    hasWeaknessRadar: isElite,
    hasStatisticsPDF: isElite,
    hasNationalSimulation: isElite,
    hasBattleMode: isElite,
    hasOfflinePackage: isPremium || isAdmin || hasPackage('pacote_offline'),
    hasConcursoModule: isAdmin || hasPackage('pacote_concurso'),
    hasExtraSimulacao: isAdmin || hasPackage('simulacao_oficial_extra'),
    hasIntensivoFarmacia: isAdmin || hasPackage('intensivo_farmacia'),
    hasIntensivoEnfermagem: isAdmin || hasPackage('intensivo_enfermagem'),
  };
}

import { useAuthStore } from '../store/useAuthStore';

export function usePermissions(): UserPermissions {
  const { profile } = useAuthStore();
  return getPermissions(profile?.role, (profile as any)?.active_packages || []);
}
