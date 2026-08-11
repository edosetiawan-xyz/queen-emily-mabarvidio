-- Queen Emily MabarVidio
-- This schema is optional for the Broadcast/Presence architecture.
-- Keep the database empty if you only use Supabase Realtime channels.
-- If you later add persistent rooms/messages, enable RLS and write policies first.

create table if not exists public.mabar_rooms (
  code text primary key,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.mabar_rooms enable row level security;

-- No public policies are created intentionally.
-- Do not expose this table to anon until you add proper authentication/RLS. 
