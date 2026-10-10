import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Field } from '../components/ui';

type Mode = 'signin' | 'signup' | 'verify' | 'forgot' | 'reset-code' | 'new-password';

const friendly = (msg: string) =>
  /invalid login/i.test(msg)
    ? 'That email and password don’t match.'
    : /email not confirmed/i.test(msg)
      ? 'Please confirm your email first: use the code we sent.'
      : /expired|invalid.*(otp|token)/i.test(msg)
        ? 'That code didn’t work or has expired. Ask for a new one.'
        : /rate limit/i.test(msg)
          ? 'Too many emails were sent just now. Please wait a few minutes and try again.'
          : /fetch|network/i.test(msg)
            ? 'No connection. Connect to the internet to sign in.'
            : msg;

/** Sign in, create an account, and reset a password, all with 6-digit email codes (no links). */
export default function SignIn() {
  const { setRecovering } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function run(fn: () => Promise<{ error: { message: string } | null }>, next?: Mode, note = '') {
    setBusy(true);
    setMsg('');
    try {
      const { error } = await fn();
      if (error) setMsg(friendly(error.message));
      else {
        if (next) setMode(next);
        setMsg(note);
      }
    } catch (e) {
      setMsg(friendly((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const go = (m: Mode) => {
    setMode(m);
    setMsg('');
    setCode('');
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (mode === 'signin') run(() => supabase.auth.signInWithPassword({ email: em, password }));
    if (mode === 'signup')
      run(() => supabase.auth.signUp({ email: em, password }), 'verify', `We emailed a 6-digit code to ${em}.`);
    if (mode === 'verify') run(() => supabase.auth.verifyOtp({ email: em, token: code.trim(), type: 'signup' }));
    if (mode === 'forgot')
      run(() => supabase.auth.resetPasswordForEmail(em), 'reset-code', `If ${em} has an account, we emailed it a 6-digit code.`);
    if (mode === 'reset-code') {
      // The code signs them in; keep showing this screen until the new password is saved.
      setRecovering(true);
      run(async () => {
        const r = await supabase.auth.verifyOtp({ email: em, token: code.trim(), type: 'recovery' });
        if (r.error) setRecovering(false);
        return r;
      }, 'new-password');
    }
    if (mode === 'new-password')
      run(async () => {
        const r = await supabase.auth.updateUser({ password });
        if (!r.error) setRecovering(false);
        return r;
      });
  }

  const title = {
    signin: 'Sign in',
    signup: 'Create your account',
    verify: 'Check your email',
    forgot: 'Reset your password',
    'reset-code': 'Check your email',
    'new-password': 'Choose a new password',
  }[mode];

  return (
    <div className="signin">
      <div className="signin-brand">⛳ Golf Tracker</div>
      <form className="card stack" onSubmit={submit}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        {msg && <p className="small" style={{ margin: 0 }}>{msg}</p>}

        {(mode === 'signin' || mode === 'signup' || mode === 'forgot') && (
          <Field label="Email">
            <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        )}
        {(mode === 'signin' || mode === 'signup' || mode === 'new-password') && (
          <Field label={mode === 'signin' ? 'Password' : 'Password (at least 8 characters)'}>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'signin' ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        {(mode === 'verify' || mode === 'reset-code') && (
          <Field label="6-digit code">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </Field>
        )}

        <button type="submit" className="primary block" disabled={busy}>
          {busy ? 'One moment…' : { signin: 'Sign in', signup: 'Create account', verify: 'Confirm', forgot: 'Email me a code', 'reset-code': 'Continue', 'new-password': 'Save password' }[mode]}
        </button>

        {mode === 'signin' && (
          <div className="row between small">
            <a href="#" onClick={(e) => (e.preventDefault(), go('forgot'))}>
              Forgot password?
            </a>
            <a href="#" onClick={(e) => (e.preventDefault(), go('signup'))}>
              Create an account
            </a>
          </div>
        )}
        {mode === 'verify' && (
          <a href="#" className="small" onClick={(e) => (e.preventDefault(), run(() => supabase.auth.resend({ type: 'signup', email: email.trim() }), undefined, 'Sent a new code.'))}>
            Send a new code
          </a>
        )}
        {mode !== 'signin' && mode !== 'new-password' && (
          <a href="#" className="small" onClick={(e) => (e.preventDefault(), go('signin'))}>
            ‹ Back to sign in
          </a>
        )}
      </form>
      <p className="muted small" style={{ textAlign: 'center' }}>
        Your golfers, rounds and stats are saved to your account so they're backed up and on all your devices. Only you can see them.
      </p>
    </div>
  );
}
