-- Run after supabase-transfers.sql. Preserves product names in activity after deletion.
begin;
alter table public.location_movements alter column product_id drop not null;
alter table public.location_movements drop constraint if exists location_movements_product_id_fkey;
alter table public.location_movements add constraint location_movements_product_id_fkey
  foreign key (product_id) references public.location_products(id) on delete set null;
alter table public.location_movements drop constraint if exists location_movements_type_check;
alter table public.location_movements add constraint location_movements_type_check
  check (type in ('Added', 'Transfer', 'Stock added', 'Adjusted', 'Deleted'));
alter table public.location_movements drop constraint if exists location_movements_check;
alter table public.location_movements add constraint location_movements_check
  check ((type <> 'Transfer' and source is null) or
    (type = 'Transfer' and source is not null and source <> destination and quantity > 0));

create or replace function public.change_location_product(p_id uuid, p_quantity integer, p_location text, p_action text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  saved public.location_products;
  previous integer;
  next_quantity integer;
  activity_type text;
  activity_note text;
begin
  if auth.uid() is null then raise exception 'Please sign in to continue'; end if;
  if p_location is null or p_location not in ('storage', 'clinic') or
     p_action is null or p_action not in ('increase', 'edit', 'delete') or
     p_quantity is null or p_quantity < 0 or (p_action = 'increase' and p_quantity = 0) then
    raise exception 'Invalid action, location, or quantity';
  end if;
  select * into saved from public.location_products where id = p_id for update;
  if not found then raise exception 'Product not found. Refresh the inventory.'; end if;
  previous := case when p_location = 'storage' then saved.storage else saved.clinic end;
  if p_action = 'delete' then
    activity_type := 'Deleted';
    activity_note := format('Product deleted from Storage (%s units) and Clinic (%s units)', saved.storage, saved.clinic);
    next_quantity := previous;
  else
    next_quantity := case when p_action = 'increase' then previous + p_quantity else p_quantity end;
    activity_type := case when p_action = 'increase' then 'Stock added' else 'Adjusted' end;
    activity_note := format('%s quantity: %s to %s', initcap(p_location), previous, next_quantity);
    update public.location_products
      set storage = case when p_location = 'storage' then next_quantity else storage end,
          clinic = case when p_location = 'clinic' then next_quantity else clinic end
      where id = p_id;
  end if;
  insert into public.location_movements(product_id, product_name, type, quantity, destination, note)
    values (saved.id, saved.name, activity_type,
      case when p_action = 'delete' then 0 else abs(next_quantity - previous) end,
      p_location, activity_note);
  if p_action = 'delete' then delete from public.location_products where id = p_id; end if;
end;
$$;
revoke all on function public.change_location_product(uuid, integer, text, text) from public, anon;
grant execute on function public.change_location_product(uuid, integer, text, text) to authenticated;
notify pgrst, 'reload schema';
commit;
