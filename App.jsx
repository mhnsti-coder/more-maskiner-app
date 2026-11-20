import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Plus, LogOut, RefreshCw, X, Package, Clock3, CheckCircle2, Tag, MessageSquare, History, CalendarDays, Send, Ban, Users, UserPlus, ShieldCheck } from 'lucide-react';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const statusLabel = { in_stock: 'I lager', reserved: 'Reserverad', sold: 'Såld' };
const emptyForm = { machine_number: '', brand: '', model: '', year: '', hours: '', price: '', description: '' };

export default function App() {
  const [session, setSession] = useState(null);
  const [machines, setMachines] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeReservation, setActiveReservation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordFlow, setPasswordFlow] = useState(''); // setup | recovery | forgot
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [customerName, setCustomerName] = useState('');
  const [reservedBy, setReservedBy] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('seller');
  const [adminBusy, setAdminBusy] = useState(false);
  const currentProfile = profiles.find(p => p.id === session?.user?.id);
  const isAdmin = currentProfile?.role === 'admin';

  function needsPasswordSetup(user) {
    if (!user) return false;
    if (user.user_metadata?.must_set_password === false) return false;
    return user.user_metadata?.must_set_password === true || Boolean(user.invited_at);
  }

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session?.user && needsPasswordSetup(data.session.user)) setPasswordFlow('setup');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, value) => {
      setSession(value);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordFlow('recovery');
        setPasswordNotice('Välj ett nytt lösenord.');
      } else if (event === 'SIGNED_IN' && value?.user && needsPasswordSetup(value.user)) {
        setPasswordFlow('setup');
        setPasswordNotice('Välkommen! Skapa ett personligt lösenord för ditt konto.');
      } else if (event === 'SIGNED_OUT') {
        setPasswordFlow('');
      }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  async function loadMachines() {
    if (!session) return;
    setLoading(true); setError('');
    const { data, error } = await supabase.from('machines').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message); else setMachines(data || []);
    setLoading(false);
  }

  async function loadProfiles() {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (error) setError(error.message); else setProfiles(data || []);
  }

  useEffect(() => { if (session) { loadMachines(); loadProfiles(); } }, [session]);

  const filtered = useMemo(() => machines.filter(m => {
    const q = search.toLowerCase();
    const matches = [m.machine_number, m.brand, m.model].some(v => String(v || '').toLowerCase().includes(q));
    return matches && (filter === 'all' || m.status === filter);
  }), [machines, search, filter]);

  async function signIn(event) {
    event.preventDefault(); setError(''); setPasswordNotice('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
  }

  async function requestPasswordReset(event) {
    event.preventDefault(); setError(''); setPasswordNotice(''); setPasswordBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (error) setError(error.message);
    else setPasswordNotice('Om adressen finns registrerad har ett mejl med återställningslänk skickats.');
    setPasswordBusy(false);
  }

  async function saveNewPassword(event) {
    event.preventDefault(); setError(''); setPasswordNotice('');
    if (newPassword.length < 8) { setError('Lösenordet måste innehålla minst 8 tecken.'); return; }
    if (newPassword !== confirmPassword) { setError('Lösenorden stämmer inte överens.'); return; }
    setPasswordBusy(true);
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { ...(session?.user?.user_metadata || {}), must_set_password: false }
    });
    if (error) setError(error.message);
    else {
      setSession(current => current ? { ...current, user: data.user } : current);
      setPasswordFlow(''); setNewPassword(''); setConfirmPassword('');
      setPasswordNotice('Ditt lösenord är sparat. Välkommen!');
    }
    setPasswordBusy(false);
  }

  async function signOut() { await supabase.auth.signOut(); setMachines([]); setSelected(null); setPasswordFlow(''); }

  async function addMachine(event) {
    event.preventDefault(); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { ...form, year: form.year ? Number(form.year) : null, hours: form.hours ? Number(form.hours) : null, price: form.price ? Number(form.price) : null, status: 'in_stock', created_by: user.id };
    const { error } = await supabase.from('machines').insert(payload);
    if (error) setError(error.message); else { setShowAdd(false); setForm(emptyForm); await loadMachines(); }
  }

  async function loadMachineDetails(machine) {
    setSelected(machine); setError(''); setComments([]); setHistory([]); setActiveReservation(null);
    const [c, h, r] = await Promise.all([
      supabase.from('comments').select('*').eq('machine_id', machine.id).order('created_at', { ascending: false }),
      supabase.from('machine_history').select('*').eq('machine_id', machine.id).order('created_at', { ascending: false }),
      supabase.from('reservations').select('*').eq('machine_id', machine.id).eq('status', 'active').maybeSingle()
    ]);
    if (c.error) setError(c.error.message); else setComments(c.data || []);
    if (h.error) setError(h.error.message); else setHistory(h.data || []);
    if (r.error) setError(r.error.message); else setActiveReservation(r.data || null);
  }

  async function changeStatus(machine, status) {
    setError('');
    const { error } = await supabase.from('machines').update({ status }).eq('id', machine.id);
    if (error) setError(error.message); else { setSelected(null); await loadMachines(); }
  }

  async function createReservation(event) {
    event.preventDefault(); if (!selected) return;
    setSaving(true); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error: reservationError } = await supabase.from('reservations').insert({ machine_id: selected.id, customer_name: customerName, reserved_by: reservedBy || user.id, reservation_date: reservationDate || null, status: 'active' });
    if (reservationError) { setError(reservationError.message); setSaving(false); return; }
    const { error: machineError } = await supabase.from('machines').update({ status: 'reserved' }).eq('id', selected.id);
    if (machineError) setError('Reservationen sparades, men maskinens status kunde inte uppdateras: ' + machineError.message);
    else {
      setShowReservation(false); setCustomerName(''); setReservedBy(''); setReservationDate('');
      await loadMachines(); await loadMachineDetails({ ...selected, status: 'reserved' });
    }
    setSaving(false);
  }

  async function cancelReservation() {
    if (!selected || !activeReservation) return;
    setError('');
    const { error: rError } = await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', activeReservation.id);
    if (rError) { setError(rError.message); return; }
    const { error: mError } = await supabase.from('machines').update({ status: 'in_stock' }).eq('id', selected.id);
    if (mError) setError(mError.message); else { await loadMachines(); await loadMachineDetails({ ...selected, status: 'in_stock' }); }
  }

  async function markSold() {
    if (!selected) return;
    if (activeReservation) {
      const { error } = await supabase.from('reservations').update({ status: 'completed' }).eq('id', activeReservation.id);
      if (error) { setError(error.message); return; }
    }
    await changeStatus(selected, 'sold');
  }

  async function addComment(event) {
    event.preventDefault(); if (!selected || !commentText.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('comments').insert({ machine_id: selected.id, user_id: user.id, message: commentText.trim() });
    if (error) setError(error.message); else { setCommentText(''); await loadMachineDetails(selected); }
  }

  async function inviteUser(event) {
    event.preventDefault();
    setAdminBusy(true); setError('');
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'invite', full_name: newUserName.trim(), email: newUserEmail.trim(), role: newUserRole }
    });
    if (error || data?.error) {
      setError(data?.error || error.message || 'Kunde inte bjuda in användaren.');
    } else {
      const invitedEmail = newUserEmail.trim();
      setNewUserName(''); setNewUserEmail(''); setNewUserRole('seller');
      await loadProfiles();
      alert('Inbjudan skickad till ' + invitedEmail + '.');
    }
    setAdminBusy(false);
  }

  const date = value => value ? new Date(value).toLocaleDateString('sv-SE') : '–';
  const dateTime = value => value ? new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '';

  if (session && passwordFlow) return <main className="login"><div className="brand">MÖRE<span /></div><section className="login-card"><p className="eyebrow">KONTOINSTÄLLNING</p><h1>{passwordFlow === 'recovery' ? 'Nytt lösenord' : 'Skapa ditt lösenord'}</h1><p className="muted">{passwordNotice || 'Välj ett personligt lösenord för ditt konto.'}</p><form onSubmit={saveNewPassword}><label>Nytt lösenord<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required /></label><label>Bekräfta lösenord<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required /></label><button className="primary wide" disabled={passwordBusy}>{passwordBusy ? 'Sparar…' : 'Spara lösenord'}</button></form>{error && <p className="error">{error}</p>}</section></main>;

  if (!session) return <main className="login"><div className="brand">MÖRE<span /></div><section className="login-card"><p className="eyebrow">INTERNT MASKINREGISTER</p><h1>{passwordFlow === 'forgot' ? 'Återställ lösenord' : 'Välkommen'}</h1><p className="muted">{passwordFlow === 'forgot' ? 'Ange din e-postadress så skickar vi en återställningslänk.' : 'Logga in med ditt personliga konto.'}</p>{passwordFlow === 'forgot' ? <form onSubmit={requestPasswordReset}><label>E-post<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><button className="primary wide" disabled={passwordBusy}>{passwordBusy ? 'Skickar…' : 'Skicka återställningslänk'}</button><button type="button" className="wide" style={{ background: "transparent", color: "#ddd", border: "1px solid #444", borderRadius: 7, padding: 11 }} onClick={() => { setPasswordFlow(''); setError(''); setPasswordNotice(''); }}>Tillbaka till inloggning</button></form> : <form onSubmit={signIn}><label>E-post<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Lösenord<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button className="primary wide">Logga in</button><button type="button" className="wide" style={{ background: "transparent", color: "#ddd", border: "1px solid #444", borderRadius: 7, padding: 11 }} onClick={() => { setPasswordFlow('forgot'); setError(''); setPasswordNotice(''); }}>Glömt lösenord?</button></form>}{passwordNotice && <p className="muted">{passwordNotice}</p>}{error && <p className="error">{error}</p>}</section></main>;

  return <main className="app-shell">
    <header className="topbar"><div className="brand">MÖRE<span /></div><div className="top-actions"><span className="staff">PERSONAL</span>{isAdmin && <button className="icon-btn" onClick={() => { setShowAdmin(true); setError(''); }} aria-label="Personaladministration"><Users size={18} /></button>}<button className="icon-btn" onClick={loadMachines} aria-label="Uppdatera"><RefreshCw size={18} /></button><button className="icon-btn" onClick={signOut} aria-label="Logga ut"><LogOut size={18} /></button></div></header>
    <section className="hero"><div><p className="eyebrow">MASKINÖVERSIKT</p><h1>Maskiner</h1><p className="muted">Lager, reservationer och försäljning på ett ställe.</p></div><button className="primary add-btn" onClick={() => setShowAdd(true)}><Plus size={18} /> Lägg till maskin</button></section>
    <section className="stats"><div><Package /><strong>{machines.length}</strong><span>Totalt</span></div><div><Tag /><strong>{machines.filter(m => m.status === 'in_stock').length}</strong><span>I lager</span></div><div><Clock3 /><strong>{machines.filter(m => m.status === 'reserved').length}</strong><span>Reserverade</span></div><div><CheckCircle2 /><strong>{machines.filter(m => m.status === 'sold').length}</strong><span>Sålda</span></div></section>
    <section className="toolbar"><div className="search"><Search size={18} /><input placeholder="Sök maskinnummer, fabrikat eller modell…" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="filters">{[['all','Alla'],['in_stock','I lager'],['reserved','Reserverade'],['sold','Sålda']].map(([value,label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div></section>
    {error && <div className="error-banner">{error}</div>}
    {loading ? <p className="empty">Hämtar maskiner…</p> : filtered.length === 0 ? <div className="empty"><Package size={34} /><h3>Inga maskiner att visa</h3><p>Prova att ändra sökning eller filter, eller lägg till en maskin.</p></div> : <section className="machine-grid">{filtered.map(machine => <button className="machine-card" key={machine.id} onClick={() => loadMachineDetails(machine)}><div className="machine-photo"><Package size={36} /><span className={'status ' + machine.status}>{statusLabel[machine.status] || machine.status}</span></div><div className="machine-info"><p className="machine-no">{machine.machine_number || 'Inget maskinnummer'}</p><h3>{[machine.brand,machine.model].filter(Boolean).join(' ') || 'Maskin'}</h3><div className="details"><span>{machine.year || 'Årsmodell saknas'}</span><span>{machine.hours != null ? `${machine.hours.toLocaleString('sv-SE')} h` : 'Timmar saknas'}</span></div><strong className="price">{machine.price != null ? `${Number(machine.price).toLocaleString('sv-SE')} kr` : 'Pris saknas'}</strong></div></button>)}</section>}

    {selected && <div className="overlay" onClick={() => setSelected(null)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setSelected(null)}><X /></button><p className="eyebrow">MASKINDETALJER</p><h2>{selected.brand} {selected.model}</h2><p className="muted">{selected.machine_number}</p><p>{selected.description || 'Ingen beskrivning registrerad.'}</p><div className="details"><span>Årsmodell: {selected.year || '–'}</span><span>Timmar: {selected.hours ?? '–'}</span></div><strong className="price">{selected.price != null ? `${Number(selected.price).toLocaleString('sv-SE')} kr` : 'Pris saknas'}</strong><p className="muted">Status: {statusLabel[selected.status] || selected.status}</p>
      {selected.status === 'in_stock' && <div className="dialog-actions"><button onClick={() => setShowReservation(true)}><CalendarDays size={16} /> Reservera</button><button className="primary" onClick={markSold}>Markera såld</button></div>}
      {selected.status === 'reserved' && <div className="reservation-info"><h3>Aktiv reservation</h3>{activeReservation ? <><p>Kund: {activeReservation.customer_name}</p><p>Ansvarig säljare: {profiles.find(p => p.id === activeReservation.reserved_by)?.full_name || 'Namn saknas'}</p><p>Datum: {date(activeReservation.reservation_date)}</p><button onClick={cancelReservation}><Ban size={16} /> Avboka reservation</button><button className="primary" onClick={markSold}>Markera såld</button></> : <><p>Maskinen är markerad som reserverad, men ingen aktiv reservation hittades.</p><button onClick={() => changeStatus(selected,'in_stock')}>Återställ till I lager</button></>}</div>}
      {selected.status === 'sold' && <div className="dialog-actions"><button onClick={() => changeStatus(selected,'in_stock')}>Återställ till I lager</button></div>}
      <div className="detail-section"><h3><MessageSquare size={18} /> Kommentarer</h3><form onSubmit={addComment} className="comment-form"><textarea placeholder="Skriv en kommentar om maskinen…" value={commentText} onChange={e => setCommentText(e.target.value)} required /><button className="primary" disabled={!commentText.trim()}><Send size={16} /> Skicka</button></form>{comments.length === 0 ? <p className="muted">Inga kommentarer ännu.</p> : comments.map(c => <div className="comment-item" key={c.id}><p>{c.message}</p><small>{dateTime(c.created_at)}</small></div>)}</div>
      <div className="detail-section"><h3><History size={18} /> Maskinhistorik</h3>{history.length === 0 ? <p className="muted">Ingen historik registrerad ännu.</p> : history.map(h => <div className="history-item" key={h.id}><strong>{h.action}</strong><small>{dateTime(h.created_at)}</small></div>)}</div>
    </section></div>}

    {showReservation && selected && <div className="overlay" onClick={() => setShowReservation(false)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowReservation(false)}><X /></button><p className="eyebrow">NY RESERVATION</p><h2>Reservera maskin</h2><p className="muted">{selected.brand} {selected.model} – {selected.machine_number}</p><form className="machine-form" onSubmit={createReservation}><label className="full">Kundens namn<input value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="Ange kundens namn" /></label><label className="full">Ansvarig säljare<select value={reservedBy} onChange={e => setReservedBy(e.target.value)} required><option value="">Välj säljare</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || 'Inloggad användare'}</option>)}</select></label><label className="full">Reservationsdatum<input type="date" value={reservationDate} onChange={e => setReservationDate(e.target.value)} /></label><button className="primary wide" disabled={saving}>{saving ? 'Sparar…' : 'Spara reservation'}</button>{error && <p className="error">{error}</p>}</form></section></div>}

    {showAdmin && isAdmin && <div className="overlay" onClick={() => setShowAdmin(false)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowAdmin(false)}><X /></button><p className="eyebrow">ADMINISTRATION</p><h2><Users size={22} /> Personaladministration</h2><p className="muted">Bjud in medarbetare. De får en länk via e-post för att skapa sitt eget lösenord.</p><form className="machine-form" onSubmit={inviteUser}><label className="full">Medarbetarens namn<input value={newUserName} onChange={e => setNewUserName(e.target.value)} required placeholder="För- och efternamn" /></label><label className="full">E-postadress<input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required placeholder="namn@moremaskiner.se" /></label><label className="full">Behörighet<select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}><option value="seller">Säljare</option><option value="admin">Administratör</option></select></label><button className="primary wide" disabled={adminBusy}><UserPlus size={16} /> {adminBusy ? 'Skickar inbjudan…' : 'Bjud in medarbetare'}</button>{error && <p className="error full">{error}</p>}</form><div className="detail-section"><h3><ShieldCheck size={18} /> Personal i systemet</h3>{profiles.map(profile => <div className="history-item" key={profile.id}><strong>{profile.full_name || 'Namn saknas'}</strong><small>{profile.role === 'admin' ? 'Administratör' : 'Säljare'}</small></div>)}</div></section></div>}

    {showAdd && <div className="overlay" onClick={() => setShowAdd(false)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowAdd(false)}><X /></button><p className="eyebrow">NY MASKIN</p><h2>Lägg till maskin</h2><form className="machine-form" onSubmit={addMachine}>{[['machine_number','Maskinnummer'],['brand','Fabrikat'],['model','Modell'],['year','Årsmodell'],['hours','Timmar'],['price','Pris (kr)']].map(([field,label]) => <label key={field}>{label}<input value={form[field]} type={['year','hours','price'].includes(field) ? 'number' : 'text'} onChange={e => setForm({ ...form, [field]: e.target.value })} /></label>)}<label className="full">Beskrivning<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><button className="primary wide">Spara maskin</button></form></section></div>}
  </main>;
}
