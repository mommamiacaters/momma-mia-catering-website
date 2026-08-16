-- ============================================================================
-- Per-dish order minimums.
--
-- Business rule: once a dish appears in a lunch-box order at all, the kitchen
-- needs a worthwhile batch of it — 15 by default. The default lives in
-- app_settings ('minimum_qty_per_dish', admin-tunable, 0 = rule off) and any
-- dish can override it via menu_items.min_qty:
--   NULL = use the store default   ·   0 = no minimum for this dish   ·   N = N
--
-- meal_plan_options is re-created to carry min_qty to the storefront builder —
-- CREATE OR REPLACE VIEW is legal here because the new column is appended last.
-- Enforcement is create_order v7 (next migration). Re-runnable.
-- ============================================================================

alter table public.menu_items
  add column if not exists min_qty int
  check (min_qty is null or (min_qty >= 0 and min_qty <= 500));

comment on column public.menu_items.min_qty is
  'Per-order minimum for this dish. NULL = store default (minimum_qty_per_dish), 0 = no minimum.';

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
       s.sort_order    as sub_category_sort,
       m.min_qty
  from public.meal_plans p
  join public.menu_items m     on m.category_id = p.category_id and m.is_available
  join public.sub_categories s on s.id = m.sub_category_id and s.is_active
 where s.slot is not null
   and p.is_active;

grant select on public.meal_plan_options to anon, authenticated;

-- Seed the rule OFF. Arming it here would strand customers on the pre-deploy
-- web bundle: no client gate, so they pay via the QR and only then get
-- rejected by create_order v7. The admin flips this to 15 in Store Settings
-- once the new web build is live. ON CONFLICT DO NOTHING: the value is the
-- admin's to own, re-running this migration must never clobber their tuning.
insert into public.app_settings (key, value, label, description, is_public)
values (
  'minimum_qty_per_dish',
  '0'::jsonb,
  'Minimum of each dish per order',
  'When a dish is picked for a lunch-box order, the order must include at least this many of it. Set to 0 to turn the rule off. Individual dishes can override this in Menu Manager (blank = use this default, 0 = that dish has no minimum). Does not affect à-la-carte, Party Trays, catering or equipment rental.',
  true
)
on conflict (key) do nothing;

alter table public.app_settings
  drop constraint if exists app_settings_minimum_qty_per_dish_bounds;

alter table public.app_settings
  add constraint app_settings_minimum_qty_per_dish_bounds check (
    key <> 'minimum_qty_per_dish'
    or (
      jsonb_typeof(value) = 'number'
      and (value #>> '{}')::numeric between 0 and 500
      and (value #>> '{}')::numeric = floor((value #>> '{}')::numeric)
    )
  );

comment on constraint app_settings_minimum_qty_per_dish_bounds on public.app_settings is
  'minimum_qty_per_dish must be a whole number between 0 and 500.';
