import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart, Plus, Minus, X, Check, MapPin, Store, User, Phone,
  Package, Upload, Settings, ArrowLeft, Trash2, Edit2, LogOut,
  ChevronRight, ShieldCheck, RefreshCw, Copy, CheckCircle2, Clock,
  XCircle, PackageCheck, PlusCircle, ImageOff
} from 'lucide-react';
import { loadJSON, saveJSON } from './supabaseClient.js';

/* ---------------------------------- tokens ---------------------------------- */
const C = {
  blue: '#1856C9',
  blueDark: '#0F3D8F',
  blueSoft: '#EAF1FD',
  orange: '#FF7A29',
  orangeSoft: '#FFEEE1',
  bg: '#F4F7FC',
  card: '#FFFFFF',
  text: '#152238',
  sub: '#64748B',
  line: '#E4EAF3',
  green: '#16A34A',
  greenSoft: '#E9F9EF',
  amber: '#D97706',
  amberSoft: '#FEF3E0',
  red: '#DC2626',
  redSoft: '#FDEAEA',
};

const CARD_NUMBER = '5239 1517 1346 1054';
const SUPPORT_PHONE = '+994 10 385 05 41';
const PREPAY_AMOUNT = 20;

const STATUS = {
  pending: { label: 'Sorğu göndərildi', icon: Clock, color: '#5B6B85', bg: '#EEF1F6' },
  accepted: { label: 'Sifariş qəbul olundu', icon: CheckCircle2, color: C.blue, bg: C.blueSoft },
  preparing: { label: 'Sifariş hazırlanır', icon: Package, color: C.amber, bg: C.amberSoft },
  completed: { label: 'Sifariş tamamlandı', icon: PackageCheck, color: C.green, bg: C.greenSoft },
  cancelled: { label: 'Sifariş ləğv edildi', icon: XCircle, color: C.red, bg: C.redSoft },
};
// Primary flow shown as one-tap actions in admin: pending -> preparing -> completed.
// "accepted" stays available as a manual option for finer-grained status control.
const PRIMARY_NEXT = { pending: { to: 'preparing', label: 'Sifarişi Təsdiqlə' }, preparing: { to: 'completed', label: 'Sifarişi Tamamla' } };

const DEFAULT_PRODUCTS = [
  { id: 'p1', name: 'Classic Məktəb Çantası', category: 'school', price: 45, stock: 24, emoji: '🎒' },
  { id: 'p2', name: 'Ortopedik Məktəb Çantası', category: 'school', price: 62, stock: 15, emoji: '🎒' },
  { id: 'p3', name: 'Kiçik Sinif Çantası', category: 'school', price: 38, stock: 30, emoji: '🎒' },
  { id: 'p4', name: 'Su Keçirməz Məktəb Çantası', category: 'school', price: 55, stock: 0, emoji: '🎒' },
  { id: 'p5', name: 'Trolleyli Məktəb Çantası', category: 'school', price: 78, stock: 10, emoji: '🧳' },
  { id: 'p6', name: 'Pyeneks Məktəb Dəsti', category: 'school', price: 49, stock: 18, emoji: '🎒' },
  { id: 'p7', name: 'İdman Bel Çantası', category: 'sport', price: 32, stock: 22, emoji: '🏃' },
  { id: 'p8', name: 'Fitness Trenajor Çantası', category: 'sport', price: 41, stock: 12, emoji: '💪' },
  { id: 'p9', name: 'Futbol Ləvazimat Çantası', category: 'sport', price: 47, stock: 9, emoji: '⚽' },
  { id: 'p10', name: 'Yoga & Fitness Çantası', category: 'sport', price: 29, stock: 0, emoji: '🧘' },
  { id: 'p11', name: 'Turist Sport Çantası', category: 'sport', price: 68, stock: 14, emoji: '🏕️' },
  { id: 'p12', name: 'Basketbol Komanda Çantası', category: 'sport', price: 53, stock: 7, emoji: '🏀' },
];

const ADMIN_PIN = '4114';

function resizeImageToDataUrl(file, maxWidth = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function money(n) {
  return `${Number(n).toFixed(2)} AZN`;
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' });
}
function genOrderId(existing) {
  const n = existing.length + 1;
  return 'SF-' + String(1000 + n);
}

/* ---------------------------------- small UI atoms ---------------------------------- */
function Badge({ children, color, bg }) {
  return (
    <span style={{ color, background: bg }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold">
      {children}
    </span>
  );
}

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.accepted;
  const Icon = s.icon;
  return (
    <Badge color={s.color} bg={s.bg}>
      <Icon size={13} strokeWidth={2.5} />
      {s.label}
    </Badge>
  );
}

function PrimaryButton({ children, onClick, disabled, full, type = 'button', className = '' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${full ? 'w-full' : ''} ${className} transition-all duration-150 active:scale-[0.98] rounded-2xl font-bold text-white py-3.5 px-5 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100`}
      style={{ background: disabled ? '#9CA3AF' : `linear-gradient(135deg, ${C.blue}, ${C.blueDark})`, boxShadow: disabled ? 'none' : `0 8px 20px -6px ${C.blue}66` }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      className={`${className} rounded-xl font-semibold py-2.5 px-4 border transition-colors active:scale-[0.98]`}
      style={{ borderColor: C.line, color: C.text, background: '#fff' }}
    >
      {children}
    </button>
  );
}

function Field({ label, error, children }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold mb-1.5" style={{ color: C.text }}>{label}</label>
      {children}
      {error && <p className="text-xs mt-1 font-medium" style={{ color: C.red }}>{error}</p>}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="w-full rounded-xl px-4 py-3 text-[15px] outline-none border-2 transition-colors focus:border-blue-500"
      style={{ borderColor: props.error ? C.red : C.line, background: '#fff', color: C.text, ...(props.style || {}) }}
    />
  );
}

/* ---------------------------------- App ---------------------------------- */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);

  const [mode, setMode] = useState('customer'); // customer | adminGate | admin
  const [session, setSession] = useState(null); // {phone,name,surname,address,store}
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [authError, setAuthError] = useState('');
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', surname: '', phone: '', password: '' });

  const [screen, setScreen] = useState('home'); // home | cart | checkout | orders | profile | success
  const [category, setCategory] = useState('school');
  const [cart, setCart] = useState([]); // {productId, qty}
  const [bump, setBump] = useState(false);
  const [lastOrder, setLastOrder] = useState(null);

  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminTab, setAdminTab] = useState('products');

  /* ---- initial load ---- */
  const [storageWarning, setStorageWarning] = useState(false);
  const refreshAll = useCallback(async () => {
    const [p, o, u] = await Promise.all([
      loadJSON('products', null),
      loadJSON('orders', null),
      loadJSON('users', null),
    ]);
    let anyFailed = false;
    if (p.ok) {
      if (p.value === null) { setProducts(DEFAULT_PRODUCTS); saveJSON('products', DEFAULT_PRODUCTS); }
      else setProducts(p.value);
    } else {
      anyFailed = true;
      // Storage is unreachable — don't leave the shop empty on first load.
      setProducts(prev => (prev.length === 0 ? DEFAULT_PRODUCTS : prev));
    }
    if (o.ok) setOrders(o.value || []); else anyFailed = true;
    if (u.ok) setUsers(u.value || []); else anyFailed = true;
    setStorageWarning(anyFailed);
    return !anyFailed;
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshAll();
      setLoading(false);
    })();
  }, [refreshAll]);

  // Re-fetch immediately whenever the admin panel is opened, so newly placed
  // orders are never missed just because the app hadn't reloaded.
  useEffect(() => {
    if (mode === 'admin') refreshAll();
  }, [mode, refreshAll]);

  // Poll while a screen that depends on live order status is open, so both
  // the admin's order list and the customer's order status stay in sync
  // without requiring a manual refresh tap.
  useEffect(() => {
    const watchingAdminOrders = mode === 'admin' && adminTab === 'orders';
    const watchingCustomerOrders = mode === 'customer' && session && (screen === 'orders' || screen === 'success');
    if (!watchingAdminOrders && !watchingCustomerOrders) return;
    const id = setInterval(refreshAll, 4000);
    return () => clearInterval(id);
  }, [mode, adminTab, screen, session, refreshAll]);

  /* ---- cart helpers ---- */
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const cartLines = cart.map(c => {
    const prod = products.find(p => p.id === c.productId);
    return prod ? { ...c, product: prod, lineTotal: prod.price * c.qty } : null;
  }).filter(Boolean);
  const cartTotal = cartLines.reduce((s, l) => s + l.lineTotal, 0);

  function addToCart(productId, qty) {
    setCart(prev => {
      const existing = prev.find(c => c.productId === productId);
      if (existing) {
        return prev.map(c => c.productId === productId ? { ...c, qty: c.qty + qty } : c);
      }
      return [...prev, { productId, qty }];
    });
    setBump(true);
    setTimeout(() => setBump(false), 400);
  }
  function updateCartQty(productId, qty) {
    if (qty <= 0) {
      setCart(prev => prev.filter(c => c.productId !== productId));
    } else {
      setCart(prev => prev.map(c => c.productId === productId ? { ...c, qty } : c));
    }
  }
  function removeFromCart(productId) {
    setCart(prev => prev.filter(c => c.productId !== productId));
  }

  /* ---- auth ----
     Local React state is the source of truth for the current session, so the
     app is always usable even if the storage bridge is unreachable. Every
     write updates local state immediately, then tries to persist in the
     background; a persistence failure only raises storageWarning, it never
     blocks the action itself. */
  async function handleLogin() {
    setAuthError('');
    const phone = loginForm.phone.trim();
    if (!phone || !loginForm.password) { setAuthError('Telefon nömrəsi və şifrəni daxil edin.'); return; }
    const fresh = await loadJSON('users', users);
    const list = fresh.ok ? (fresh.value || []) : users;
    if (fresh.ok) setUsers(list);
    setStorageWarning(!fresh.ok);
    const user = list.find(u => u.phone === phone);
    if (!user || user.password !== loginForm.password) {
      setAuthError('Telefon nömrəsi və ya şifrə yanlışdır.');
      return;
    }
    setSession(user);
    setScreen('home');
  }
  async function handleRegister() {
    setAuthError('');
    const { name, surname, phone, password } = registerForm;
    if (!name.trim() || !surname.trim() || !phone.trim() || !password) {
      setAuthError('Bütün xanaları doldurun.');
      return;
    }
    if (password.length < 4) { setAuthError('Şifrə ən azı 4 simvol olmalıdır.'); return; }
    const fresh = await loadJSON('users', users);
    const list = fresh.ok ? (fresh.value || []) : users;
    if (list.some(u => u.phone === phone.trim())) {
      setAuthError('Bu telefon nömrəsi ilə artıq hesab var. Zəhmət olmasa daxil olun.');
      return;
    }
    const newUser = { phone: phone.trim(), password, name: name.trim(), surname: surname.trim(), createdAt: new Date().toISOString() };
    const updatedUsers = [...list, newUser];
    setUsers(updatedUsers);
    setSession(newUser);
    setScreen('home');
    const ok = await saveJSON('users', updatedUsers);
    setStorageWarning(!ok);
  }
  function logout() {
    setSession(null);
    setAuthMode('login');
    setAuthError('');
    setLoginForm({ phone: '', password: '' });
    setRegisterForm({ name: '', surname: '', phone: '', password: '' });
    setCart([]);
    setScreen('home');
  }

  async function updateProfile(fields) {
    const updated = { ...session, ...fields };
    setSession(updated);
    const updatedUsers = users.map(u => u.phone === session.phone ? updated : u);
    setUsers(updatedUsers);
    const ok = await saveJSON('users', updatedUsers);
    setStorageWarning(!ok);
  }

  /* ---- checkout ---- */
  async function submitOrder(formData, receiptDataUrl) {
    const fresh = await loadJSON('orders', orders);
    const baseOrders = fresh.ok ? (fresh.value || []) : orders;
    const id = genOrderId(baseOrders);
    const order = {
      id,
      phone: session.phone,
      name: formData.name,
      surname: formData.surname,
      address: formData.address,
      store: formData.store,
      items: cartLines.map(l => ({ productId: l.product.id, name: l.product.name, price: l.product.price, qty: l.qty })),
      total: cartTotal,
      prepaid: PREPAY_AMOUNT,
      receiptDataUrl,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const updatedOrders = [order, ...baseOrders];
    setOrders(updatedOrders);
    // Remember address/store on the profile so next time they're pre-filled
    // (they're no longer asked at registration, only at order time).
    const updatedUser = { ...session, address: formData.address, store: formData.store };
    setSession(updatedUser);
    const updatedUsers = users.map(u => u.phone === session.phone ? updatedUser : u);
    setUsers(updatedUsers);
    setCart([]);
    setLastOrder(order);
    setScreen('success');
    const [ok1, ok2] = await Promise.all([saveJSON('orders', updatedOrders), saveJSON('users', updatedUsers)]);
    setStorageWarning(!ok1 || !ok2);
    return true;
  }

  async function adminResetPassword(phone, newPassword) {
    const updatedUsers = users.map(u => u.phone === phone ? { ...u, password: newPassword } : u);
    setUsers(updatedUsers);
    if (session && session.phone === phone) setSession({ ...session, password: newPassword });
    const ok = await saveJSON('users', updatedUsers);
    setStorageWarning(!ok);
  }

  async function adminUpdateOrderStatus(orderId, status) {
    const updated = orders.map(o => o.id === orderId ? { ...o, status } : o);
    setOrders(updated);
    const ok = await saveJSON('orders', updated);
    setStorageWarning(!ok);
  }

  async function adminSaveProduct(product) {
    let updated;
    if (products.some(p => p.id === product.id)) {
      updated = products.map(p => p.id === product.id ? product : p);
    } else {
      updated = [...products, product];
    }
    setProducts(updated);
    const ok = await saveJSON('products', updated);
    setStorageWarning(!ok);
  }
  async function adminDeleteProduct(id) {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    const ok = await saveJSON('products', updated);
    setStorageWarning(!ok);
  }

  /* ---------------------------------- render ---------------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.bg }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 animate-spin" style={{ borderColor: C.blueSoft, borderTopColor: C.blue }} />
          <p style={{ color: C.sub }} className="text-sm font-medium">Yüklənir...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif' }}>
      {mode === 'customer' && (
        <CustomerApp
          session={session}
          authMode={authMode} setAuthMode={setAuthMode}
          authError={authError} setAuthError={setAuthError}
          loginForm={loginForm} setLoginForm={setLoginForm}
          registerForm={registerForm} setRegisterForm={setRegisterForm}
          handleLogin={handleLogin} handleRegister={handleRegister}
          logout={logout} updateProfile={updateProfile}
          screen={screen} setScreen={setScreen}
          category={category} setCategory={setCategory}
          products={products}
          cart={cart} cartLines={cartLines} cartCount={cartCount} cartTotal={cartTotal} bump={bump}
          addToCart={addToCart} updateCartQty={updateCartQty} removeFromCart={removeFromCart}
          submitOrder={submitOrder}
          orders={orders.filter(o => session && o.phone === session.phone)}
          lastOrder={lastOrder}
          refreshAll={refreshAll}
          storageWarning={storageWarning}
          goAdmin={() => setMode('adminGate')}
        />
      )}
      {mode === 'adminGate' && (
        <AdminGate
          value={adminPinInput} setValue={setAdminPinInput}
          onBack={() => { setMode('customer'); setAdminPinInput(''); }}
          onSuccess={() => { setMode('admin'); setAdminPinInput(''); }}
        />
      )}
      {mode === 'admin' && (
        <AdminPanel
          products={products} orders={orders} users={users}
          adminTab={adminTab} setAdminTab={setAdminTab}
          onSaveProduct={adminSaveProduct} onDeleteProduct={adminDeleteProduct}
          onUpdateOrderStatus={adminUpdateOrderStatus}
          onResetPassword={adminResetPassword}
          onRefresh={refreshAll}
          storageWarning={storageWarning}
          onExit={() => setMode('customer')}
        />
      )}
    </div>
  );
}

/* ---------------------------------- Customer App ---------------------------------- */
function CustomerApp(props) {
  const { session } = props;
  if (!session) return <AuthFlow {...props} />;

  return (
    <div className="max-w-md mx-auto pb-24 min-h-screen relative" style={{ background: C.bg }}>
      <TopBar {...props} />
      <div className="px-4 pt-4">
        {props.screen === 'home' && <HomeScreen {...props} />}
        {props.screen === 'cart' && <CartScreen {...props} />}
        {props.screen === 'checkout' && <CheckoutScreen {...props} />}
        {props.screen === 'success' && <SuccessScreen {...props} />}
        {props.screen === 'orders' && <OrdersScreen {...props} />}
        {props.screen === 'profile' && <ProfileScreen {...props} />}
      </div>
      <BottomNav {...props} />
    </div>
  );
}

function StorageWarningBanner({ onRetry }) {
  return (
    <div className="max-w-md mx-auto px-4 pt-3">
      <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2" style={{ background: C.redSoft, border: `1px solid ${C.red}55` }}>
        <p className="text-xs font-semibold" style={{ color: C.red }}>Bağlantı problemi — məlumat yenilənə bilmədi.</p>
        <button onClick={onRetry} className="text-xs font-bold shrink-0" style={{ color: C.red }}>Yenidən cəhd et</button>
      </div>
    </div>
  );
}

function TopBar({ screen, setScreen, cartCount, bump, session, goAdmin }) {
  const titles = { home: 'Sifariş Sistemi', cart: 'Səbət', checkout: 'Sifarişin Tamamlanması', success: 'Təşəkkürlər', orders: 'Sifarişlərim', profile: 'Profil' };
  const showBack = screen !== 'home';
  return (
    <div className="sticky top-0 z-30 backdrop-blur-md" style={{ background: `${C.blue}F2` }}>
      <div className="max-w-md mx-auto flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2">
          {showBack ? (
            <button onClick={() => setScreen('home')} className="text-white p-1 -ml-1 rounded-full active:bg-white/10">
              <ArrowLeft size={22} />
            </button>
          ) : (
            <SecretTapZone onUnlock={goAdmin}>
              <span className="text-xl select-none cursor-default">🎒</span>
            </SecretTapZone>
          )}
          <span className="text-white font-extrabold text-[17px] tracking-tight">{titles[screen] || 'Sifariş Sistemi'}</span>
        </div>
        <button onClick={() => setScreen('cart')} className="relative text-white p-1.5 rounded-full active:bg-white/10">
          <ShoppingCart size={23} className={bump ? 'scale-110 transition-transform' : 'transition-transform'} />
          {cartCount > 0 && (
            <span
              className="absolute -top-1 -right-1 rounded-full text-[11px] font-extrabold min-w-[19px] h-[19px] flex items-center justify-center px-1"
              style={{ background: C.orange, color: '#fff', boxShadow: '0 0 0 2px ' + C.blue }}
            >
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function BottomNav({ screen, setScreen }) {
  const items = [
    { id: 'home', label: 'Ana Səhifə', icon: Store },
    { id: 'cart', label: 'Səbət', icon: ShoppingCart },
    { id: 'orders', label: 'Sifarişlərim', icon: Package },
    { id: 'profile', label: 'Profil', icon: User },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30">
      <div className="max-w-md mx-auto bg-white border-t flex" style={{ borderColor: C.line, boxShadow: '0 -6px 20px -8px rgba(0,0,0,0.12)' }}>
        {items.map(it => {
          const Icon = it.icon;
          const active = screen === it.id || (it.id === 'home' && screen === 'success') || (it.id === 'home' && screen === 'checkout');
          return (
            <button key={it.id} onClick={() => setScreen(it.id)} className="flex-1 flex flex-col items-center gap-1 py-2.5 active:opacity-70">
              <Icon size={20} color={active ? C.blue : C.sub} strokeWidth={active ? 2.6 : 2} />
              <span className="text-[11px] font-semibold" style={{ color: active ? C.blue : C.sub }}>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Hidden admin trigger: tap the logo 5 times within 3s ---- */
function SecretTapZone({ onUnlock, children }) {
  const tapsRef = useRef([]);
  function handleTap() {
    const now = Date.now();
    tapsRef.current = [...tapsRef.current.filter(t => now - t < 3000), now];
    if (tapsRef.current.length >= 5) {
      tapsRef.current = [];
      onUnlock();
    }
  }
  return <div onClick={handleTap}>{children}</div>;
}

/* ---- Auth ---- */
function AuthFlow(props) {
  const { authMode, setAuthMode, goAdmin } = props;
  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-10 max-w-md mx-auto" style={{ background: `linear-gradient(180deg, ${C.blue} 0%, ${C.blueDark} 55%, ${C.bg} 55%)` }}>
      <div className="text-center mb-8 mt-6">
        <SecretTapZone onUnlock={goAdmin}>
          <div className="text-5xl mb-3 select-none cursor-default">🎒</div>
        </SecretTapZone>
        <h1 className="text-white text-2xl font-extrabold tracking-tight">Məktəb & Sport Çantaları</h1>
        <p className="text-white/80 text-sm mt-1 font-medium">Topdan sifariş sistemi</p>
      </div>
      <div className="bg-white rounded-3xl shadow-2xl p-6" style={{ boxShadow: '0 20px 50px -20px rgba(15,61,143,0.35)' }}>
        <div className="flex rounded-xl p-1 mb-5" style={{ background: C.bg }}>
          <button onClick={() => { setAuthMode('login'); props.setAuthError(''); }} className="flex-1 rounded-lg py-2 text-sm font-bold transition-colors"
            style={authMode === 'login' ? { background: '#fff', color: C.blue, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' } : { color: C.sub }}>
            Giriş
          </button>
          <button onClick={() => { setAuthMode('register'); props.setAuthError(''); }} className="flex-1 rounded-lg py-2 text-sm font-bold transition-colors"
            style={authMode === 'register' ? { background: '#fff', color: C.blue, boxShadow: '0 2px 6px rgba(0,0,0,0.08)' } : { color: C.sub }}>
            Qeydiyyat
          </button>
        </div>
        {authMode === 'login' ? <LoginStep {...props} /> : <RegisterStep {...props} />}
      </div>
    </div>
  );
}

function LoginStep({ loginForm, setLoginForm, authError, handleLogin }) {
  const [showForgot, setShowForgot] = useState(false);
  const set = (k) => (e) => setLoginForm({ ...loginForm, [k]: e.target.value });
  return (
    <div>
      <Field label="Telefon nömrəsi">
        <TextInput placeholder="+994 XX XXX XX XX" value={loginForm.phone} onChange={set('phone')} inputMode="tel" />
      </Field>
      <Field label="Şifrə" error={authError}>
        <TextInput type="password" placeholder="Şifrənizi daxil edin" value={loginForm.password} onChange={set('password')} />
      </Field>
      <PrimaryButton full onClick={handleLogin}>Daxil ol</PrimaryButton>
      <button onClick={() => setShowForgot(s => !s)} className="w-full text-center text-xs font-bold mt-3" style={{ color: C.blue }}>
        Şifrəni unutmusunuz?
      </button>
      {showForgot && (
        <div className="mt-3 rounded-xl p-3.5" style={{ background: C.blueSoft }}>
          <p className="text-xs font-semibold mb-2" style={{ color: C.text }}>
            Şifrənizi bərpa etmək üçün dəstək xəttinə zəng edin — əməkdaşımız şifrənizi sizin üçün yeniləyəcək.
          </p>
          <a
            href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}
            className="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white"
            style={{ background: C.blue }}
          >
            <Phone size={14} /> {SUPPORT_PHONE}
          </a>
        </div>
      )}
    </div>
  );
}

function RegisterStep({ registerForm, setRegisterForm, authError, handleRegister }) {
  const f = registerForm;
  const set = (k) => (e) => setRegisterForm({ ...f, [k]: e.target.value });
  return (
    <div>
      <Field label="Ad"><TextInput value={f.name} onChange={set('name')} placeholder="Ad" /></Field>
      <Field label="Soyad"><TextInput value={f.surname} onChange={set('surname')} placeholder="Soyad" /></Field>
      <Field label="Telefon nömrəsi"><TextInput value={f.phone} onChange={set('phone')} placeholder="+994 XX XXX XX XX" inputMode="tel" /></Field>
      <Field label="Şifrə" error={authError}><TextInput type="password" value={f.password} onChange={set('password')} placeholder="Ən azı 4 simvol" /></Field>
      <PrimaryButton full onClick={handleRegister}>Hesab Yarat</PrimaryButton>
    </div>
  );
}

/* ---- Home ---- */
function HomeScreen({ category, setCategory, products, addToCart, setScreen, cartLines, cartTotal }) {
  const filtered = products.filter(p => p.category === category);
  return (
    <div>
      <div className="flex gap-2 mb-5">
        <CategoryTab active={category === 'school'} onClick={() => setCategory('school')} label="Məktəb Çantaları" emoji="🎒" />
        <CategoryTab active={category === 'sport'} onClick={() => setCategory('sport')} label="Sport Çantaları" emoji="🏃" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-16" style={{ color: C.sub }}>
          <ImageOff size={32} className="mx-auto mb-2" />
          <p className="text-sm font-medium">Bu kateqoriyada məhsul yoxdur.</p>
        </div>
      )}
      {cartLines.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-20 px-4">
          <div className="max-w-md mx-auto">
            <button onClick={() => setScreen('cart')} className="w-full flex items-center justify-between rounded-2xl px-5 py-3.5 text-white font-bold shadow-xl active:scale-[0.98] transition-transform" style={{ background: C.orange, boxShadow: `0 10px 24px -8px ${C.orange}88` }}>
              <span className="flex items-center gap-2"><ShoppingCart size={18} /> Sifariş Ver</span>
              <span>{money(cartTotal)}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryTab({ active, onClick, label, emoji }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-2xl py-3 px-2 font-bold text-sm flex flex-col items-center gap-1 transition-all border-2"
      style={active
        ? { background: C.blue, color: '#fff', borderColor: C.blue, boxShadow: `0 8px 16px -6px ${C.blue}66` }
        : { background: '#fff', color: C.text, borderColor: C.line }}
    >
      <span className="text-lg">{emoji}</span>
      {label}
    </button>
  );
}

function ProductCard({ product, onAdd }) {
  const [qty, setQty] = useState(1);
  const outOfStock = product.stock <= 0;
  return (
    <div className="bg-white rounded-2xl p-3 shadow-sm border flex flex-col" style={{ borderColor: C.line }}>
      <div className="rounded-xl flex items-center justify-center text-4xl mb-2" style={{ background: C.blueSoft, aspectRatio: '1/1' }}>
        {product.emoji || '🎒'}
      </div>
      <p className="text-[13px] font-bold leading-snug mb-0.5" style={{ color: C.text }}>{product.name}</p>
      <p className="font-extrabold text-[15px] mb-1" style={{ color: C.blue }}>{money(product.price)}</p>
      <p className="text-[11px] font-semibold mb-2" style={{ color: outOfStock ? C.red : C.green }}>
        {outOfStock ? 'Stokda yoxdur' : `Stokda var (${product.stock})`}
      </p>
      <div className="flex items-center justify-between mb-2">
        <button disabled={outOfStock} onClick={() => setQty(q => Math.max(1, q - 1))} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold disabled:opacity-30" style={{ background: C.bg, color: C.blue }}><Minus size={14} /></button>
        <input
          disabled={outOfStock}
          value={qty}
          onChange={e => { const v = parseInt(e.target.value.replace(/\D/g, '')) || 1; setQty(Math.max(1, v)); }}
          className="w-9 text-center font-bold text-sm outline-none bg-transparent"
          style={{ color: C.text }}
          inputMode="numeric"
        />
        <button disabled={outOfStock} onClick={() => setQty(q => q + 1)} className="w-7 h-7 rounded-lg flex items-center justify-center font-bold disabled:opacity-30" style={{ background: C.bg, color: C.blue }}><Plus size={14} /></button>
      </div>
      <button
        disabled={outOfStock}
        onClick={() => { onAdd(product.id, qty); setQty(1); }}
        className="rounded-xl py-2 text-xs font-bold text-white active:scale-[0.97] transition-transform disabled:opacity-40"
        style={{ background: outOfStock ? '#9CA3AF' : C.orange }}
      >
        Səbətə Əlavə Et
      </button>
    </div>
  );
}

/* ---- Cart ---- */
function CartScreen({ cartLines, cartTotal, updateCartQty, removeFromCart, setScreen }) {
  if (cartLines.length === 0) {
    return (
      <div className="text-center py-20" style={{ color: C.sub }}>
        <ShoppingCart size={36} className="mx-auto mb-3" />
        <p className="font-semibold mb-4">Səbətiniz boşdur.</p>
        <GhostButton onClick={() => setScreen('home')}>Alış-verişə davam et</GhostButton>
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-col gap-3 mb-4">
        {cartLines.map(l => (
          <div key={l.productId} className="bg-white rounded-2xl p-3 flex gap-3 items-center shadow-sm border" style={{ borderColor: C.line }}>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: C.blueSoft }}>{l.product.emoji}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold truncate" style={{ color: C.text }}>{l.product.name}</p>
              <p className="text-xs font-medium" style={{ color: C.sub }}>{money(l.product.price)} / ədəd</p>
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={() => updateCartQty(l.productId, l.qty - 1)} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: C.bg, color: C.blue }}><Minus size={12} /></button>
                <span className="text-sm font-bold w-5 text-center" style={{ color: C.text }}>{l.qty}</span>
                <button onClick={() => updateCartQty(l.productId, l.qty + 1)} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: C.bg, color: C.blue }}><Plus size={12} /></button>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="font-extrabold text-sm" style={{ color: C.blue }}>{money(l.lineTotal)}</p>
              <button onClick={() => removeFromCart(l.productId)} style={{ color: C.red }}><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border mb-4" style={{ borderColor: C.line }}>
        <div className="flex justify-between items-center mb-3">
          <span className="font-bold" style={{ color: C.text }}>Ümumi Məbləğ</span>
          <span className="font-extrabold text-xl" style={{ color: C.blue }}>{money(cartTotal)}</span>
        </div>
        <PrimaryButton full onClick={() => setScreen('checkout')}>Sifariş Ver</PrimaryButton>
      </div>
    </div>
  );
}

/* ---- Checkout ---- */
function CheckoutScreen({ session, cartLines, cartTotal, submitOrder, setScreen }) {
  const [form, setForm] = useState({ name: session.name || '', surname: session.surname || '', address: session.address || '', store: session.store || '' });
  const [errors, setErrors] = useState({});
  const [receiptDataUrl, setReceiptDataUrl] = useState(null);
  const [receiptName, setReceiptName] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Zəhmət olmasa şəkil formatında fayl yükləyin.'); return; }
    setReceiptName(file.name);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setReceiptDataUrl(dataUrl);
    } catch (err) {
      alert('Şəkil yüklənərkən xəta baş verdi.');
    }
  }

  function copyCard() {
    navigator.clipboard?.writeText(CARD_NUMBER.replace(/\s/g, ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleSubmit() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Ad tələb olunur';
    if (!form.surname.trim()) errs.surname = 'Soyad tələb olunur';
    if (!form.address.trim()) errs.address = 'Ünvan tələb olunur';
    if (!form.store.trim()) errs.store = 'Mağaza adı tələb olunur';
    if (!receiptDataUrl) errs.receipt = 'Ödəniş çekini yükləməlisiniz';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSubmitting(true);
    const ok = await submitOrder(form, receiptDataUrl);
    if (!ok) {
      alert('Sifariş göndərilmədi — bağlantı problemi oldu. Zəhmət olmasa yenidən cəhd edin.');
    }
    setSubmitting(false);
  }

  return (
    <div className="pb-4">
      <Stepper step={2} />
      <SectionTitle icon={User}>Çatdırılma Məlumatları</SectionTitle>
      <div className="bg-white rounded-2xl p-4 shadow-sm border mb-4" style={{ borderColor: C.line }}>
        <Field label="Ad" error={errors.name}><TextInput value={form.name} onChange={set('name')} error={errors.name} /></Field>
        <Field label="Soyad" error={errors.surname}><TextInput value={form.surname} onChange={set('surname')} error={errors.surname} /></Field>
        <Field label="Telefon nömrəsi"><TextInput value={session.phone} disabled style={{ opacity: 0.6 }} /></Field>
        <Field label="Ünvan" error={errors.address}><TextInput value={form.address} onChange={set('address')} error={errors.address} /></Field>
        <Field label="Mağaza adı" error={errors.store}><TextInput value={form.store} onChange={set('store')} error={errors.store} /></Field>
      </div>

      <SectionTitle icon={ShieldCheck}>Ön Ödəniş — {money(PREPAY_AMOUNT)}</SectionTitle>
      <div className="rounded-2xl p-4 shadow-sm border mb-4" style={{ borderColor: C.orange, background: C.orangeSoft }}>
        <p className="text-xs font-semibold mb-2" style={{ color: C.text }}>Sifarişinizi təsdiqləmək üçün {money(PREPAY_AMOUNT)} ön ödəniş edin. Qalan məbləği sifariş təhvil verilərkən ödəyəcəksiniz.</p>
        <div className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5">
          <span className="font-mono font-bold text-sm tracking-wider" style={{ color: C.text }}>{CARD_NUMBER}</span>
          <button onClick={copyCard} className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg" style={{ color: C.orange, background: C.orangeSoft }}>
            {copied ? <><Check size={13} /> Kopyalandı</> : <><Copy size={13} /> Kopyala</>}
          </button>
        </div>
      </div>

      <SectionTitle icon={Upload}>Ödəniş Çeki</SectionTitle>
      <div className="bg-white rounded-2xl p-4 shadow-sm border mb-4" style={{ borderColor: errors.receipt ? C.red : C.line }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        {!receiptDataUrl ? (
          <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl border-2 border-dashed py-6 flex flex-col items-center gap-2" style={{ borderColor: C.line, color: C.sub }}>
            <Upload size={22} />
            <span className="text-sm font-semibold">Çeki Yüklə</span>
            <span className="text-[11px]">Şəkil formatı (JPG, PNG)</span>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <img src={receiptDataUrl} alt="receipt" className="w-16 h-16 rounded-xl object-cover border" style={{ borderColor: C.line }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: C.text }}>{receiptName}</p>
              <button onClick={() => fileRef.current?.click()} className="text-xs font-bold mt-1" style={{ color: C.blue }}>Şəkli dəyiş</button>
            </div>
          </div>
        )}
        {errors.receipt && <p className="text-xs mt-2 font-medium" style={{ color: C.red }}>{errors.receipt}</p>}
      </div>

      <SectionTitle icon={Package}>Sifariş Xülasəsi</SectionTitle>
      <div className="bg-white rounded-2xl p-4 shadow-sm border mb-4" style={{ borderColor: C.line }}>
        {cartLines.map(l => (
          <div key={l.productId} className="flex justify-between text-sm py-1.5 border-b last:border-0" style={{ borderColor: C.line }}>
            <span style={{ color: C.text }}>{l.product.name} × {l.qty}</span>
            <span className="font-semibold" style={{ color: C.text }}>{money(l.lineTotal)}</span>
          </div>
        ))}
        <div className="flex justify-between pt-3 font-extrabold" style={{ color: C.blue }}>
          <span>Ümumi Məbləğ</span>
          <span>{money(cartTotal)}</span>
        </div>
      </div>

      <PrimaryButton full onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Göndərilir...' : 'Sifarişi Təsdiqlə'}
      </PrimaryButton>

      <div className="text-center mt-5 text-xs" style={{ color: C.sub }}>
        Kömək və ya dəstəyə ehtiyacınız olarsa bizimlə əlaqə saxlayın:{' '}
        <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className="font-bold" style={{ color: C.blue }}>{SUPPORT_PHONE}</a>
      </div>
    </div>
  );
}

function Stepper({ step }) {
  const steps = ['Səbət', 'Məlumat', 'Ödəniş', 'Təsdiq'];
  return (
    <div className="flex items-center mb-5">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={i <= step ? { background: C.blue, color: '#fff' } : { background: C.line, color: C.sub }}
            >
              {i + 1}
            </div>
            <span className="text-[10px] font-semibold" style={{ color: i <= step ? C.blue : C.sub }}>{s}</span>
          </div>
          {i < steps.length - 1 && <div className="flex-1 h-[2px] mx-1 mb-4" style={{ background: i < step ? C.blue : C.line }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-2.5 mt-1">
      <Icon size={15} style={{ color: C.blue }} />
      <h3 className="text-[13px] font-extrabold uppercase tracking-wide" style={{ color: C.blueDark }}>{children}</h3>
    </div>
  );
}

/* ---- Success ---- */
function SuccessScreen({ lastOrder, setScreen }) {
  if (!lastOrder) return null;
  return (
    <div className="text-center py-10">
      <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: C.greenSoft }}>
        <Check size={40} style={{ color: C.green }} strokeWidth={3} />
      </div>
      <h2 className="text-xl font-extrabold mb-1" style={{ color: C.text }}>Sorğunuz göndərildi!</h2>
      <p className="text-xs mb-3" style={{ color: C.sub }}>Ödənişiniz təsdiqlənən kimi sifarişiniz hazırlanmağa başlayacaq.</p>
      <p className="text-sm mb-1" style={{ color: C.sub }}>Sifariş nömrəniz</p>
      <p className="text-2xl font-extrabold mb-6" style={{ color: C.blue }}>{lastOrder.id}</p>
      <div className="bg-white rounded-2xl p-4 shadow-sm border text-left mb-6" style={{ borderColor: C.line }}>
        <div className="flex justify-between text-sm mb-2"><span style={{ color: C.sub }}>Ümumi məbləğ</span><span className="font-bold" style={{ color: C.text }}>{money(lastOrder.total)}</span></div>
        <div className="flex justify-between text-sm mb-2"><span style={{ color: C.sub }}>Ön ödəniş</span><span className="font-bold" style={{ color: C.text }}>{money(lastOrder.prepaid)}</span></div>
        <div className="flex justify-between text-sm"><span style={{ color: C.sub }}>Status</span><StatusBadge status={lastOrder.status} /></div>
      </div>
      <PrimaryButton full onClick={() => setScreen('orders')}>Sifarişlərimə Bax</PrimaryButton>
      <button onClick={() => setScreen('home')} className="w-full text-center text-sm font-semibold mt-3" style={{ color: C.sub }}>Ana səhifəyə qayıt</button>
    </div>
  );
}

/* ---- Orders ---- */
function OrdersScreen({ orders, refreshAll }) {
  const [expanded, setExpanded] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  async function doRefresh() {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-20" style={{ color: C.sub }}>
        <Package size={36} className="mx-auto mb-3" />
        <p className="font-semibold">Hələ sifarişiniz yoxdur.</p>
      </div>
    );
  }
  return (
    <div>
      <button onClick={doRefresh} className="flex items-center gap-1.5 text-xs font-bold mb-3" style={{ color: C.blue }}>
        <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Yenilə
      </button>
      <div className="flex flex-col gap-3">
        {orders.map(o => (
          <div key={o.id} className="bg-white rounded-2xl p-4 shadow-sm border" style={{ borderColor: C.line }}>
            <button className="w-full flex items-center justify-between" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
              <div className="text-left">
                <p className="font-extrabold text-sm" style={{ color: C.text }}>{o.id}</p>
                <p className="text-xs font-medium" style={{ color: C.sub }}>{fmtDate(o.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={o.status} />
                <ChevronRight size={16} className={`transition-transform ${expanded === o.id ? 'rotate-90' : ''}`} style={{ color: C.sub }} />
              </div>
            </button>
            {expanded === o.id && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: C.line }}>
                {o.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-xs py-1">
                    <span style={{ color: C.text }}>{it.name} × {it.qty}</span>
                    <span className="font-semibold" style={{ color: C.text }}>{money(it.price * it.qty)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-extrabold pt-2" style={{ color: C.blue }}>
                  <span>Cəmi</span><span>{money(o.total)}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Profile ---- */
function ProfileScreen({ session, updateProfile, logout }) {
  const [form, setForm] = useState({ name: session.name, surname: session.surname, address: session.address, store: session.store });
  const [saved, setSaved] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    await updateProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div>
      <div className="bg-white rounded-2xl p-4 shadow-sm border mb-4" style={{ borderColor: C.line }}>
        <Field label="Ad"><TextInput value={form.name} onChange={set('name')} /></Field>
        <Field label="Soyad"><TextInput value={form.surname} onChange={set('surname')} /></Field>
        <Field label="Telefon nömrəsi"><TextInput value={session.phone} disabled style={{ opacity: 0.6 }} /></Field>
        <Field label="Ünvan"><TextInput value={form.address} onChange={set('address')} /></Field>
        <Field label="Mağaza adı"><TextInput value={form.store} onChange={set('store')} /></Field>
        <PrimaryButton full onClick={save}>{saved ? 'Yadda saxlanıldı ✓' : 'Yadda Saxla'}</PrimaryButton>
      </div>
      <GhostButton className="w-full flex items-center justify-center gap-2" onClick={logout}>
        <LogOut size={16} /> Çıxış
      </GhostButton>
      <div className="text-center mt-6 text-xs" style={{ color: C.sub }}>
        Dəstək: <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className="font-bold" style={{ color: C.blue }}>{SUPPORT_PHONE}</a>
      </div>
    </div>
  );
}

/* ---------------------------------- Admin ---------------------------------- */
function AdminGate({ value, setValue, onBack, onSuccess }) {
  const [error, setError] = useState('');
  function submit() {
    if (value === ADMIN_PIN) { onSuccess(); } else { setError('Yanlış PIN kodu.'); }
  }
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: C.blueDark }}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={20} style={{ color: C.blue }} />
          <h2 className="font-extrabold text-lg" style={{ color: C.text }}>Admin Girişi</h2>
        </div>
        <Field label="PIN kod" error={error}>
          <TextInput value={value} onChange={e => setValue(e.target.value)} type="password" placeholder="****" inputMode="numeric" />
        </Field>
        <PrimaryButton full onClick={submit}>Daxil ol</PrimaryButton>
        <button onClick={onBack} className="w-full text-center text-sm font-semibold mt-3" style={{ color: C.sub }}>Geri qayıt</button>
      </div>
    </div>
  );
}

function AdminPanel({ products, orders, users, adminTab, setAdminTab, onSaveProduct, onDeleteProduct, onUpdateOrderStatus, onResetPassword, onRefresh, storageWarning, onExit }) {
  const [refreshing, setRefreshing] = useState(false);
  async function doRefresh() { setRefreshing(true); await onRefresh(); setRefreshing(false); }

  return (
    <div className="max-w-3xl mx-auto min-h-screen pb-10">
      <div className="sticky top-0 z-30" style={{ background: C.blueDark }}>
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-white font-extrabold">
            <Settings size={19} /> Admin Panel
          </div>
          <div className="flex items-center gap-3">
            <button onClick={doRefresh} className="text-white/90"><RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} /></button>
            <button onClick={onExit} className="text-white/90 text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.15)' }}>Müştəri görünüşü</button>
          </div>
        </div>
        <div className="flex px-4 gap-1 pb-3">
          {[
            { id: 'products', label: 'Məhsullar' },
            { id: 'orders', label: 'Sifarişlər', count: orders.filter(o => o.status === 'pending').length },
            { id: 'users', label: 'İstifadəçilər' },
          ].map(t => (
            <button key={t.id} onClick={() => setAdminTab(t.id)} className="relative px-3.5 py-1.5 rounded-full text-xs font-bold"
              style={adminTab === t.id ? { background: '#fff', color: C.blueDark } : { background: 'rgba(255,255,255,0.14)', color: '#fff' }}>
              {t.label}
              {!!t.count && (
                <span className="absolute -top-1.5 -right-1.5 rounded-full text-[10px] font-extrabold min-w-[16px] h-[16px] flex items-center justify-center px-1" style={{ background: C.orange, color: '#fff' }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4 pt-4">
        {adminTab === 'products' && <AdminProducts products={products} onSave={onSaveProduct} onDelete={onDeleteProduct} />}
        {adminTab === 'orders' && <AdminOrders orders={orders} onUpdateStatus={onUpdateOrderStatus} />}
        {adminTab === 'users' && <AdminUsers users={users} orders={orders} onResetPassword={onResetPassword} />}
      </div>
    </div>
  );
}

function AdminProducts({ products, onSave, onDelete }) {
  const [editing, setEditing] = useState(null); // product or 'new'
  return (
    <div>
      <button onClick={() => setEditing({ id: 'p' + Date.now(), name: '', category: 'school', price: 0, stock: 0, emoji: '🎒' })}
        className="flex items-center gap-2 font-bold text-sm mb-4 px-4 py-2.5 rounded-xl text-white" style={{ background: C.blue }}>
        <PlusCircle size={16} /> Yeni Məhsul
      </button>
      {editing && <ProductEditor product={editing} onCancel={() => setEditing(null)} onSave={(p) => { onSave(p); setEditing(null); }} />}
      <div className="grid sm:grid-cols-2 gap-3">
        {products.map(p => (
          <div key={p.id} className="bg-white rounded-2xl p-3 shadow-sm border flex gap-3" style={{ borderColor: C.line }}>
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0" style={{ background: C.blueSoft }}>{p.emoji}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: C.text }}>{p.name}</p>
              <p className="text-xs" style={{ color: C.sub }}>{p.category === 'school' ? 'Məktəb' : 'Sport'} · {money(p.price)} · Stok: {p.stock}</p>
              <div className="flex gap-3 mt-1.5">
                <button onClick={() => setEditing(p)} className="text-xs font-bold flex items-center gap-1" style={{ color: C.blue }}><Edit2 size={12} /> Redaktə</button>
                <button onClick={() => onDelete(p.id)} className="text-xs font-bold flex items-center gap-1" style={{ color: C.red }}><Trash2 size={12} /> Sil</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductEditor({ product, onCancel, onSave }) {
  const [p, setP] = useState(product);
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border mb-4" style={{ borderColor: C.blue }}>
      <Field label="Ad"><TextInput value={p.name} onChange={set('name')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kateqoriya">
          <select value={p.category} onChange={set('category')} className="w-full rounded-xl px-4 py-3 text-[15px] border-2 outline-none" style={{ borderColor: C.line }}>
            <option value="school">Məktəb</option>
            <option value="sport">Sport</option>
          </select>
        </Field>
        <Field label="Emoji"><TextInput value={p.emoji} onChange={set('emoji')} /></Field>
        <Field label="Qiymət (AZN)"><TextInput type="number" value={p.price} onChange={e => setP({ ...p, price: parseFloat(e.target.value) || 0 })} /></Field>
        <Field label="Stok"><TextInput type="number" value={p.stock} onChange={e => setP({ ...p, stock: parseInt(e.target.value) || 0 })} /></Field>
      </div>
      <div className="flex gap-2 mt-2">
        <PrimaryButton onClick={() => onSave(p)}>Yadda Saxla</PrimaryButton>
        <GhostButton onClick={onCancel}>Ləğv et</GhostButton>
      </div>
    </div>
  );
}

const ORDER_SORT_WEIGHT = { pending: 0, accepted: 1, preparing: 2, completed: 3, cancelled: 4 };
function AdminOrders({ orders, onUpdateStatus }) {
  const [expanded, setExpanded] = useState(null);
  if (orders.length === 0) return <p className="text-sm text-center py-10" style={{ color: C.sub }}>Hələ sifariş yoxdur.</p>;
  const sorted = [...orders].sort((a, b) => (ORDER_SORT_WEIGHT[a.status] ?? 9) - (ORDER_SORT_WEIGHT[b.status] ?? 9) || new Date(b.createdAt) - new Date(a.createdAt));
  return (
    <div className="flex flex-col gap-3">
      {sorted.map(o => (
        <div key={o.id} className="bg-white rounded-2xl p-4 shadow-sm border" style={{ borderColor: C.line }}>
          <button className="w-full flex items-center justify-between" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
            <div className="text-left">
              <p className="font-extrabold text-sm" style={{ color: C.text }}>{o.id} · {o.name} {o.surname}</p>
              <p className="text-xs font-medium" style={{ color: C.sub }}>{o.store} · {fmtDate(o.createdAt)}</p>
            </div>
            <StatusBadge status={o.status} />
          </button>
          {expanded === o.id && (
            <div className="mt-3 pt-3 border-t space-y-3" style={{ borderColor: C.line }}>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <InfoRow icon={Phone} label="Telefon" value={o.phone} />
                <InfoRow icon={MapPin} label="Ünvan" value={o.address} />
              </div>
              {o.items.map((it, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span style={{ color: C.text }}>{it.name} × {it.qty}</span>
                  <span className="font-semibold" style={{ color: C.text }}>{money(it.price * it.qty)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-extrabold" style={{ color: C.blue }}><span>Cəmi</span><span>{money(o.total)}</span></div>
              {o.receiptDataUrl && (
                <div>
                  <p className="text-xs font-bold mb-1" style={{ color: C.text }}>Ödəniş çeki</p>
                  <img src={o.receiptDataUrl} alt="receipt" className="w-28 h-28 rounded-xl object-cover border" style={{ borderColor: C.line }} />
                </div>
              )}
              {PRIMARY_NEXT[o.status] && (
                <button
                  onClick={() => onUpdateStatus(o.id, PRIMARY_NEXT[o.status].to)}
                  className="w-full rounded-xl py-2.5 text-sm font-bold text-white active:scale-[0.98] transition-transform"
                  style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.blueDark})` }}
                >
                  {PRIMARY_NEXT[o.status].label} →
                </button>
              )}
              <div>
                <p className="text-xs font-bold mb-1.5" style={{ color: C.text }}>Digər status seç</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(STATUS).filter(([key]) => key !== 'pending').map(([key, s]) => (
                    <button key={key} onClick={() => onUpdateStatus(o.id, key)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold border-2"
                      style={o.status === key ? { background: s.color, color: '#fff', borderColor: s.color } : { background: '#fff', color: s.color, borderColor: s.color }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon size={12} className="mt-0.5 shrink-0" style={{ color: C.sub }} />
      <div><p style={{ color: C.sub }}>{label}</p><p className="font-semibold" style={{ color: C.text }}>{value}</p></div>
    </div>
  );
}

function AdminUsers({ users, orders, onResetPassword }) {
  const [resetPhone, setResetPhone] = useState(null);
  if (users.length === 0) return <p className="text-sm text-center py-10" style={{ color: C.sub }}>Hələ istifadəçi yoxdur.</p>;
  return (
    <div className="flex flex-col gap-3">
      {users.map(u => {
        const userOrders = orders.filter(o => o.phone === u.phone);
        const isResetting = resetPhone === u.phone;
        return (
          <div key={u.phone} className="bg-white rounded-2xl p-4 shadow-sm border" style={{ borderColor: C.line }}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-extrabold text-sm" style={{ color: C.text }}>{u.name} {u.surname}</p>
                <p className="text-xs" style={{ color: C.sub }}>{u.store}</p>
              </div>
              <Badge color={C.blue} bg={C.blueSoft}>{userOrders.length} sifariş</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mt-3">
              <InfoRow icon={Phone} label="Telefon" value={u.phone} />
              <InfoRow icon={MapPin} label="Ünvan" value={u.address} />
            </div>
            <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: C.line }}>
              <div>
                <p className="text-[11px] font-semibold" style={{ color: C.sub }}>Şifrə</p>
                <p className="text-sm font-mono font-bold" style={{ color: C.text }}>{u.password}</p>
              </div>
              <button
                onClick={() => setResetPhone(isResetting ? null : u.phone)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border-2"
                style={{ color: C.blue, borderColor: C.blue }}
              >
                Şifrəni sıfırla
              </button>
            </div>
            {isResetting && (
              <PasswordResetRow
                onCancel={() => setResetPhone(null)}
                onConfirm={(newPass) => { onResetPassword(u.phone, newPass); setResetPhone(null); }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PasswordResetRow({ onCancel, onConfirm }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  function submit() {
    if (value.length < 4) { setError('Ən azı 4 simvol olmalıdır.'); return; }
    onConfirm(value);
  }
  return (
    <div className="mt-3 flex items-start gap-2">
      <div className="flex-1">
        <TextInput
          value={value}
          onChange={e => { setValue(e.target.value); setError(''); }}
          placeholder="Yeni şifrə"
          error={error}
          style={{ padding: '0.5rem 0.75rem', fontSize: '13px' }}
        />
        {error && <p className="text-xs mt-1 font-medium" style={{ color: C.red }}>{error}</p>}
      </div>
      <button onClick={submit} className="text-xs font-bold px-3 py-2.5 rounded-lg text-white" style={{ background: C.blue }}>Təsdiqlə</button>
      <button onClick={onCancel} className="text-xs font-bold px-3 py-2.5 rounded-lg" style={{ color: C.sub }}>Ləğv et</button>
    </div>
  );
