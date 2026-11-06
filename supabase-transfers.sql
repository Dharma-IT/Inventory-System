-- Run in the Supabase SQL editor before using the Transfers tab.
-- No seed data: Storage and Clinic start empty, independently of inventory.
begin;
create table if not exists public.location_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  storage integer not null default 0 check (storage >= 0),
  clinic integer not null default 0 check (clinic >= 0),
  created_at timestamptz not null default now()
);
create unique index if not exists location_products_name_unique on public.location_products (lower(trim(name)));
create table if not exists public.location_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.location_products(id),
  product_name text not null,
  type text not null check (type in ('Added', 'Transfer')),
  quantity integer not null check (quantity >= 0),
  source text check (source in ('storage', 'clinic')),
  destination text not null check (destination in ('storage', 'clinic')),
  note text not null,
  date date not null default ((now() at time zone 'Asia/Manila')::date),
  created_at timestamptz not null default now(),
  check ((type = 'Added' and source is null) or (type = 'Transfer' and source is not null and source <> destination and quantity > 0))
);
alter table public.location_products enable row level security;
alter table public.location_movements enable row level security;
drop policy if exists "Read location products" on public.location_products;
create policy "Read location products" on public.location_products for select to authenticated using (true);
drop policy if exists "Read location movements" on public.location_movements;
create policy "Read location movements" on public.location_movements for select to authenticated using (true);
grant select on public.location_products, public.location_movements to authenticated;
revoke insert, update, delete on public.location_products, public.location_movements from anon, authenticated;

create or replace function public.add_location_product(p_name text, p_quantity integer, p_location text)
returns void language plpgsql security definer set search_path = public
as $$
declare saved public.location_products;
begin
  if auth.uid() is null then raise exception 'Please sign in to continue'; end if;
  if p_name is null or length(trim(p_name)) not between 1 and 200
    or p_quantity is null or p_quantity < 0 or p_location is null or p_location not in ('storage', 'clinic') then
    raise exception 'Invalid product, quantity, or location';
  end if;
  insert into public.location_products(name, storage, clinic)
  values (trim(p_name), case when p_location = 'storage' then p_quantity else 0 end,
    case when p_location = 'clinic' then p_quantity else 0 end)
  returning * into saved;
  insert into public.location_movements(product_id, product_name, type, quantity, destination, note)
  values (saved.id, saved.name, 'Added', p_quantity, p_location, 'Product added to ' || initcap(p_location));
end;
$$;

create or replace function public.transfer_location_product(p_id uuid, p_quantity integer, p_source text)
returns void language plpgsql security definer set search_path = public
as $$
declare saved public.location_products; available integer; target text;
begin
  if auth.uid() is null then raise exception 'Please sign in to continue'; end if;
  if p_quantity is null or p_quantity <= 0 or p_source is null or p_source not in ('storage', 'clinic') then
    raise exception 'Invalid transfer quantity or location';
  end if;
  select * into saved from public.location_products where id = p_id for update;
  if not found then raise exception 'Product not found'; end if;
  available := case when p_source = 'storage' then saved.storage else saved.clinic end;
  if p_quantity > available then raise exception 'Insufficient stock: % available, % requested', available, p_quantity; end if;
  target := case when p_source = 'storage' then 'clinic' else 'storage' end;
  update public.location_products
  set storage = storage + case when p_source = 'storage' then -p_quantity else p_quantity end,
      clinic = clinic + case when p_source = 'clinic' then -p_quantity else p_quantity end
  where id = p_id;
  insert into public.location_movements(product_id, product_name, type, quantity, source, destination, note)
  values (saved.id, saved.name, 'Transfer', p_quantity, p_source, target, initcap(p_source) || ' to ' || initcap(target));
end;
$$;
revoke all on function public.add_location_product(text, integer, text) from public, anon;
revoke all on function public.transfer_location_product(uuid, integer, text) from public, anon;
grant execute on function public.add_location_product(text, integer, text) to authenticated;
grant execute on function public.transfer_location_product(uuid, integer, text) to authenticated;
notify pgrst, 'reload schema';
commit;
