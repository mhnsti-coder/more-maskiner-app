import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Plus, LogOut, RefreshCw, X, Package, Clock3, CheckCircle2, Tag } from 'lucide-react';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

const statusLabel = { in_stock: 'I lager', reserved: 'Reserverad', sold: 'Såld' };

export default function App() {
  const [session, setSession] = useState(null);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [form, setForm] = useState({machine_number:'', brand:'', model:'', year:'', hours:'', price:'', description:''});

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadMachines() {
    if (!supabase || !session) return;
    setLoading(true); setError('');
    const { data, error } = await supabase.from('machines').select('*').order('created_at', {ascending:false});
    if (error) setError(error.message); else setMachines(data || []);
    setLoading(false);
  }
  useEffect(() => { loadMachines(); }, [session]);

  const filtered = useMemo(() => machines.filter(m => {
    const q = search.toLowerCase();
    const matches = [m.machine_number,m.brand,m.model].some(v => String(v || '').toLowerCase().includes(q));
    return matches && (filter === 'all' || m.status === filter);
  }), [machines, search, filter]);

  async function signIn(e) {
    e.preventDefault(); setError('');
    const { error } = await supabase.auth.signInWithPassword({email, password});
    if (error) setError(error.message);
  }
  async function signOut() { await supabase.auth.signOut(); setMachines([]); }
  async function addMachine(e) {
    e.preventDefault(); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {...form, year: form.year ? Number(form.year) : null, hours: form.hours ? Number(form.hours) : null, price: form.price ? Number(form.price) : null, status:'in_stock', created_by:user.id};
    const { error } = await supabase.from('machines').insert(payload);
    if (error) setError(error.message); else { setShowAdd(false); setForm({machine_number:'',brand:'',model:'',year:'',hours:'',price:'',description:''}); loadMachines(); }
  }
  async function changeStatus(machine, status) {
    const { error } = await supabase.from('machines').update({status}).eq('id', machine.id);
    if (error) setError(error.message); else { setSelected(null); loadMachines(); }
  }

  if (!supabase) return <main className="setup"><div className="brand">MÖRE<span></span></div><h1>Appen behöver kopplas till databasen</h1><p>Projektet är förberett. Lägg in Supabase-projektets URL och publicerbara anon/publishable key i miljövariablerna innan inloggningen kan användas.</p><p className="hint">Använd aldrig Supabase service_role-nyckeln här.</p></main>;

  if (!session) return <main className="login"><div className="brand">MÖRE<span></span></div><section className="login-card"><p className="eyebrow">INTERNT MASKINREGISTER</p><h1>Välkommen</h1><p className="muted">Logga in med ditt personliga konto.</p><form onSubmit={signIn}><label>E-post<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>Lösenord<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><button className="primary wide">Logga in</button></form>{error && <p className="error">{error}</p>}</section></main>;

  return <main className="app-shell">
    <header className="topbar"><div className="brand">MÖRE<span></span></div><div className="top-actions"><span className="staff">PERSONAL</span><button className="icon-btn" onClick={loadMachines} aria-label="Uppdatera"><RefreshCw size={18}/></button><button className="icon-btn" onClick={signOut} aria-label="Logga ut"><LogOut size={18}/></button></div></header>
    <section className="hero"><div><p className="eyebrow">MASKINÖVERSIKT</p><h1>Maskiner</h1><p className="muted">Lager, reservationer och försäljning på ett ställe.</p></div><button className="primary add-btn" onClick={()=>setShowAdd(true)}><Plus size={18}/> Lägg till maskin</button></section>
    <section className="stats"><div><Package/><strong>{machines.length}</strong><span>Totalt</span></div><div><Tag/><strong>{machines.filter(m=>m.status==='in_stock').length}</strong><span>I lager</span></div><div><Clock3/><strong>{machines.filter(m=>m.status==='reserved').length}</strong><span>Reserverade</span></div><div><CheckCircle2/><strong>{machines.filter(m=>m.status==='sold').length}</strong><span>Sålda</span></div></section>
    <section className="toolbar"><div className="search"><Search size={18}/><input placeholder="Sök maskinnummer, fabrikat eller modell…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="filters">{[['all','Alla'],['in_stock','I lager'],['reserved','Reserverade'],['sold','Sålda']].map(([v,l])=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{l}</button>)}</div></section>
    {error && <div className="error-banner">{error}</div>}
    {loading ? <p className="empty">Hämtar maskiner…</p> : filtered.length===0 ? <div className="empty"><Package size={34}/><h3>Inga maskiner att visa</h3><p>Prova att ändra sökning eller filter, eller lägg till en maskin.</p></div> :
      <section className="machine-grid">{filtered.map(m=><button className="machine-card" key={m.id} onClick={()=>setSelected(m)}><div className="machine-photo"><Package size={36}/><span className={'status '+m.status}>{statusLabel[m.status] || m.status}</span></div><div className="machine-info"><p className="machine-no">{m.machine_number || 'Inget maskinnummer'}</p><h3>{[m.brand,m.model].filter(Boolean).join(' ') || 'Maskin'}</h3><div className="details"><span>{m.year || 'Årsmodell saknas'}</span><span>{m.hours != null ? `${m.hours.toLocaleString('sv-SE')} h` : 'Timmar saknas'}</span></div><strong className="price">{m.price != null ? `${Number(m.price).toLocaleString('sv-SE')} kr` : 'Pris saknas'}</strong></div></button>)}</section>}
    {selected && <div className="overlay" onClick={()=>setSelected(null)}><section className="dialog" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setSelected(null)}><X/></button><p className="eyebrow">MASKINDETALJER</p><h2>{selected.brand} {selected.model}</h2><p className="muted">{selected.machine_number}</p><p>{selected.description || 'Ingen beskrivning registrerad.'}</p><div className="details"><span>Årsmodell: {selected.year || '–'}</span><span>Timmar: {selected.hours ?? '–'}</span></div><strong className="price">{selected.price != null ? `${Number(selected.price).toLocaleString('sv-SE')} kr` : 'Pris saknas'}</strong><p className="muted">Status: {statusLabel[selected.status] || selected.status}</p><div className="dialog-actions"><button onClick={()=>changeStatus(selected,'in_stock')}>I lager</button><button onClick={()=>changeStatus(selected,'reserved')}>Reservera</button><button className="primary" onClick={()=>changeStatus(selected,'sold')}>Markera såld</button></div><p className="hint">Reservationens kunduppgifter och kommentarer byggs in i nästa steg.</p></section></div>}
    {showAdd && <div className="overlay" onClick={()=>setShowAdd(false)}><section className="dialog" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowAdd(false)}><X/></button><p className="eyebrow">NY MASKIN</p><h2>Lägg till maskin</h2><form className="machine-form" onSubmit={addMachine}>{[['machine_number','Maskinnummer'],['brand','Fabrikat'],['model','Modell'],['year','Årsmodell'],['hours','Timmar'],['price','Pris (kr)']].map(([k,l])=><label key={k}>{l}<input value={form[k]} type={['year','hours','price'].includes(k)?'number':'text'} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<label className="full">Beskrivning<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label><button className="primary wide">Spara maskin</button></form></section></div>}
  </main>;
}
