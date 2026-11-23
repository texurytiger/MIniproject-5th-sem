import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth, homeFor } from '../../../app/AuthContext';
import { DEMO_PW, DemoAccounts, FieldError, PasswordInput, SignInError, useSignIn, AlreadySignedIn } from './shared';
import AuthShell from './AuthShell';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** FR-02 customer sign-in, in the BAGUETTE "Login & register" card. */
export default function CustomerLogin() {
  const { me, notice } = useAuth();
  const { signIn, busy, error, fieldErr, setFieldErr, setError, clearField } = useSignIn('staff', 'CUSTOMER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (me) return <AuthShell title="Already signed in"><AlreadySignedIn wanted={['CUSTOMER']} /></AuthShell>;

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!email.trim()) errs.email = 'Enter your email address';
    else if (!EMAIL.test(email.trim())) errs.email = "That doesn't look like an email address. Check for typos.";
    if (!password) errs.password = 'Enter your password';
    if (Object.keys(errs).length) { setFieldErr(errs); return; }
    setError(null);
    signIn(email, password);
  };

  return (
    <AuthShell title="Login & register" foot={<>New here? <Link to="/register">Create your account</Link></>}>
      {notice && <div className="auth-note">{notice}</div>}
      <SignInError error={error} />
      <form onSubmit={submit} noValidate className="bg-auth-form">
        <label htmlFor="em">Email address</label>
        <input id="em" type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearField('email'); }} autoComplete="username" autoFocus className={fieldErr.email ? 'bad' : ''} aria-invalid={!!fieldErr.email} />
        <FieldError>{fieldErr.email}</FieldError>
        <label htmlFor="pw">Password</label>
        <PasswordInput id="pw" value={password} onChange={(e) => { setPassword(e.target.value); clearField('password'); }} invalid={!!fieldErr.password} />
        <FieldError>{fieldErr.password}</FieldError>
        <div className="bg-auth-submit"><button className="bg-btn cream" disabled={busy}>{busy ? 'Signing in…' : 'Submit'}</button></div>
      </form>
      <DemoAccounts
        dark
        accounts={[['customer@team3.test', 'Customer'], ['inactive@team3.test', 'Deactivated customer'], ['seller1@team3.test', 'Seller (wrong page)']]}
        onPick={(em) => { setEmail(em); setPassword(DEMO_PW); setError(null); setFieldErr({}); }}
      />
    </AuthShell>
  );
}
