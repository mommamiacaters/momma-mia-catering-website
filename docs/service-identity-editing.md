# Editing a service's name, icon, photo and visibility

Status: **shipped.** `/admin/services/:slug` → Details saves to `public.services`
and reaches the live site on the visitor's next page load.

## Where a service's values live now

| Value | Source | Editable |
| --- | --- | --- |
| Homepage panel name | `services.name` | yes |
| Service page heading | `services.page_title` | yes |
| Icon | `services.icon_id` → `SERVICE_ICONS` in `constants/serviceIcons.tsx` | yes, from the 5 glyphs |
| Homepage photo | `services.image_url` (null = bundled photo) | yes, uploads to `menu-images/services/<slug>/` |
| On the homepage | `services.is_active` | yes |
| Order of the panels | `services.sort_order` | not in the UI yet |
| Description | `ORDERABLE_SERVICES` / `OTHER_SERVICES` in `constants/services.ts` | no, still code |

`hooks/useServices.ts` merges the table over those constants. The constants are
the floor: a failed fetch, or an unseeded table, renders the site exactly as it
shipped rather than a blank homepage. That is also what makes `image_url = null`
mean "use the bundled photo" instead of "no photo".

## Things worth knowing before changing this

- **`services` is readable by anyone, deliberately.** The RLS policy is
  `using (true)`, not `using (is_active)`. The storefront has to tell "this
  service is switched off" apart from "this service has no row", and an RLS
  filter makes both look identical — absent — which would put a deactivated
  service back on the homepage. See the comment in
  `supabase/migrations/20260823010000_services_table.sql`.
- **The slug of a service is not the slug of its menu category.** `party-trays`
  the page vs `party-tray` the category. `constants/adminServices.ts` owns that
  mapping; nothing else should re-derive it.
- **The homepage column count follows the active services** via the `COLUMNS`
  lookup in `MealsPage.tsx`. Tailwind only emits class names it can see in the
  source, so it has to be a lookup, never `md:grid-cols-${n}`.
- **The last active orderable service can't be switched off.** The guard is in
  `ServiceIdentityForm.tsx` (`lockedOn`), not in the database.
- **Photo uploads are one year immutable** (`UPLOAD_CACHE_CONTROL` in
  `services/imageUpload.ts`). Safe because each upload writes a fresh UUID key,
  so a URL's bytes never change.

## Still open

- Reordering panels (`sort_order` has no UI).
- Editing a service's description.
- Adding or removing a service: the five slugs are still fixed by the routes and
  by the constants that supply the fallback photo and description.
