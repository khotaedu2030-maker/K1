create index if not exists idx_children_parent_id
on public.children(parent_id);

create index if not exists idx_subscriptions_child_status
on public.subscriptions(child_id, status);

create index if not exists idx_daily_tasks_child_created
on public.daily_tasks(child_id, created_at);

create index if not exists idx_recommendations_child_created
on public.recommendations(child_id, created_at);

create index if not exists idx_daily_pulse_reports_child_created
on public.daily_pulse_reports(child_id, created_at);

create index if not exists idx_weekly_goals_child_week
on public.weekly_goals(child_id, week_start);

create index if not exists idx_independence_assessments_child_date
on public.independence_assessments(child_id, assessment_date);
