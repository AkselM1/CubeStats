-- CubeStats V3 schema. Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text unique not null check(char_length(username) between 3 and 24),
 display_name text default '',
 bio text default '',
 is_public boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.events (
 id text primary key,
 name text not null,
 is_active boolean not null default true,
 is_official boolean not null default false,
 sort_order integer not null default 0
);
create table if not exists public.event_stats (
 id uuid primary key default gen_random_uuid(),
 event_id text not null references public.events(id) on delete cascade,
 stat_type text not null,
 label text not null,
 unit text not null default 's',
 visible_on_profile boolean not null default true,
 included_in_rankings boolean not null default true,
 unique(event_id,stat_type)
);
create table if not exists public.solves (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 event_id text not null references public.events(id),
 stat_type text not null default 'single',
 value numeric(14,4) not null check(value > 0),
 scramble text,
 penalty text not null default 'none' check(penalty in ('none','plus2','dnf')),
 created_at timestamptz not null default now()
);
create table if not exists public.level_thresholds (
 id uuid primary key default gen_random_uuid(),
 event_id text not null references public.events(id) on delete cascade,
 stat_type text not null,
 level_name text not null,
 max_value numeric(14,4) not null check(max_value > 0),
 sort_order integer not null default 0
);
create table if not exists public.admin_users (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_stats enable row level security;
alter table public.solves enable row level security;
alter table public.level_thresholds enable row level security;
alter table public.admin_users enable row level security;

create policy "profiles public or owner read" on public.profiles for select
 using(is_public or auth.uid()=id);
create policy "profile owner insert" on public.profiles for insert to authenticated
 with check(auth.uid()=id);
create policy "profile owner update" on public.profiles for update to authenticated
 using(auth.uid()=id) with check(auth.uid()=id);

create policy "active events read" on public.events for select using(is_active);
create policy "admin events all" on public.events for all to authenticated
 using(exists(select 1 from public.admin_users a where a.user_id=auth.uid()))
 with check(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));
create policy "admin reads inactive events" on public.events for select to authenticated
 using(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

create policy "event stats read" on public.event_stats for select using(true);
create policy "admin event stats all" on public.event_stats for all to authenticated
 using(exists(select 1 from public.admin_users a where a.user_id=auth.uid()))
 with check(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

create policy "solves public profile or owner read" on public.solves for select using(
 auth.uid()=user_id or exists(select 1 from public.profiles p where p.id=user_id and p.is_public=true)
);
create policy "solve owner insert" on public.solves for insert to authenticated with check(auth.uid()=user_id);
create policy "solve owner update" on public.solves for update to authenticated
 using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "solve owner delete" on public.solves for delete to authenticated using(auth.uid()=user_id);

create policy "thresholds read" on public.level_thresholds for select using(true);
create policy "admin thresholds all" on public.level_thresholds for all to authenticated
 using(exists(select 1 from public.admin_users a where a.user_id=auth.uid()))
 with check(exists(select 1 from public.admin_users a where a.user_id=auth.uid()));

create policy "admin can read own row" on public.admin_users for select to authenticated using(auth.uid()=user_id);

-- Create the profile row automatically. Username gets a temporary unique value;
-- the user can replace it with their preferred public pseudonym in the profile page.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
declare base_name text; candidate text;
begin
 base_name:=lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username','cuber'),'[^a-zA-Z0-9_-]','','g'));
 base_name:=left(base_name,16);
 if length(base_name)<3 then base_name:='cuber'; end if;
 candidate:=base_name||'_'||substr(replace(new.id::text,'-',''),1,6);
 insert into public.profiles(id,username) values(new.id,candidate) on conflict(id) do nothing;
 return new;
end; $$;
drop trigger if exists on_auth_user_created_cubestats on auth.users;
create trigger on_auth_user_created_cubestats after insert on auth.users
for each row execute procedure public.handle_new_user();

insert into public.events(id,name,is_official,sort_order) values
('222','2×2×2',true,1),('333','3×3×3',true,2),('444','4×4×4',true,3),('555','5×5×5',true,4),
('666','6×6×6',true,5),('777','7×7×7',true,6),('333oh','3×3 à une main',true,7),
('333bf','3×3 à l''aveugle',true,8),('444bf','4×4 à l''aveugle',true,9),('555bf','5×5 à l''aveugle',true,10),
('333fm','3×3 Fewest Moves',true,11),('333mbf','3×3 Multi-Blind',true,12),('clock','Clock',true,13),
('minx','Megaminx',true,14),('pyram','Pyraminx',true,15),('skewb','Skewb',true,16),('sq1','Square-1',true,17)
on conflict(id) do nothing;

insert into public.event_stats(event_id,stat_type,label,unit)
select e.id,s.stat_type,s.label,s.unit from public.events e
cross join(values('single','Single','s'),('mean3','Mean of 3','s'),('ao5','Ao5','s'),('ao12','Ao12','s'),('ao100','Ao100','s')) s(stat_type,label,unit)
on conflict(event_id,stat_type) do nothing;
