import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/AuthContext';
import Icon from '../../../app/Icons';
import AuthShell from './AuthShell';
import { FieldError, PasswordInput, SignInError, AlreadySignedIn } from './shared';
import { BRAND } from '../../../config';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toSlug(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

/**
 * Seller Central account registration.
 * Creates an account with role SELLER and initializes the seller's 1:1 shop storefront.
 */
export default function SellerRegister() {
  const { me, registerSeller } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    shopName: '',
    shopSlug: '',
    password: '',
    confirm: '',
  });
  const [slugCustomized, setSlugCustomized] = useState(false);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (me) return <AuthShell title="Already signed in"><AlreadySignedIn wanted={['SELLER']} /></AuthShell>;

  const set = (k) => (e) => {
    const val = e.target.value;
    const next = { ...form, [k]: val };
    if (k === 'shopName' && !slugCustomized) {
      next.shopSlug = toSlug(val);
    }
    setForm(next);
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const setSlug = (e) => {
    setSlugCustomized(true);
    setForm({ ...form, shopSlug: toSlug(e.target.value) });
    setErrors((x) => ({ ...x, shopSlug: undefined }));
  };

  const blur = (k) => () => setTouched({ ...touched, [k]: true });

  const rules = {
    len: form.password.length >= 8,
    mix: /[A-Za-z]/.test(form.password) && /\d/.test(form.password),
  };

  const confirmBad = form.confirm.length > 0 && !form.password.startsWith(form.confirm);
  const confirmShort = form.confirm.length > 0 && !confirmBad && form.confirm !== form.password;
  const confirmOk = form.confirm.length > 0 && form.confirm === form.password;

  const live = {
    name: touched.name && form.name.trim().length < 2 ? 'Enter your full name (2–80 characters)' : null,
    email: touched.email && form.email && !EMAIL.test(form.email.trim()) ? "That doesn't look like an email address" : null,
    shopName: touched.shopName && form.shopName.trim().length < 2 ? 'Enter your shop or brand name (at least 2 characters)' : null,
    shopSlug: touched.shopSlug && form.shopSlug && (!SLUG.test(form.shopSlug) || form.shopSlug.length < 3) ? 'Use 3–60 lowercase letters, numbers, and dashes (e.g. kavya-crafts)' : null,
    password: touched.password && form.password && !(rules.len && rules.mix) ? "Your password doesn't meet the rules below yet" : null,
    confirm: confirmBad ? "Passwords don't match" : touched.confirm && confirmShort ? "Passwords don't match yet" : null,
  };
  const err = (k) => errors[k] || live[k];

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setTouched({ name: true, email: true, shopName: true, shopSlug: true, password: true, confirm: true });

    const f = {};
    if (form.name.trim().length < 2) f.name = 'Enter your first and last name';
    if (!EMAIL.test(form.email.trim())) f.email = form.email ? "That doesn't look like an email address" : 'Enter your email address';
    if (form.shopName.trim().length < 2) f.shopName = 'Enter your shop name';
    const computedSlug = form.shopSlug || toSlug(form.shopName);
    if (!SLUG.test(computedSlug) || computedSlug.length < 3) f.shopSlug = 'Use 3–60 lowercase letters, numbers, and hyphens';
    if (!(rules.len && rules.mix)) f.password = 'Choose a password that meets the rules below';
    if (form.confirm !== form.password) f.confirm = "Passwords don't match";

    if (Object.keys(f).length) {
      setErrors(f);
      return;
    }

    setBusy(true);
    try {
      await registerSeller(form.name.trim(), form.email.trim(), form.password, form.shopName.trim(), computedSlug);
      navigate('/seller');
    } catch (ex) {
      if (ex.ours) {
        setError({ ours: true, text: ex.message, dev: ex.devInfo });
      } else if (ex.code === 'EMAIL_TAKEN') {
        setErrors({ email: 'An account already uses this email. Sign in instead, or use another email.' });
      } else if (ex.code === 'SLUG_TAKEN') {
        setErrors({ shopSlug: 'That shop web address is already taken. Try a different name or suffix.' });
      } else if (ex.details) {
        setErrors(Object.fromEntries(Object.entries(ex.details).map(([k, v]) => [k, `${k[0].toUpperCase()}${k.slice(1)} ${v}`])));
      } else {
        setError({ text: ex.message });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Open your shop"
      sub="Register as a verified seller: manage your inventory, customize your storefront, and reach customers."
      headline={['Your shop,', 'freshly', 'baked']}
      foot={
        <>
          Already registered as a seller? <Link to="/seller/login">Sign in to Seller Central</Link> · Shopping instead? <Link to="/login">Customer sign-in</Link>
        </>
      }
    >
      <SignInError error={error} />
      <div className="bg-auth-form">
        <form onSubmit={submit} noValidate>
          <label htmlFor="nm">Your full name</label>
          <input
            id="nm"
            value={form.name}
            onChange={set('name')}
            onBlur={blur('name')}
            autoComplete="name"
            placeholder="e.g. Kavya Sharma"
            autoFocus
            className={err('name') ? 'bad' : ''}
            aria-invalid={!!err('name')}
          />
          <FieldError>{err('name')}</FieldError>

          <label htmlFor="em">Business or personal email</label>
          <input
            id="em"
            type="email"
            value={form.email}
            onChange={set('email')}
            onBlur={blur('email')}
            autoComplete="email"
            placeholder="seller@domain.com"
            className={err('email') ? 'bad' : ''}
            aria-invalid={!!err('email')}
          />
          {err('email') && (
            <FieldError>
              {err('email')}
              {errors.email && errors.email.startsWith('An account') && <> <Link to="/seller/login">Sign in</Link></>}
            </FieldError>
          )}

          <label htmlFor="shnm">Shop / Brand name</label>
          <input
            id="shnm"
            value={form.shopName}
            onChange={set('shopName')}
            onBlur={blur('shopName')}
            placeholder="e.g. Kavya Crafts"
            className={err('shopName') ? 'bad' : ''}
            aria-invalid={!!err('shopName')}
          />
          <FieldError>{err('shopName')}</FieldError>

          <label htmlFor="shsl">Store web address (URL slug)</label>
          <input
            id="shsl"
            value={form.shopSlug}
            onChange={setSlug}
            onBlur={blur('shopSlug')}
            placeholder="e.g. kavya-crafts"
            className={err('shopSlug') ? 'bad' : ''}
            aria-invalid={!!err('shopSlug')}
          />
          <small className="muted" style={{ display: 'block', fontSize: '12px', marginTop: '3px' }}>
            Public store URL: <code>/shop/{form.shopSlug || 'your-shop-name'}</code>
          </small>
          <FieldError>{err('shopSlug')}</FieldError>

          <label htmlFor="pw">Password</label>
          <PasswordInput
            id="pw"
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            invalid={!!err('password')}
            ok={rules.len && rules.mix}
          />
          <ul className="pw-rules">
            <li className={rules.len ? 'ok' : touched.password ? 'no' : ''}>
              <Icon name={rules.len ? 'check' : 'x'} />
              At least 8 characters
            </li>
            <li className={rules.mix ? 'ok' : touched.password ? 'no' : ''}>
              <Icon name={rules.mix ? 'check' : 'x'} />
              Letters and at least one number
            </li>
          </ul>

          <label htmlFor="pw2">Re-enter password</label>
          <div onBlur={blur('confirm')}>
            <PasswordInput
              id="pw2"
              value={form.confirm}
              onChange={set('confirm')}
              autoComplete="new-password"
              invalid={!!err('confirm')}
              ok={confirmOk}
            />
          </div>
          {confirmOk ? (
            <span className="field-ok">
              <Icon name="check" />
              Passwords match
            </span>
          ) : (
            <FieldError>{err('confirm')}</FieldError>
          )}

          <div className="bg-auth-submit">
            <button className="bg-btn cream" disabled={busy}>
              {busy ? 'Creating seller account…' : 'Open my shop & start selling'}
            </button>
          </div>
        </form>
        <p className="auth-fine">
          Your password is encrypted with bcrypt before being stored. No one, including the {BRAND.name} team, can see your password.
        </p>
      </div>
    </AuthShell>
  );
}

