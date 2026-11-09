-- Run after supabase-location-actions.sql, once, before deploying this update.
begin;
create or replace function public.add_location_stock(p_product_id text, p_quantity integer, p_location text)
returns void language plpgsql security definer set search_path = public
as $$
declare catalog_product public.products; saved public.location_products;
begin
  if auth.uid() is null then raise exception 'Please sign in to continue'; end if;
  if p_quantity is null or p_quantity <= 0 or p_location is null or p_location not in ('storage', 'clinic') then
    raise exception 'Invalid quantity or location';
  end if;
  select * into catalog_product from public.products where id = p_product_id;
  if not found then raise exception 'Product not found. Refresh the catalog.'; end if;
  insert into public.location_products(name, storage, clinic)
    values (trim(catalog_product.name), case when p_location = 'storage' then p_quantity else 0 end,
      case when p_location = 'clinic' then p_quantity else 0 end)
    on conflict (lower(trim(name))) do update
      set storage = location_products.storage + excluded.storage,
          clinic = location_products.clinic + excluded.clinic
    returning * into saved;
  insert into public.location_movements(product_id, product_name, type, quantity, destination, note)
    values (saved.id, saved.name, 'Stock added', p_quantity, p_location,
      'Stock received in ' || initcap(p_location) || ' · ' || catalog_product.sku);
end;
$$;
revoke all on function public.add_location_stock(text, integer, text) from public, anon;
grant execute on function public.add_location_stock(text, integer, text) to authenticated;

-- Remove only the existing Berberine location row; preserve catalog and history.
delete from public.location_products where lower(trim(name)) = 'berberine';
notify pgrst, 'reload schema';
commit;
