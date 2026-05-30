import React, { useEffect, useMemo, useState } from "react";
import {
  fetchCompanyProfile,
  updateCompanyProfile,
  type CompanyProfile,
  type CompanyProfilePatch,
} from "../../services/companyProfileService";

type Form = {
  business_name: string;
  order_notification_email: string;
  contact_email: string;
  contact_phone: string;
  address: string;
};

const EMPTY: Form = {
  business_name: "",
  order_notification_email: "",
  contact_email: "",
  contact_phone: "",
  address: "",
};

const toForm = (p: CompanyProfile): Form => ({
  business_name: p.business_name ?? "",
  order_notification_email: p.order_notification_email ?? "",
  contact_email: p.contact_email ?? "",
  contact_phone: p.contact_phone ?? "",
  address: p.address ?? "",
});

const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

/**
 * Company Profile — admin-editable business info backed by public.company_profile.
 * The order-notification email is the inbox the SERVER notifies on every order
 * (via the order-notify trigger → n8n). Other fields are contact details.
 */
const AdminCompanyProfile: React.FC = () => {
  const [saved, setSaved] = useState<Form>(EMPTY);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const f = toForm(await fetchCompanyProfile());
      setSaved(f);
      setForm(f);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load company profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // Explicit per-key compare over the EMPTY shape's keys — JSON.stringify is
  // key-order-fragile and quietly breaks if Form gains a new field that the
  // toForm() default doesn't initialise the same way.
  const dirty = useMemo(
    () => (Object.keys(EMPTY) as (keyof Form)[]).some((k) => form[k] !== saved[k]),
    [form, saved],
  );
  const emailValid = isEmail(form.order_notification_email);
  // Contact email is optional — empty is fine, but if filled it must be valid.
  // Until now the `type="email"` attribute did nothing because the save button
  // is `type="button"` (no form submit → no native validation).
  const contactEmailValid = !form.contact_email.trim() || isEmail(form.contact_email);

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSave = async () => {
    if (!emailValid || !contactEmailValid || !form.business_name.trim()) return;
    setSaving(true);
    setSavedFlash(false);
    setError(null);
    try {
      const patch: CompanyProfilePatch = {
        business_name: form.business_name.trim(),
        order_notification_email: form.order_notification_email.trim(),
        contact_email: form.contact_email.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        address: form.address.trim() || null,
      };
      await updateCompanyProfile(patch);
      setSaved(form);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-arvo-bold text-2xl text-brand-text mb-1">Company Profile</h1>
      <p className="font-poppins text-sm text-brand-text/60 mb-6">
        Business details and the inbox that receives an email for every new order.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-8 h-8 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-brand-divider p-6 space-y-5">
          <Field label="Business name" required>
            <input type="text" value={form.business_name} onChange={set("business_name")} className={inputClass} />
          </Field>

          <Field
            label="Order notification email"
            required
            hint="Every new order (web + mobile) sends an email here."
          >
            <input
              type="email"
              value={form.order_notification_email}
              onChange={set("order_notification_email")}
              placeholder="mommamiacaters@gmail.com"
              className={`${inputClass} ${
                form.order_notification_email && !emailValid ? "border-red-400 focus:ring-red-400" : ""
              }`}
            />
            {form.order_notification_email && !emailValid && (
              <span className="mt-1 block font-poppins text-xs text-red-600">Enter a valid email address.</span>
            )}
          </Field>

          <Field label="Contact email" hint="Shown to customers (optional).">
            <input
              type="email"
              value={form.contact_email}
              onChange={set("contact_email")}
              className={`${inputClass} ${
                form.contact_email && !contactEmailValid ? "border-red-400 focus:ring-red-400" : ""
              }`}
            />
            {form.contact_email && !contactEmailValid && (
              <span className="mt-1 block font-poppins text-xs text-red-600">Enter a valid email address.</span>
            )}
          </Field>

          <Field label="Contact phone">
            <input type="tel" value={form.contact_phone} onChange={set("contact_phone")} className={inputClass} />
          </Field>

          <Field label="Address">
            <input type="text" value={form.address} onChange={set("address")} className={inputClass} />
          </Field>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saving || !emailValid || !contactEmailValid || !form.business_name.trim()}
              className="rounded-lg bg-brand-primary px-5 py-2.5 font-arvo-bold text-sm text-white transition-colors hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? "Saving…" : savedFlash ? "Saved ✓" : "Save changes"}
            </button>
            {dirty && !saving && (
              <span className="font-poppins text-xs text-brand-text/50">Unsaved changes</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const inputClass =
  "w-full rounded-lg border border-brand-divider bg-brand-secondary/40 px-3 py-2 font-poppins text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent";

const Field: React.FC<{ label: string; required?: boolean; hint?: string; children: React.ReactNode }> = ({
  label,
  required,
  hint,
  children,
}) => (
  <div>
    <label className="block font-arvo-bold text-brand-text text-sm mb-1.5">
      {label}
      {required && <span className="text-brand-primary"> *</span>}
    </label>
    {children}
    {hint && <span className="mt-1 block font-poppins text-xs text-brand-text/55">{hint}</span>}
  </div>
);

export default AdminCompanyProfile;
