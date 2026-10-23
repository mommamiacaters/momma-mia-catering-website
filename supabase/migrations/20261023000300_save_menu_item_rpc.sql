-- ============================================================================
-- Save a dish and the services it is sold in as ONE transaction.
--
-- The admin form made three separate calls (dish, membership upsert, delete of
-- untouched memberships). A failure part-way left the dish saved with its
-- services half-updated. One function call is one transaction: all or nothing.
--
-- SECURITY INVOKER on purpose: the caller's own RLS (admin-only writes on
-- menu_items and menu_item_categories) still applies; the is_admin() check
-- below only turns a silent 0-row write into a clear error.
-- Re-runnable.
-- ============================================================================

-- An earlier draft took (p_id, p_item, p_categories); defaults must come last.
drop function if exists public.save_menu_item(uuid, jsonb, jsonb);

create or replace function public.save_menu_item(
  p_item       jsonb,              -- menu_items columns the form edits
  p_categories jsonb,              -- [{ "category_id": int, "price_cents": int|null }, ...]
  p_id         uuid default null   -- null = new dish
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id   uuid;
  v_item public.menu_items;
  v_cats int[];
begin
  if not (select public.is_admin()) then
    raise exception 'Only admins can save dishes' using errcode = '42501';
  end if;

  select array_agg(distinct (c->>'category_id')::int)
    into v_cats
    from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) c;
  if v_cats is null then
    raise exception 'Pick at least one service for this dish to appear in';
  end if;

  v_item := jsonb_populate_record(null::public.menu_items, p_item);
  -- create_order reads the home service for the per-dish floor, so it must be
  -- one the dish is actually sold in.
  if v_item.category_id is not null and not (v_item.category_id = any (v_cats)) then
    raise exception 'The home service must be one of the ticked services';
  end if;

  if p_id is null then
    insert into public.menu_items (
      category_id, name, description, image_url, price_cents, min_qty,
      sub_category_id, item_type, is_available, is_catering
    ) values (
      v_item.category_id, v_item.name, v_item.description, v_item.image_url,
      v_item.price_cents, v_item.min_qty, v_item.sub_category_id, v_item.item_type,
      coalesce(v_item.is_available, true), coalesce(v_item.is_catering, false)
    )
    returning id into v_id;
  else
    update public.menu_items set
      category_id     = v_item.category_id,
      name            = v_item.name,
      description     = v_item.description,
      image_url       = v_item.image_url,
      price_cents     = v_item.price_cents,
      min_qty         = v_item.min_qty,
      sub_category_id = v_item.sub_category_id,
      item_type       = v_item.item_type,
      is_available    = coalesce(v_item.is_available, true),
      is_catering     = coalesce(v_item.is_catering, false)
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Dish % not found', p_id;
    end if;
  end if;

  -- Upsert what is ticked, then drop what is not. The home-category trigger has
  -- already inserted the home membership; the upsert just sets its price.
  insert into public.menu_item_categories (menu_item_id, category_id, price_cents)
  select v_id, (c->>'category_id')::int, (c->>'price_cents')::int
    from jsonb_array_elements(p_categories) c
  on conflict (menu_item_id, category_id)
  do update set price_cents = excluded.price_cents;

  delete from public.menu_item_categories
   where menu_item_id = v_id
     and category_id <> all (v_cats);

  return v_id;
end;
$$;

revoke all on function public.save_menu_item(jsonb, jsonb, uuid) from public, anon;
grant execute on function public.save_menu_item(jsonb, jsonb, uuid) to authenticated;
