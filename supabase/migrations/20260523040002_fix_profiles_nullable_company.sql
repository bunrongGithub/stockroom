-- Allow users to exist without a company (e.g. right after signup)
alter table public.profiles alter column company_id drop not null;

-- Drop the old FK so null is accepted, re-add it as deferrable
alter table public.profiles drop constraint if exists profiles_company_id_fkey;
alter table public.profiles
  add constraint profiles_company_id_fkey
  foreign key (company_id) references public.company (id) on delete set null;

-- Update trigger: insert profile with null company_id so signup never fails
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, company_id, role)
  values (new.id, null, 'staff');
  return new;
end;
$$;
