create index if not exists daily_missions_reward_badge_code_idx on public.daily_missions(reward_badge_code) where reward_badge_code is not null;
