-- Links every auth user to a company and assigns a role
create table public.profiles (
  id         uuid   not null references auth.users (id) on delete cascade,
  company_id bigint not null references public.company (id) on delete cascade,
  role       text   not null default 'staff',
  constraint profiles_pkey primary key (id),
  constraint profiles_role_check check (role in ('owner', 'manager', 'staff'))
);

-- Expose only the calling user's own row
alter table public.profiles enable row level security;

create policy "users_see_own_profile" on public.profiles
  for select using (id = auth.uid());

-- Returns the company_id of the currently logged-in user.
-- Used inside RLS policies on every tenant-scoped table.
create or replace function public.my_company_id()
returns bigint language sql stable security definer as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- Auto-create a profile row when a new user signs up.
-- company_id defaults to 1; update it during an invitation flow.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, company_id, role)
  values (new.id, 1, 'staff');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
