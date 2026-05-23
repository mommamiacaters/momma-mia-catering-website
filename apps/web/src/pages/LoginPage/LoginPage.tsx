import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { logo } from "../../images";

const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/account";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-brand-secondary flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 mb-6 font-poppins text-sm font-medium text-brand-text/60 transition-colors hover:text-brand-primary focus:outline-none focus:text-brand-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to home
        </Link>

        <Link to="/" className="flex justify-center mb-6">
          <img src={logo} alt="Momma Mia Caters" className="h-20 w-auto object-contain" />
        </Link>

        <div className="bg-white rounded-2xl shadow-sm p-7 md:p-9">
          <h1 className="font-arvo-bold text-2xl text-brand-text text-center">Welcome back</h1>
          <p className="font-poppins text-sm text-brand-text/60 text-center mt-1">
            Sign in to track orders and check out faster.
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
              <label htmlFor="email" className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-brand-divider bg-brand-secondary/40 px-4 py-3 font-poppins text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-poppins font-medium text-brand-text mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-brand-divider bg-brand-secondary/40 px-4 py-3 font-poppins text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-brand-primary px-4 py-3 font-arvo-bold text-white shadow-sm transition-colors hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm font-poppins text-brand-text/60">
            New here?{" "}
            <Link to="/register" className="font-medium text-brand-primary hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
