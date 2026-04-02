-- MINSA Prep - Curadoria de questoes, reports e remocao do item incorreto

DELETE FROM public.questions
WHERE id = '79f81453-305a-422d-80a1-923c554d3989'
  AND content ILIKE 'Um paciente com anemia falciforme apresenta eritrócitos que, sob baixas concentrações de oxigénio, adotam uma forma de foice, levando à oclusão vascular e dor.%';

CREATE TABLE IF NOT EXISTS public.question_issue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reporter_name TEXT,
  area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL,
  area_name TEXT,
  topic_id UUID REFERENCES public.topics(id) ON DELETE SET NULL,
  topic_name TEXT,
  question_content TEXT NOT NULL,
  question_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason_category TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  resolution_note TEXT,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_question_issue_reports_status_created_at
  ON public.question_issue_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_issue_reports_question_id
  ON public.question_issue_reports (question_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_question_issue_reports_open_per_user
  ON public.question_issue_reports (reported_by, question_id)
  WHERE question_id IS NOT NULL AND status IN ('open', 'in_review');

ALTER TABLE public.question_issue_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own question issue reports" ON public.question_issue_reports;
CREATE POLICY "Users can insert own question issue reports"
ON public.question_issue_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Users can view own question issue reports" ON public.question_issue_reports;
CREATE POLICY "Users can view own question issue reports"
ON public.question_issue_reports
FOR SELECT
TO authenticated
USING (auth.uid() = reported_by);

DROP POLICY IF EXISTS "Admins can view all question issue reports" ON public.question_issue_reports;
CREATE POLICY "Admins can view all question issue reports"
ON public.question_issue_reports
FOR SELECT
TO authenticated
USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can update question issue reports" ON public.question_issue_reports;
CREATE POLICY "Admins can update question issue reports"
ON public.question_issue_reports
FOR UPDATE
TO authenticated
USING (public.is_current_user_admin())
WITH CHECK (public.is_current_user_admin());

GRANT SELECT, INSERT, UPDATE ON public.question_issue_reports TO authenticated;
