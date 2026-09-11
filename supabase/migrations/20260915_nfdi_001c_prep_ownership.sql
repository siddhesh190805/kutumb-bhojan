-- NFDI-001C-CORRECTION-001: prep_tasks ownership / lifecycle
-- Distinguish planner-generated tasks from manual tasks

alter table public.prep_tasks add column if not exists source text not null default 'planner' check (source in ('planner', 'manual'));

-- Backfill existing rows: task_key starting with soak-/ferment-/batch- are planner tasks, others remain planner by default (safe)
-- New tasks will set source explicitly via repository

create index if not exists idx_prep_tasks_source on public.prep_tasks(source);
create index if not exists idx_prep_tasks_household_task_date on public.prep_tasks(household_id, task_date);
