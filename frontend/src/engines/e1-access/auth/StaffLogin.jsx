import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from './AuthShell';
import { useAuth } from '../../../app/AuthContext';
import { api } from '../../../app/api';
import Icon from '../../../app/Icons';
import { Wordmark } from '../../../storefront/StoreLayout';
import { DEMO_PW, DemoAccounts, FieldError, PasswordInput, SignInError, useSignIn, AlreadySignedIn } from './shared';
import { BRAND } from '../../../config';

const LABEL = { FINANCE: 'Finance', WAREHOUSE_STAFF: 'Warehouse', CEO: 'Leadership' };

/**
 * FR-02 internal staff sign-in. No team picker: the staff member types their work email and password,
 * and the server reads their team (role) from their account. Only roles marked staff_login = 1 may use this page.
 */
export default function StaffLogin() {
  const { me, notice } = useAuth();
  const [teams, setTeams] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, busy, error, fieldErr, setFieldErr, clearField } = useSignIn('staff');

  // Only used to tell people which teams sign in here; it does not change how sign-in works.
  useEffect(() => { api('/auth/staff-roles', { auth: false }).then((d) => setTeams(d.roles.map((r) => LABEL[r.name] || r.name))).catch(() => setTeams([])); }, []);
  if (me) return <AuthShell title="Already signed in"><AlreadySignedIn wanted={['FINANCE', 'WAREHOUSE_STAFF', 'CEO']} /></AuthShell>;

  const submit = (e) => {
    e.preventDefault();
    const f = {};
    if (!email.trim()) f.email = 'Enter your work email';
    if (!password) f.password = 'Enter your password';
    if (Object.keys(f).length) { setFieldErr(f); return; }
    signIn(email, password);
  };

  return (
    <div className="staff-auth">
      <header className="st-top">
        <Wordmark sub="ops" />
        <span className="st-tag">Internal</span>
        <span className="spacer" />
        <Link to="/">Customer site</Link>
      </header>
      <main className="st-main">
        <div className="st-card">
          <h1>Staff sign-in</h1>
          <p className="muted small">For {BRAND.short} employees. Sign in with your work email: your team is picked up from your account.</p>
          {teams.length > 0 && <p className="st-teams">Teams that sign in here: {teams.join(' · ')}</p>}
          {notice && <div className="auth-note">{notice}</div>}
          <SignInError error={error} />
          <form onSubmit={submit} noValidate>
            <label htmlFor="em">Work email</label>
            <input id="em" type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearField('email'); }} autoComplete="username" placeholder="name@company.com" className={fieldErr.email ? 'bad' : ''} />
            <FieldError>{fieldErr.email && (fieldErr.email.startsWith('is ') ? `Email ${fieldErr.email}` : fieldErr.email)}</FieldError>
            <label htmlFor="pw">Password</label>
            <PasswordInput id="pw" value={password} onChange={(e) => { setPassword(e.target.value); clearField('password'); }} invalid={!!fieldErr.password} />
            <FieldError>{fieldErr.password}</FieldError>
            <button className="btn primary block lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p className="st-legal"><Icon name="shield" />Authorised staff only. Every sign-in attempt, allowed or refused, is written to the audit log.</p>
          <DemoAccounts
            accounts={[['finance@team3.test', 'Finance'], ['warehouse@team3.test', 'Warehouse'], ['ceo@team3.test', 'CEO (no permissions)'], ['seller1@team3.test', 'A seller tries staff (fails)']]}
            onPick={(em) => { setEmail(em); setPassword(DEMO_PW); }}
          />
        </div>
      </main>
    </div>
  );
}
