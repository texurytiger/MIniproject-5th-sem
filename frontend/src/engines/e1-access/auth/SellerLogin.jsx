import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth, homeFor } from '../../../app/AuthContext';
import { DEMO_PW, DemoAccounts, FieldError, PasswordInput, SignInError, useSignIn, AlreadySignedIn } from './shared';
import AuthShell from './AuthShell';
import { BRAND } from '../../../config';

/** FR-02 Seller Central sign-in (portal staff, role SELLER), in the BAGUETTE sign-in card. */
export default function SellerLogin() {
  const { me } = useAuth();
  const { signIn, busy, error, fieldErr, setFieldErr, clearField } = useSignIn('staff', 'SELLER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  if (me) return <AuthShell title="Already signed in"><AlreadySignedIn wanted={['SELLER']} /></AuthShell>;

  const submit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setFieldErr({ ...(!email.trim() ? { email: 'Enter your email' } : {}), ...(!password ? { password: 'Enter your password' } : {}) });
      return;
    }
    signIn(email, password);
  };

  return (
    <AuthShell
      title="Seller Central"
      sub="Run your shop: listings, stock, your shop page and how it is doing."
      headline={['Your shop,', 'freshly', 'baked']}
      foot={<>Seller accounts are created by the {BRAND.name} team. Shopping instead? <Link to="/login">Customer sign-in</Link></>}
    >
      <SignInError error={error} />
      <form onSubmit={submit} noValidate className="bg-auth-form">
        <label htmlFor="em">Email address</label>
        <input id="em" type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearField('email'); }} autoComplete="username" autoFocus className={fieldErr.email ? 'bad' : ''} />
        <FieldError>{fieldErr.email && (fieldErr.email.startsWith('is ') ? `Email ${fieldErr.email}` : fieldErr.email)}</FieldError>
        <label htmlFor="pw">Password</label>
        <PasswordInput id="pw" value={password} onChange={(e) => { setPassword(e.target.value); clearField('password'); }} invalid={!!fieldErr.password} />
        <FieldError>{fieldErr.password}</FieldError>
        <div className="bg-auth-submit"><button className="bg-btn cream" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to Seller Central'}</button></div>
      </form>
      <DemoAccounts
        dark
        accounts={[['seller1@team3.test', 'Kavya Crafts'], ['seller2@team3.test', 'Nilgiri Goods'], ['customer@team3.test', 'Customer (wrong page)']]}
        onPick={(em) => { setEmail(em); setPassword(DEMO_PW); }}
      />
    </AuthShell>
  );
}
