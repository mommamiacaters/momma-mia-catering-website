-- ============================================================================
-- A dish can belong to several services, with its own price in each.
--
-- Until now menu_items.category_id was the whole story: one dish, one service.
-- Spaghetti Bolognese had to exist twice to be sold as a ₱950 party tray and a
-- ₱120 merienda portion. This adds the membership table.
--
-- menu_items.category_id STAYS, as the dish's HOME service. Two things still
-- read it and neither should change:
--   * create_order's per-dish floor (coalesce(mi.min_qty, c.min_qty_per_dish, …))
--     needs one category, not a set.
--   * a dish must always belong somewhere, even if every membership is removed.
-- A trigger keeps the home category present in the table, so the views below
-- can join through memberships alone and never silently drop a dish.
--
-- price_cents here is the per-service REFERENCE price. Every meal plan is
-- fixed-price, so what a customer pays inside a plan is the plan's price --
-- create_order does not read this column, and deliberately so.
-- Re-runnable.
-- ============================================================================

create table if not exists public.menu_item_categories (
  menu_item_id uuid    not null references public.menu_items(id) on delete cascade,
  category_id  integer not null references public.categories(id) on delete cascade,
  -- NULL = fall back to the dish's own price_cents.
  price_cents  integer,
  created_at   timestamptz not null default now(),
  primary key (menu_item_id, category_id)
);

comment on table public.menu_item_categories is
  'Which services a dish is sold under, and its reference price in each. menu_items.category_id remains the home service.';
comment on column public.menu_item_categories.price_cents is
  'Reference price for this dish in this service. NULL = use menu_items.price_cents. NOT charged inside a fixed-price plan.';

create index if not exists menu_item_categories_category_idx
  on public.menu_item_categories (category_id);

alter table public.menu_item_categories enable row level security;

drop policy if exists "menu_item_categories are public" on public.menu_item_categories;
create policy "menu_item_categories are public"
  on public.menu_item_categories for select using (true);

drop policy if exists "authenticated manage menu_item_categories" on public.menu_item_categories;
create policy "authenticated manage menu_item_categories"
  on public.menu_item_categories for all
  to authenticated using (true) with check (true);

-- ---------- backfill: today's single category becomes the first membership ---
insert into public.menu_item_categories (menu_item_id, category_id, price_cents)
select m.id, m.category_id, null
  from public.menu_items m
 where m.category_id is not null
on conflict (menu_item_id, category_id) do nothing;

-- ---------- the home category is always a member -----------------------------
-- Without this, moving a dish's home service in the admin would leave the views
-- joining on a membership that no longer exists and the dish would vanish.
create or replace function public.ensure_home_menu_item_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is not null then
    insert into public.menu_item_categories (menu_item_id, category_id)
    values (new.id, new.category_id)
    on conflict (menu_item_id, category_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists menu_items_home_category on public.menu_items;
create trigger menu_items_home_category
  after insert or update of category_id on public.menu_items
  for each row execute function public.ensure_home_menu_item_category();

-- ---------- views read memberships, not the single column ---------------------
-- Same columns as before; price_cents now prefers the per-service figure.
create or replace view public.meal_plan_options as
select p.id            as meal_plan_id,
       s.slot,
       m.id            as menu_item_id,
       m.name,
       m.description,
       m.image_url,
       coalesce(mic.price_cents, m.price_cents) as price_cents,
       s.id            as sub_category_id,
       s.name          as sub_category_name,
       s.sort_order    as sub_category_sort,
       m.min_qty
  from public.meal_plans p
  join public.categories c            on c.id = p.category_id and c.is_active
  join public.menu_item_categories mic on mic.category_id = p.category_id
  join public.menu_items m            on m.id = mic.menu_item_id and m.is_available
  join public.sub_categories s        on s.id = m.sub_category_id and s.is_active
 where s.slot is not null
   and p.is_active;

grant select on public.meal_plan_options to anon, authenticated;

create or replace view public.extras_menu_options as
select c.id         as category_id,
       c.slug       as category_slug,
       c.name       as category_name,
       c.sort_order as category_sort,
       m.id         as menu_item_id,
       m.name,
       m.description,
       m.image_url,
       coalesce(mic.price_cents, m.price_cents) as price_cents,
       m.min_qty
  from public.categories c
  join public.menu_item_categories mic on mic.category_id = c.id
  join public.menu_items m             on m.id = mic.menu_item_id and m.is_available
 where c.is_universal
   and c.is_active
   and coalesce(mic.price_cents, m.price_cents) is not null
   and coalesce(mic.price_cents, m.price_cents) > 0;

grant select on public.extras_menu_options to anon, authenticated;
