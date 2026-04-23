-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- PROFILES (extends Supabase auth.users)
-- ─────────────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─────────────────────────────────────────────
-- TRIPS
-- ─────────────────────────────────────────────
create table trips (
  id uuid primary key default uuid_generate_v4(),
  roamer_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 100),
  description text check (char_length(description) <= 200),
  adventure_type text not null check (adventure_type in ('hiking','walking','cycling','water','cruise','driving')),
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('active','complete')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table trips enable row level security;

create policy "Roamers can manage their own trips"
  on trips for all using (auth.uid() = roamer_id);

-- ─────────────────────────────────────────────
-- DAYS
-- ─────────────────────────────────────────────
create table days (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid not null references trips(id) on delete cascade,
  day_number integer not null,
  route_label text,
  date date not null default current_date,
  distance_miles decimal(8,2) default 0,
  duration_seconds integer default 0,
  session_start timestamptz,
  session_end timestamptz,
  upload_status text not null default 'pending' check (upload_status in ('pending','uploading','complete')),
  uploaded_at timestamptz,
  created_at timestamptz default now()
);

alter table days enable row level security;

create policy "Roamers can manage days for their trips"
  on days for all using (
    exists (select 1 from trips where trips.id = days.trip_id and trips.roamer_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- GPS TRACKS
-- ─────────────────────────────────────────────
create table gps_tracks (
  id uuid primary key default uuid_generate_v4(),
  day_id uuid not null references days(id) on delete cascade,
  points jsonb not null default '[]',
  point_count integer default 0,
  storage_url text,
  created_at timestamptz default now()
);

alter table gps_tracks enable row level security;

create policy "Roamers can manage GPS tracks for their days"
  on gps_tracks for all using (
    exists (
      select 1 from days
      join trips on trips.id = days.trip_id
      where days.id = gps_tracks.day_id and trips.roamer_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- MOMENTS
-- ─────────────────────────────────────────────
create table moments (
  id uuid primary key default uuid_generate_v4(),
  day_id uuid not null references days(id) on delete cascade,
  type text not null check (type in ('photo','video','audio')),
  title text not null check (char_length(title) <= 100),
  note text check (char_length(note) <= 500),
  lat decimal(10,7),
  lng decimal(10,7),
  captured_at timestamptz not null default now(),
  media_url text,
  duration_seconds integer,
  file_size_bytes integer,
  sort_order integer default 0,
  created_at timestamptz default now()
);

alter table moments enable row level security;

create policy "Roamers can manage moments for their days"
  on moments for all using (
    exists (
      select 1 from days
      join trips on trips.id = days.trip_id
      where days.id = moments.day_id and trips.roamer_id = auth.uid()
    )
  );

-- Followers can view moments for days they follow
create policy "Followers can view moments"
  on moments for select using (
    exists (
      select 1 from days
      join followers on followers.trip_id = days.trip_id
      where days.id = moments.day_id
        and followers.email = (select email from auth.users where id = auth.uid())
    )
  );

-- ─────────────────────────────────────────────
-- POINTS OF INTEREST
-- ─────────────────────────────────────────────
create table pois (
  id uuid primary key default uuid_generate_v4(),
  day_id uuid not null references days(id) on delete cascade,
  google_place_id text,
  name text not null,
  type text,
  description text,
  lat decimal(10,7),
  lng decimal(10,7),
  distance_from_path_ft integer,
  path_timestamp timestamptz,
  created_at timestamptz default now()
);

alter table pois enable row level security;

create policy "Anyone following the trip can view POIs"
  on pois for select using (true);

create policy "Roamers can manage POIs for their days"
  on pois for all using (
    exists (
      select 1 from days
      join trips on trips.id = days.trip_id
      where days.id = pois.day_id and trips.roamer_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- FOLLOWERS
-- ─────────────────────────────────────────────
create table followers (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid not null references trips(id) on delete cascade,
  email text not null,
  invited_at timestamptz default now(),
  last_viewed_at timestamptz,
  last_viewed_day integer,
  notification_opt_out boolean default false,
  unique (trip_id, email)
);

alter table followers enable row level security;

create policy "Roamers can manage followers for their trips"
  on followers for all using (
    exists (select 1 from trips where trips.id = followers.trip_id and trips.roamer_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- FOLLOWER SESSIONS (OTP auth)
-- ─────────────────────────────────────────────
create table follower_sessions (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  otp_hash text not null,
  otp_expires_at timestamptz not null,
  session_token text,
  session_expires_at timestamptz,
  created_at timestamptz default now()
);

-- No RLS needed — managed by Edge Functions with service role

-- ─────────────────────────────────────────────
-- STORAGE BUCKETS
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public) values ('media', 'media', false);
insert into storage.buckets (id, name, public) values ('gps-tracks', 'gps-tracks', false);

-- Roamers can upload their own media
create policy "Roamers can upload media"
  on storage.objects for insert with check (
    bucket_id = 'media' and auth.uid() is not null
  );

create policy "Roamers can read their own media"
  on storage.objects for select using (
    bucket_id = 'media' and auth.uid() is not null
  );
