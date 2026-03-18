/**
 * Central permission map for MINSA Prep.
 *
 * Roles:
 *  - free    : treino livre, 30 questoes/dia, 1 simulacao/semana, ranking basico
 *  - basic   : simulacoes ilimitadas, treino sem limite (exceto dificil), ranking completo
 *  - premium : tudo do basic + dificil + banco completo + offline incluido
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
  const isBasic = isPremium || resolvedRole === 'basic';

  const hasPackage = (id: string) => activePackages.includes(id);

  return {
    canAccessHardDifficulty: isPremium,
    dailyQuestionLimit: isBasic ? null : 30,
    canAccessFullQuestionBank: isPremium,
    simulationsPerWeek: isBasic ? null : 1,
    canAccessSimulation: isBasic,
    hasFullRanking: isBasic,
    hasHistorico: isBasic,
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
