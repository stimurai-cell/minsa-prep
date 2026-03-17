import { supabase } from './supabase';

export const CURRENT_PLAN_STATUSES = ['draft', 'finalized', 'active'] as const;
export const EXECUTION_PLAN_STATUSES = ['finalized', 'active'] as const;

export type ElitePlanStatus =
  | 'draft'
  | 'finalized'
  | 'active'
  | 'completed'
  | 'archived';

interface PlanRevisionInput {
  planId: string;
  userId: string;
  eventType: 'created' | 'autosave' | 'manual_save' | 'finalized' | 'activated' | 'completed' | 'archived';
  actorRole?: 'student' | 'admin' | 'system';
  previousStatus?: string | null;
  newStatus?: string | null;
  changeSummary?: string | null;
  snapshot: Record<string, unknown>;
}

export async function createPlanRevision(input: PlanRevisionInput): Promise<void> {
  const { error } = await supabase.from('elite_plan_revisions').insert({
    plan_id: input.planId,
    user_id: input.userId,
    event_type: input.eventType,
    actor_role: input.actorRole || 'student',
    previous_status: input.previousStatus || null,
    new_status: input.newStatus || null,
    change_summary: input.changeSummary || null,
    snapshot: input.snapshot,
    created_at: new Date().toISOString()
  });

  if (error) {
    console.warn('elite_plan_revisions indisponivel, seguindo sem trilha completa', error);
  }
}

export async function getLatestPlanByStatuses<T = any>(
  userId: string,
  statuses: readonly string[]
): Promise<T | null> {
  const { data, error } = await supabase
    .from('elite_study_plans')
    .select('*')
    .eq('user_id', userId)
    .in('status', [...statuses])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Erro ao buscar plano Elite por status', error);
    return null;
  }

  return (data as T | null) || null;
}

export async function archiveCurrentPlans(userId: string): Promise<void> {
  const { data: currentPlans, error: fetchError } = await supabase
    .from('elite_study_plans')
    .select('id,status,daily_plan,focus_topics,source,week_start,week_end')
    .eq('user_id', userId)
    .in('status', [...CURRENT_PLAN_STATUSES]);

  if (fetchError) {
    console.warn('Erro ao listar planos atuais do Elite para arquivar', fetchError);
    return;
  }

  if (!currentPlans?.length) return;

  const planIds = currentPlans.map((plan) => plan.id);
  const archivedAt = new Date().toISOString();

  const { error } = await supabase
    .from('elite_study_plans')
    .update({
      status: 'archived',
      status_changed_at: archivedAt,
      updated_at: archivedAt
    })
    .in('id', planIds);

  if (error) {
    console.warn('Erro ao arquivar planos atuais do Elite', error);
    return;
  }

  await Promise.all(
    currentPlans.map((plan) =>
      createPlanRevision({
        planId: plan.id,
        userId,
        eventType: 'archived',
        actorRole: 'system',
        previousStatus: plan.status,
        newStatus: 'archived',
        changeSummary: 'Plano anterior arquivado para liberar uma nova versao ativa.',
        snapshot: {
          daily_plan: plan.daily_plan,
          focus_topics: plan.focus_topics,
          source: plan.source,
          week_start: plan.week_start,
          week_end: plan.week_end
        }
      })
    )
  );
}

export async function activatePlan(planId: string, userId: string): Promise<void> {
  const { data: currentPlan } = await supabase
    .from('elite_study_plans')
    .select('status,daily_plan,focus_topics,source,week_start,week_end')
    .eq('id', planId)
    .maybeSingle();

  if (!currentPlan || currentPlan.status === 'active') return;

  const { error } = await supabase
    .from('elite_study_plans')
    .update({
      status: 'active',
      activated_at: new Date().toISOString(),
      status_changed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', planId);

  if (error) {
    console.warn('Erro ao ativar plano Elite', error);
    return;
  }

  await createPlanRevision({
    planId,
    userId,
    eventType: 'activated',
    actorRole: 'student',
    previousStatus: currentPlan.status,
    newStatus: 'active',
    changeSummary: 'Plano entrou em execucao ao iniciar a rotina.',
    snapshot: {
      daily_plan: currentPlan.daily_plan,
      focus_topics: currentPlan.focus_topics,
      source: currentPlan.source,
      week_start: currentPlan.week_start,
      week_end: currentPlan.week_end
    }
  });
}

export function getPlanStatusLabel(status?: string): string {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'finalized':
      return 'Confirmado';
    case 'active':
      return 'Em execucao';
    case 'completed':
      return 'Concluido';
    case 'archived':
      return 'Arquivado';
    default:
      return 'Sem status';
  }
}
