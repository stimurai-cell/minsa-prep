-- Adds area_id to questions and keeps it in sync with topics
-- Safe to run multiple times in the Supabase SQL editor.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'questions'
      AND column_name  = 'area_id'
  ) THEN
    ALTER TABLE public.questions
      ADD COLUMN area_id UUID;
  END IF;
END $$;

-- Backfill area_id from the related topic
UPDATE public.questions q
SET area_id = t.area_id
FROM public.topics t
WHERE q.topic_id = t.id
  AND (q.area_id IS NULL OR q.area_id <> t.area_id);

-- Foreign key (only if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'questions_area_id_fkey'
      AND conrelid = 'public.questions'::regclass
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_area_id_fkey
      FOREIGN KEY (area_id)
      REFERENCES public.areas(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Index for faster filtering by area
CREATE INDEX IF NOT EXISTS idx_questions_area_id ON public.questions(area_id);

-- Keep area_id consistent whenever a question is inserted/updated
CREATE OR REPLACE FUNCTION sync_question_area_from_topic()
RETURNS trigger AS $$
BEGIN
  IF NEW.topic_id IS NOT NULL THEN
    SELECT area_id INTO NEW.area_id FROM public.topics WHERE id = NEW.topic_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_questions_area_sync ON public.questions;
CREATE TRIGGER trg_questions_area_sync
BEFORE INSERT OR UPDATE OF topic_id ON public.questions
FOR EACH ROW EXECUTE FUNCTION sync_question_area_from_topic();
