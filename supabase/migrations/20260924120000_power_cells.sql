-- Power cells: no quotas. Anything logged charges a cell (Hunt, Prep, Body);
-- following up with a referral contact now counts too, and each day can
-- carry a battery check-in that sizes the plan.

alter table public.logs drop constraint if exists logs_kind_check;
alter table public.logs add constraint logs_kind_check
  check (kind in ('referral', 'application', 'followup', 'leetcode', 'workout', 'scalp', 'other'));

alter table public.missions drop constraint if exists missions_target_key_check;
alter table public.missions add constraint missions_target_key_check
  check (target_key in ('referral', 'application', 'followup', 'leetcode', 'workout'));

alter table public.day_checkins add column if not exists energy text
  check (energy in ('low', 'normal', 'high'));
