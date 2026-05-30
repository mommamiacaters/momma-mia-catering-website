// Company Profile — a SINGLE-ROW config (public.company_profile) the business
// edits from the admin console. Holds the official order-notification email
// (used server-side by the order-notify trigger) plus contact details.
import { supabase } from "../lib/supabase";

export interface CompanyProfile {
  business_name: string;
  order_notification_email: string;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  updated_at: string;
}

export type CompanyProfilePatch = Partial<
  Pick<
    CompanyProfile,
    "business_name" | "order_notification_email" | "contact_email" | "contact_phone" | "address"
  >
>;

/** Admin read of the singleton profile row. */
export async function fetchCompanyProfile(): Promise<CompanyProfile> {
  const { data, error } = await supabase
    .from("company_profile")
    .select("business_name, order_notification_email, contact_email, contact_phone, address, updated_at")
    .eq("id", true)
    .single();
  if (error) throw error;
  return data;
}

/** Admin update of the singleton profile row. */
export async function updateCompanyProfile(patch: CompanyProfilePatch): Promise<void> {
  const { error } = await supabase.from("company_profile").update(patch).eq("id", true);
  if (error) throw error;
}
