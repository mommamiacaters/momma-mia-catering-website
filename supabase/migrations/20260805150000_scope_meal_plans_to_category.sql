-- ============================================================================
-- Scope a meal plan to the category it draws its dishes from
-- ----------------------------------------------------------------------------
-- 20260805120100 back-filled sub_category_id for every category by matching the
-- legacy item_type. That correctly grouped Party Trays' "chicken" and "seafood"
-- rows — but those sub-categories carry slot='main', so 16 party trays priced
-- ₱950–₱1,850 became eligible to fill a ₱210 lunch box, along with 4 Add-on
-- desserts. The price-range view showed it: Full Feast read ₱330–₱4,065.
--
-- The mistake was treating slot as a global property of a sub-category. "Chicken"
-- really is a chicken dish on both menus; what differs is WHICH MENU. Eligibility
-- is a relationship between a plan and a category, so that is where it belongs —
-- rather than asking every future query to remember a category filter.
-- ============================================================================

alter table public.meal_plans
  add column if not exists category_id int references public.categories(id) on delete restrict;

-- Every plan today is a Check-a-Lunch box.
update public.meal_plans
   set category_id = (select id from public.categories where slug = 'check-a-lunch')
 where category_id is null;

create index if not exists idx_meal_plans_category on public.meal_plans(category_id);

-- ---------- price range, now scoped ------------------------------------------
create or replace view public.meal_plan_price_ranges as
with plan_slots as (
  select p.id as meal_plan_id, p.pricing_mode, p.price_cents, p.category_id, c.slot, c.n
    from public.meal_plans p
    cross join lateral (
      values ('main',    p.main_count),
             ('side',    p.side_count),
             ('dessert', p.dessert_count),
             ('rice',    p.rice_count)
    ) as c(slot, n)
)
select ps.meal_plan_id,
       ps.pricing_mode,
       ps.price_cents,
       coalesce(sum(coalesce(st.lo, 0) * ps.n), 0)::int as min_cents,
       coalesce(sum(coalesce(st.hi, 0) * ps.n), 0)::int as max_cents
  from plan_slots ps
  left join lateral (
    select min(coalesce(m.price_cents, 0)) as lo,
           max(coalesce(m.price_cents, 0)) as hi
      from public.menu_items m
      join public.sub_categories s on s.id = m.sub_category_id
     where m.is_available
       and s.slot = ps.slot
       -- the scope that was missing
       and m.category_id = ps.category_id
  ) st on true
 group by ps.meal_plan_id, ps.pricing_mode, ps.price_cents;

grant select on public.meal_plan_price_ranges to anon, authenticated;

-- ---------- the dishes a plan may actually be built from ---------------------
-- Exposed as a view so the storefront, the admin preview and the price range all
-- agree on what is selectable, instead of each re-deriving the join.
create or replace view public.meal_plan_options as
select p.id            as meal_plan_id,
       s.slot,
       m.id            as menu_item_id,
       m.name,
       m.description,
       m.image_url,
       m.price_cents,
       s.id            as sub_category_id,
       s.name          as sub_category_name,
       s.sort_order    as sub_category_sort
  from public.meal_plans p
  join public.menu_items m     on m.category_id = p.category_id and m.is_available
  join public.sub_categories s on s.id = m.sub_category_id and s.is_active
 where s.slot is not null
   and p.is_active;

grant select on public.meal_plan_options to anon, authenticated;
