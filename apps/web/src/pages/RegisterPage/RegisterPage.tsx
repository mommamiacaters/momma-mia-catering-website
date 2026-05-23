import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { logo } from "../../images";

const RegisterPage: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    const { error, needsConfirmation } = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      phone: phone.trim() || undefined,
    });
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    if (needsConfirmation) {
      setConfirmEmail(true);
      return;
    }
    navigate("/account", { replace: true });
  };

  const inputClass =
    "w-full rounded-lg border border-brand-divider bg-brand-secondary/40 px-4 py-3 font-poppins text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent";

  return (
    <div className="min-h-screen bg-brand-secondary flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="flex justify-center mb-6">
          <img src={logo} alt="Momma Mia Caters" className="h-20 w-auto object-contain" />
        </Link>

        <div className="bg-white rounded-2xl shadow-sm p-7 md:p-9">
          {confirmEmail ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent/20">
                <i className="pi pi-envelope text-2xl text-brand-primary" aria-hidden="true" />
              </div>
              <h1 className="font-arvo-bold text-2xl text-brand-text">Check your email</h1>
              <p className="mt-2 font-poppins text-sm text-brand-text/60">
                We sent a confirmation link to <span className="font-medium">{email}</span>. Confirm it,
                then sign in.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block rounded-lg bg-brand-primary px-5 py-2.5 font-arvo-bold text-white hover:bg-brand-primary/90 cursor-pointer"
              >
                Go to sign in
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-arvo-bold text-2xl text-brand-text text-center">Create your account</h1>
              <p className="font-poppins text-sm text-brand-text/60 text-center mt-1">
                Order, track deliveries, and reorder your favorites.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm font-poppins text-red-700"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
                    Full name
                  </label>
                  <input id="fullName" type="text" autoComplete="name" required value={fullName}
                    onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Juan dela Cruz" />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
                    Email
                  </label>
                  <input id="email" type="email" autoComplete="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
                    Phone <span className="text-brand-text/40">(optional)</span>
                  </label>
                  <input id="phone" type="tel" autoComplete="tel" value={phone}
                    onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="+63 917 000 0000" />
                </div>
                <div>
                  <label htmlFor="password" className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
                    Password
                  </label>
                  <input id="password" type="password" autoComplete="new-password" required value={password}
                    onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="At least 6 characters" />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-brand-primary px-4 py-3 font-arvo-bold text-white shadow-sm transition-colors hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {submitting ? "Creating account…" : "Create account"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm font-poppins text-brand-text/60">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-brand-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
