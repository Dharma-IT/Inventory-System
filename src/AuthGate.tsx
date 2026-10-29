import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import "./AuthGate.css";

export default function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      setPassword("");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(error.code === "invalid_credentials" ? "Email or password is incorrect." : error.message);
    } catch {
      setError("Unable to connect. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="auth-loading" role="status">Connecting to your workspace…</div>;
  if (session) return children(session);

  return <div className="auth-page">
    <section className="auth-story">
      <div className="auth-brand"><img src="/Logo.png" alt="" /><div><strong>DHARMA</strong><span>Inventory & operations</span></div></div>
      <div className="auth-story-copy"><p className="auth-eyebrow">YOUR OPERATIONS, CONNECTED</p><h1>A clear view of<br />what’s in stock.</h1><p>Keep inventory, stock movements, and daily fulfillment in one place.</p><div className="auth-story-line" /><span>Built for the Dharma team.</span></div>
      <span className="auth-footer">DHARMA · INVENTORY MANAGEMENT</span>
    </section>
    <section className="auth-panel" aria-labelledby="signin-title">
      <div className="auth-card"><p className="auth-eyebrow">TEAM ACCESS</p><h2 id="signin-title">Welcome back</h2><p className="auth-description">Sign in to your inventory workspace.</p>
        <form onSubmit={signIn}>
          <label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="username" placeholder="you@dharma.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={submitting} />
          <label htmlFor="password">Password</label><div className="auth-password"><input id="password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={e => setPassword(e.target.value)} disabled={submitting} /><button type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? "Hide" : "Show"}</button></div>
          {!supabase && <p className="auth-error" role="alert">Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY, then restart the app.</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={submitting || !supabase}>{submitting ? "Signing in…" : "Sign in"}<span aria-hidden="true">→</span></button>
        </form>
        <p className="auth-help">Need access? Contact your workspace administrator.</p><div className="auth-security">Secured with Supabase Authentication</div>
      </div>
    </section>
  </div>;
}
