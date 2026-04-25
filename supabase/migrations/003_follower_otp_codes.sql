create table if not exists follower_otp_codes (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code        text not null,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_follower_otp_email on follower_otp_codes (email, expires_at);

-- auto-purge expired rows older than 1 hour
create or replace function purge_expired_otp_codes() returns void
  language sql security definer as $$
    delete from follower_otp_codes where expires_at < now() - interval '1 hour';
  $$;
