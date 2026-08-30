-- ============================================================================
-- Archived categories leave the storefront picker.
--
-- The Menu Manager can now archive a category (categories.is_active = false).
-- extras_menu_options already honours the flag; meal_plan_options did not, so
-- an archived MAIN category's dishes would have kept selling through its
-- plans. Same columns, one extra join condition. Re-runnable.
-- ============================================================================

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
  join public.categories c     on c.id = p.category_id and c.is_active
  join public.menu_items m     on m.category_id = p.category_id and m.is_available
  join public.sub_categories s on s.id = m.sub_category_id and s.is_active
 where s.slot is not null
   and p.is_active;

grant select on public.meal_plan_options to anon, authenticated;
