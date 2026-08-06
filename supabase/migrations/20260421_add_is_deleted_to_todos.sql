-- Migration to add is_deleted top-level column to todos table
ALTER TABLE public.todos ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Create an index to optimize filtering by active vs deleted records
CREATE INDEX IF NOT EXISTS todos_is_deleted_idx ON public.todos (is_deleted);
