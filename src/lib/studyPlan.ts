import { supabase } from './supabase';

type Profile = {
  id: string;
  selected_area_id?: string | null;
  preparation_time_months?: number | null;
};

export async function createStudyPlanForUser(profile: Profile) {
  if (!profile?.id || !profile.selected_area_id) return null;

  try {
    // buscar topicos da area
    const { data: topics, error: tError } = await supabase
      .from('topics')
      .select('id,name')
      .eq('area_id', profile.selected_area_id);

    if (tError) throw tError;
    if (!topics || topics.length === 0) return null;

    // buscar progresso do usuario por topico
    const topicIds = topics.map((t: any) => t.id);
    const { data: progressRows } = await supabase
      .from('user_topic_progress')
      .select('topic_id,domain_score')
      .in('topic_id', topicIds)
      .eq('user_id', profile.id);

    const progressMap = new Map<string, number>();
    (progressRows || []).forEach((r: any) => progressMap.set(r.topic_id, Number(r.domain_score || 0)));

    const totalTopics = topics.length;
    const months = profile.preparation_time_months && profile.preparation_time_months > 0 ? profile.preparation_time_months : 1;
    const totalDays = Math.max(7, Math.round(months * 30));

    // Novas quests por dia: garantir cobertura de todos os topicos ao menos uma vez
    const newPerDay = Math.max(1, Math.ceil(totalTopics / totalDays));
    // Revisões: priorizar topicos com dominio < 80
    const lowTopics = topics.filter((t: any) => (progressMap.get(t.id) || 0) < 80);
    const reviewsPerDay = Math.min(5, Math.max(1, Math.ceil(lowTopics.length / Math.max(7, Math.floor(totalDays / 7)))));

    // Sessao do dia: escolher topicos prioritarios (dominio baixo) e preencher com novos topicos
    const prioritized = topics
      .map((t: any) => ({ id: t.id, name: t.name, score: progressMap.get(t.id) || 0 }))
      .sort((a: any, b: any) => a.score - b.score);

    const sessionTopics: Array<{ topic_id: string; type: 'new' | 'review' }> = [];

    // first, take reviews (topics with score < 60)
    const reviewCandidates = prioritized.filter((p: any) => p.score < 60).slice(0, reviewsPerDay);
    reviewCandidates.forEach((c: any) => sessionTopics.push({ topic_id: c.id, type: 'review' }));

    // then, add new topics (topics with less attempts or highest score gap)
    const remainingSlots = Math.max(0, newPerDay + reviewsPerDay - sessionTopics.length);
    const newCandidates = prioritized.slice(0, remainingSlots);
    newCandidates.forEach((c: any) => sessionTopics.push({ topic_id: c.id, type: 'new' }));

    const plan = {
      totalTopics,
      totalDays,
      newPerDay,
      reviewsPerDay,
      weeklySimulations: 1,
      generatedAt: new Date().toISOString(),
      sessionOfDay: sessionTopics,
    } as const;

    // upsert plan in study_plans
    const { data: existing } = await supabase
      .from('study_plans')
      .select('id')
      .eq('user_id', profile.id)
      .maybeSingle();

    if (existing && existing.id) {
      await supabase.from('study_plans').update({ plan_json: plan, generated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await supabase.from('study_plans').insert({ user_id: profile.id, plan_json: plan });
    }

    return plan;
  } catch (err) {
    console.error('Erro ao gerar plano de estudo:', err);
    return null;
  }
}
