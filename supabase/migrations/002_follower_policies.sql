-- Followers can view their own records
create policy "Followers can view their own records"
  on followers for select using (
    email = (select email from auth.users where id = auth.uid())
  );

-- Authenticated users can add themselves as a follower to any trip
create policy "Followers can add themselves"
  on followers for insert with check (
    auth.uid() is not null
    and email = (select email from auth.users where id = auth.uid())
  );

-- Followers can view trips they follow
create policy "Followers can view followed trips"
  on trips for select using (
    exists (
      select 1 from followers
      where followers.trip_id = trips.id
        and followers.email = (select email from auth.users where id = auth.uid())
    )
  );

-- Followers can view days for trips they follow
create policy "Followers can view days"
  on days for select using (
    exists (
      select 1 from followers
      where followers.trip_id = days.trip_id
        and followers.email = (select email from auth.users where id = auth.uid())
    )
  );

-- Followers can view GPS tracks
create policy "Followers can view GPS tracks"
  on gps_tracks for select using (
    exists (
      select 1 from days
      join followers on followers.trip_id = days.trip_id
      where days.id = gps_tracks.day_id
        and followers.email = (select email from auth.users where id = auth.uid())
    )
  );
