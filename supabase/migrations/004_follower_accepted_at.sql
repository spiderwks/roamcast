-- Add accepted_at to track when a follower has signed in and accepted the invite
alter table followers add column if not exists accepted_at timestamptz;

-- Allow followers to update their own record (needed to set accepted_at on sign-in)
create policy "Followers can update their own record"
  on followers for update using (
    email = (select email from auth.users where id = auth.uid())
  );
