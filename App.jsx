import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Plus, LogOut, RefreshCw, X, Package, Clock3, CheckCircle2, Tag, MessageSquare, History, CalendarDays, Send, Ban, Users, UserPlus, ShieldCheck, Trash2, Megaphone, AlertCircle, Bell, BellRing } from 'lucide-react';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const statusLabel = { in_stock: 'I lager', reserved: 'Reserverad', sold: 'Såld' };
const emptyForm = { machine_number: '', brand: '', model: '', year: '', hours: '', price: '', description: '' };
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export default function App() {
  const [session, setSession] = useState(null);
  const [machines, setMachines] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [machinePhotos, setMachinePhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
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
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLink, setRecoveryLink] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementComments, setAnnouncementComments] = useState({});
  const [announcementText, setAnnouncementText] = useState({ title: '', body: '', category: 'Information', is_important: false });
  const [announcementCommentText, setAnnouncementCommentText] = useState({});
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [showInternInfo, setShowInternInfo] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
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

  async function refreshPushStatus() {
    if (!session?.user?.id || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushEnabled(false);
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
        || await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setPushEnabled(false);
        return;
      }
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', subscription.endpoint)
        .maybeSingle();
      setPushEnabled(!error && Boolean(data));
    } catch {
      setPushEnabled(false);
    }
  }

  async function enablePushNotifications() {
    // Permission prompts must be initiated directly by the user's button press.
    if (pushBusy || pushEnabled) return;
    setPushBusy(true);
    setPushMessage('');
    try {
      if (!session?.user?.id) throw new Error('Du måste vara inloggad för att aktivera notiser.');
      if (!VAPID_PUBLIC_KEY) throw new Error('Pushnyckeln saknas i appens miljöinställningar (VITE_VAPID_PUBLIC_KEY).');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Den här webbläsaren stöder inte pushnotiser.');
      }

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
      const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
      if (isIOS && !isStandalone) {
        throw new Error('På iPhone behöver MÖRE först läggas till på hemskärmen och öppnas därifrån innan notiser kan aktiveras.');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error(permission === 'denied'
          ? 'Notiser är blockerade i telefonens inställningar. Tillåt notiser för MÖRE och försök igen.'
          : 'Du valde att inte tillåta notiser.');
      }

      const registration = await navigator.serviceWorker.getRegistration('/')
        || await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      const subscriptionJson = subscription.toJSON();
      const keys = subscriptionJson.keys || {};
      if (!subscriptionJson.endpoint || !keys.p256dh || !keys.auth) {
        throw new Error('Telefonens pushprenumeration kunde inte läsas. Försök igen.');
      }

      const subscriptionRow = {
        user_id: session.user.id,
        endpoint: subscriptionJson.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      };
      const { data: existing, error: lookupError } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', subscriptionJson.endpoint)
        .maybeSingle();
      if (lookupError) throw new Error('Kunde inte kontrollera pushprenumerationen: ' + lookupError.message);

      const saveResult = existing
        ? await supabase.from('push_subscriptions').update(subscriptionRow).eq('id', existing.id)
        : await supabase.from('push_subscriptions').insert(subscriptionRow);
      if (saveResult.error) throw new Error('Kunde inte spara notisinställningen: ' + saveResult.error.message);

      setPushEnabled(true);
      setPushMessage('Notiser är aktiverade på den här enheten.');
    } catch (err) {
      setPushMessage(err?.message || 'Det gick inte att aktivera notiser.');
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    if (session?.user?.id) refreshPushStatus();
    else {
      setPushEnabled(false);
      setPushMessage('');
    }
  }, [session?.user?.id]);

  async function loadMachines() {
    if (!session) return;
    setLoading(true); setError('');
    const { data, error } = await supabase.from('machines').select('*').eq('is_deleted', false).order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      const rows = data || [];
      const { data: photoRows, error: photoError } = await supabase
        .from('machine_photos')
        .select('id, machine_id, storage_path, is_primary')
        .in('machine_id', rows.map(machine => machine.id).length ? rows.map(machine => machine.id) : ['00000000-0000-0000-0000-000000000000']);
      if (photoError) {
        setError('Maskinerna kunde hämtas, men bilderna kunde inte hämtas: ' + photoError.message);
        setMachines(rows);
      } else {
        const primaryByMachine = {};
        (photoRows || []).forEach(photo => {
          if (photo.is_primary && !primaryByMachine[photo.machine_id]) {
            primaryByMachine[photo.machine_id] = supabase.storage.from('machine-photos').getPublicUrl(photo.storage_path).data.publicUrl;
          }
        });
        setMachines(rows.map(machine => ({ ...machine, main_photo_url: primaryByMachine[machine.id] || null })));
      }
    }
    setLoading(false);
  }

  async function loadAnnouncements() {
    if (!session) return;
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) { setError('Kunde inte hämta Interninfo: ' + error.message); return; }
    setAnnouncements(data || []);
    if (data?.length) {
      const ids = data.map(item => item.id);
      const { data: commentsData, error: commentsError } = await supabase.from('announcement_comments').select('*').in('announcement_id', ids).order('created_at', { ascending: true });
      if (commentsError) setError('Kunde inte hämta kommentarer: ' + commentsError.message);
      else {
        const grouped = {};
        (commentsData || []).forEach(item => { (grouped[item.announcement_id] ||= []).push(item); });
        setAnnouncementComments(grouped);
      }
    } else setAnnouncementComments({});
  }

  async function publishAnnouncement(event) {
    event.preventDefault();
    if (!announcementText.title.trim() || !announcementText.body.trim()) return;
    setAnnouncementBusy(true); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: announcement, error } = await supabase.from('announcements').insert({
      title: announcementText.title.trim(), body: announcementText.body.trim(),
      category: announcementText.category, is_important: announcementText.is_important, created_by: user.id
    }).select('id').single();
    if (error) setError('Kunde inte publicera: ' + error.message);
    else {
      setAnnouncementText({ title: '', body: '', category: 'Information', is_important: false });
      setShowAnnouncementForm(false);
      await loadAnnouncements();

      // Push is sent only for a newly published Interninfo post, never for comments.
      const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-interninfo-push', {
        body: { announcementId: announcement.id }
      });
      if (pushError || pushResult?.error) {
        setPushMessage('Inlägget publicerades, men utskicket av notiser misslyckades: ' + (pushResult?.error || pushError.message));
      } else if (pushResult?.sent > 0) {
        setPushMessage(`Inlägget publicerades. ${pushResult.sent} pushnotis(er) skickades.`);
      } else {
        setPushMessage('Inlägget publicerades. Inga aktiva pushprenumerationer kunde nås.');
      }
    }
    setAnnouncementBusy(false);
  }

  async function addAnnouncementComment(event, announcementId) {
    event.preventDefault();
    const message = (announcementCommentText[announcementId] || '').trim();
    if (!message) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('announcement_comments').insert({ announcement_id: announcementId, user_id: user.id, message });
    if (error) setError('Kunde inte spara kommentaren: ' + error.message);
    else {
      setAnnouncementCommentText(current => ({ ...current, [announcementId]: '' }));
      await loadAnnouncements();
    }
  }

  async function loadProfiles() {
    const { data, error } = await supabase.from('profiles').select('*').order('full_name');
    if (error) setError(error.message); else setProfiles(data || []);
  }

  useEffect(() => { if (session) { loadMachines(); loadProfiles(); loadAnnouncements(); } }, [session]);

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
    setSelected(machine); setError(''); setComments([]); setHistory([]); setMachinePhotos([]); setActiveReservation(null);
    const [c, h, r, p] = await Promise.all([
      supabase.from('comments').select('*').eq('machine_id', machine.id).order('created_at', { ascending: false }),
      supabase.from('machine_history').select('*').eq('machine_id', machine.id).order('created_at', { ascending: false }),
      supabase.from('reservations').select('*').eq('machine_id', machine.id).eq('status', 'active').maybeSingle(),
      supabase.from('machine_photos').select('*').eq('machine_id', machine.id).order('created_at', { ascending: true })
    ]);
    if (c.error) setError(c.error.message); else setComments(c.data || []);
    if (h.error) setError(h.error.message); else setHistory(h.data || []);
    if (r.error) setError(r.error.message); else setActiveReservation(r.data || null);
    if (p.error) setError('Kunde inte hämta maskinbilder: ' + p.error.message);
    else setMachinePhotos((p.data || []).map(photo => ({
      ...photo,
      publicUrl: supabase.storage.from('machine-photos').getPublicUrl(photo.storage_path).data.publicUrl
    })));
  }

  async function uploadMachinePhotos(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected || !files.length) return;
    setPhotoBusy(true);
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    let uploadError = '';
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        uploadError = 'Välj endast bildfiler.';
        break;
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${selected.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      const { error: storageError } = await supabase.storage.from('machine-photos').upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      });
      if (storageError) {
        uploadError = storageError.message;
        break;
      }
      const { error: rowError } = await supabase.from('machine_photos').insert({
        machine_id: selected.id,
        storage_path: storagePath,
        is_primary: machinePhotos.length === 0 && files.indexOf(file) === 0,
        created_by: user.id
      });
      if (rowError) {
        await supabase.storage.from('machine-photos').remove([storagePath]);
        uploadError = rowError.message;
        break;
      }
    }
    if (uploadError) setError('Bilden kunde inte sparas: ' + uploadError);
    await loadMachineDetails(selected);
    await loadMachines();
    setPhotoBusy(false);
  }

  async function deleteMachinePhoto(photo) {
    if (!selected || photoBusy) return;
    if (!window.confirm('Vill du ta bort den här bilden permanent?')) return;
    setPhotoBusy(true);
    setError('');
    const { error: storageError } = await supabase.storage.from('machine-photos').remove([photo.storage_path]);
    if (storageError) {
      setError('Bilden kunde inte tas bort: ' + storageError.message);
      setPhotoBusy(false);
      return;
    }
    const { error: rowError } = await supabase.from('machine_photos').delete().eq('id', photo.id);
    if (rowError) {
      setError('Bildfilen togs bort, men bildposten kunde inte tas bort: ' + rowError.message);
    } else if (photo.is_primary) {
      const nextPhoto = machinePhotos.find(item => item.id !== photo.id);
      if (nextPhoto) {
        const { error: primaryError } = await supabase.from('machine_photos').update({ is_primary: true }).eq('id', nextPhoto.id);
        if (primaryError) setError('Bilden togs bort, men ny huvudbild kunde inte väljas: ' + primaryError.message);
      }
    }
    if (previewPhoto?.id === photo.id) setPreviewPhoto(null);
    await loadMachineDetails(selected);
    await loadMachines();
    setPhotoBusy(false);
  }

  async function setPrimaryPhoto(photo) {
    if (!selected) return;
    setPhotoBusy(true);
    setError('');
    const { error: clearError } = await supabase.from('machine_photos').update({ is_primary: false }).eq('machine_id', selected.id);
    if (clearError) {
      setError('Kunde inte uppdatera huvudbild: ' + clearError.message);
    } else {
      const { error } = await supabase.from('machine_photos').update({ is_primary: true }).eq('id', photo.id);
      if (error) setError('Kunde inte välja huvudbild: ' + error.message);
    }
    await loadMachineDetails(selected);
    await loadMachines();
    setPhotoBusy(false);
  }

  async function changeStatus(machine, status) {
    setError('');
    const { error } = await supabase.from('machines').update({ status }).eq('id', machine.id);
    if (error) setError(error.message); else { setSelected(null); await loadMachines(); }
  }

  async function deleteMachine() {
    if (!isAdmin || !selected || deleteBusy) return;
    const machineName = [selected.brand, selected.model].filter(Boolean).join(' ') || selected.machine_number || 'den här maskinen';
    const confirmed = window.confirm(`Vill du ta bort ${machineName} från maskinlistan? Maskinen försvinner, men kommentarer och historik sparas.`);
    if (!confirmed) return;
    setDeleteBusy(true); setError('');
    const { error } = await supabase.from('machines').update({ is_deleted: true }).eq('id', selected.id);
    if (error) { setError('Maskinen kunde inte tas bort: ' + error.message); }
    else { setSelected(null); await loadMachines(); }
    setDeleteBusy(false);
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

  async function createRecoveryLink(event) {
    event.preventDefault();
    setAdminBusy(true); setError(''); setRecoveryLink('');
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'recovery_link', email: recoveryEmail.trim() }
    });
    if (error || data?.error) {
      setError(data?.error || error.message || 'Kunde inte skapa återställningslänk.');
    } else if (data?.action_link) {
      setRecoveryLink(data.action_link);
    } else {
      setError('Supabase returnerade ingen återställningslänk.');
    }
    setAdminBusy(false);
  }

  const date = value => value ? new Date(value).toLocaleDateString('sv-SE') : '–';
  const dateTime = value => value ? new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '';

  if (session && passwordFlow) return <main className="login"><div className="brand">MÖRE<span /></div><section className="login-card"><p className="eyebrow">KONTOINSTÄLLNING</p><h1>{passwordFlow === 'recovery' ? 'Nytt lösenord' : 'Skapa ditt lösenord'}</h1><p className="muted">{passwordNotice || 'Välj ett personligt lösenord för ditt konto.'}</p><form onSubmit={saveNewPassword}><label>Nytt lösenord<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required /></label><label>Bekräfta lösenord<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required /></label><button className="primary wide" disabled={passwordBusy}>{passwordBusy ? 'Sparar…' : 'Spara lösenord'}</button></form>{error && <p className="error">{error}</p>}</section></main>;

  if (!session) return <main className="login"><div className="brand">MÖRE<span /></div><section className="login-card"><p className="eyebrow">INTERNT MASKINREGISTER</p><h1>{passwordFlow === 'forgot' ? 'Återställ lösenord' : 'Välkommen'}</h1><p className="muted">{passwordFlow === 'forgot' ? 'Ange din e-postadress så skickar vi en återställningslänk.' : 'Logga in med ditt personliga konto.'}</p>{passwordFlow === 'forgot' ? <form onSubmit={requestPasswordReset}><label>E-post<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><button className="primary wide" disabled={passwordBusy}>{passwordBusy ? 'Skickar…' : 'Skicka återställningslänk'}</button><button type="button" className="wide" style={{ background: "transparent", color: "#ddd", border: "1px solid #444", borderRadius: 7, padding: 11 }} onClick={() => { setPasswordFlow(''); setError(''); setPasswordNotice(''); }}>Tillbaka till inloggning</button></form> : <form onSubmit={signIn}><label>E-post<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Lösenord<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button className="primary wide">Logga in</button><button type="button" className="wide" style={{ background: "transparent", color: "#ddd", border: "1px solid #444", borderRadius: 7, padding: 11 }} onClick={() => { setPasswordFlow('forgot'); setError(''); setPasswordNotice(''); }}>Glömt lösenord?</button></form>}{passwordNotice && <p className="muted">{passwordNotice}</p>}{error && <p className="error">{error}</p>}</section></main>;

  return <main className="app-shell">
    <style>{`
      .main-tabs{display:flex;gap:10px;padding:12px 0 18px;border-bottom:1px solid #303030}
      .push-notification-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 11px;font-size:12px;white-space:nowrap}
      .push-notification-button:disabled{opacity:.75;cursor:default}
      @media(max-width:520px){.top-actions{gap:6px}.push-notification-button{padding:8px 9px;font-size:11px}}
      .main-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:11px 18px;border-radius:9px;border:1px solid #3b3b3b;background:#202020;color:#c9c9c9;font-weight:650;cursor:pointer;transition:background .15s,border-color .15s}
      .main-tabs button.active{background:#3a1719;border-color:#d92730;color:#fff}
      .announcement-list{display:grid;gap:16px;margin-top:22px}
      .machine-photo img{width:100%;height:100%;object-fit:cover;border-radius:10px}
      .machine-photo-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:12px;margin-top:14px}
      .machine-photo-item{min-width:0;display:flex;flex-direction:column;gap:7px}
      .machine-photo-item img{width:100%;height:115px;object-fit:cover;border-radius:8px;border:1px solid #444}
      .photo-preview-trigger{display:block;width:100%;padding:0!important;border:0!important;background:transparent!important;cursor:zoom-in}
      .photo-delete-button{display:flex;align-items:center;justify-content:center;gap:5px;background:#321b1b!important;color:#ff7777!important;border:1px solid #713535!important}
      .photo-lightbox{position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;padding:54px 16px 35px}
      .photo-lightbox img{max-width:100%;max-height:82vh;object-fit:contain;border-radius:8px}
      .photo-lightbox-close{position:absolute;top:18px;right:18px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#252525;border:1px solid #555;color:white}
      .photo-lightbox-caption{position:absolute;bottom:14px;left:0;right:0;text-align:center;color:#ddd;font-size:13px}
      .machine-photo-item button{font-size:12px;padding:8px 6px}
      .detail-section label.primary,.detail-section label.button{padding:10px 14px;border-radius:8px}
      .detail-section label.button{background:#292929;color:#eee;border:1px solid #555}
      .announcement-card{width:100%;max-width:none;background:#191919;border:1px solid #353535;border-radius:12px;padding:22px}
      .announcement-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#e45a60;font-size:13px;font-weight:700}
      .announcement-meta small{color:#999;font-weight:400}
      .announcement-author{display:flex;align-items:center;gap:8px;margin:10px 0 14px;color:#bdbdbd;font-size:13px}
      .announcement-author strong{color:#f1f1f1;font-weight:650}
      .announcement-card h2{margin:8px 0 12px}
      .announcement-body{white-space:pre-wrap;line-height:1.6;color:#e0e0e0}
      .main-tabs button:focus-visible{outline:2px solid #e34a50;outline-offset:2px}
      @media(max-width:520px){.main-tabs button{flex:1;padding:10px 8px;font-size:14px}.announcement-card{padding:17px}}
    `}</style>
    <header className="topbar"><div className="brand">MÖRE<span /></div><div className="top-actions"><span className="staff">PERSONAL</span><button className="primary push-notification-button" onClick={enablePushNotifications} disabled={pushBusy || pushEnabled} title={pushEnabled ? 'Pushnotiser är aktiverade på den här enheten' : 'Aktivera pushnotiser på den här enheten'}>{pushEnabled ? <BellRing size={16} /> : <Bell size={16} />}{pushBusy ? 'Aktiverar…' : pushEnabled ? 'Notiser aktiverade' : 'Aktivera notiser'}</button>{isAdmin && <button className="icon-btn" onClick={() => { setShowAdmin(true); setError(''); }} aria-label="Personaladministration"><Users size={18} /></button>}<button className="icon-btn" onClick={loadMachines} aria-label="Uppdatera"><RefreshCw size={18} /></button><button className="icon-btn" onClick={signOut} aria-label="Logga ut"><LogOut size={18} /></button></div></header>
    <nav className="main-tabs"><button className={!showInternInfo ? 'active' : ''} onClick={() => setShowInternInfo(false)}><Package size={16} /> Maskiner</button><button className={showInternInfo ? 'active' : ''} onClick={() => { setShowInternInfo(true); loadAnnouncements(); }}><Megaphone size={16} /> Interninfo</button></nav>
    {pushMessage && <p className="muted" role="status" style={{ margin: '10px 0', fontSize: 13 }}>{pushMessage}</p>}
    {showInternInfo ? <>
      <section className="hero"><div><p className="eyebrow">INTERN KOMMUNIKATION</p><h1>Interninfo</h1><p className="muted">Nyheter och information från hela teamet.</p></div><button className="primary add-btn" onClick={() => setShowAnnouncementForm(v => !v)}><Plus size={18} /> Skriv inlägg</button></section>
      {showAnnouncementForm && <section className="dialog announcement-compose"><h2>Nytt inlägg</h2><form className="machine-form" onSubmit={publishAnnouncement}><label className="full">Rubrik<input value={announcementText.title} onChange={e => setAnnouncementText(v => ({ ...v, title: e.target.value }))} required maxLength={140} placeholder="Vad gäller informationen?" /></label><label className="full">Kategori<select value={announcementText.category} onChange={e => setAnnouncementText(v => ({ ...v, category: e.target.value }))}><option>Information</option><option>Nyhet</option><option>Driftinformation</option><option>Viktigt</option></select></label><label className="full">Meddelande<textarea rows={5} value={announcementText.body} onChange={e => setAnnouncementText(v => ({ ...v, body: e.target.value }))} required placeholder="Skriv informationen här…" /></label><label className="full checkbox-line"><input type="checkbox" checked={announcementText.is_important} onChange={e => setAnnouncementText(v => ({ ...v, is_important: e.target.checked }))} /> Markera som viktig information</label><button className="primary wide" disabled={announcementBusy}>{announcementBusy ? 'Publicerar…' : 'Publicera'}</button><button type="button" className="wide" onClick={() => setShowAnnouncementForm(false)}>Avbryt</button></form></section>}
      {announcements.length === 0 ? <div className="empty"><Megaphone size={32} /><h3>Ingen intern information ännu</h3><p>Här visas nyheter och meddelanden från medarbetarna.</p></div> : <section className="announcement-list">{announcements.map(item => <article className="dialog announcement-card" key={item.id}><div className="announcement-meta"><span>{item.category || 'Information'}</span><small>{dateTime(item.created_at)}</small></div><div className="announcement-author"><span>Publicerat av</span><strong>{profiles.find(profile => profile.id === item.created_by)?.full_name || 'Medarbetare'}</strong></div>{item.is_important && <p className="important-label"><AlertCircle size={15} /> Viktig information</p>}<h2>{item.title}</h2><p className="announcement-body">{item.body}</p><div className="detail-section"><h3><MessageSquare size={17} /> Kommentarer ({(announcementComments[item.id] || []).length})</h3>{(announcementComments[item.id] || []).map(comment => <div className="comment-item" key={comment.id}><p>{comment.message}</p><small>{profiles.find(profile => profile.id === comment.user_id)?.full_name || 'Medarbetare'} · {dateTime(comment.created_at)}</small></div>)}<form className="comment-form" onSubmit={event => addAnnouncementComment(event, item.id)}><textarea rows={2} placeholder="Skriv en kommentar eller fråga…" value={announcementCommentText[item.id] || ''} onChange={e => setAnnouncementCommentText(v => ({ ...v, [item.id]: e.target.value }))} required /><button className="primary" disabled={!(announcementCommentText[item.id] || '').trim()}><Send size={16} /> Skicka</button></form></div></article>)}</section>}
    </> : <>
    <section className="hero"><div><p className="eyebrow">MASKINÖVERSIKT</p><h1>Maskiner</h1><p className="muted">Lager, reservationer och försäljning på ett ställe.</p></div><button className="primary add-btn" onClick={() => setShowAdd(true)}><Plus size={18} /> Lägg till maskin</button></section>
    <section className="stats"><div><Package /><strong>{machines.length}</strong><span>Totalt</span></div><div><Tag /><strong>{machines.filter(m => m.status === 'in_stock').length}</strong><span>I lager</span></div><div><Clock3 /><strong>{machines.filter(m => m.status === 'reserved').length}</strong><span>Reserverade</span></div><div><CheckCircle2 /><strong>{machines.filter(m => m.status === 'sold').length}</strong><span>Sålda</span></div></section>
    <section className="toolbar"><div className="search"><Search size={18} /><input placeholder="Sök maskinnummer, fabrikat eller modell…" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="filters">{[['all','Alla'],['in_stock','I lager'],['reserved','Reserverade'],['sold','Sålda']].map(([value,label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div></section>
    {error && <div className="error-banner">{error}</div>}
    {loading ? <p className="empty">Hämtar maskiner…</p> : filtered.length === 0 ? <div className="empty"><Package size={34} /><h3>Inga maskiner att visa</h3><p>Prova att ändra sökning eller filter, eller lägg till en maskin.</p></div> : <section className="machine-grid">{filtered.map(machine => <button className="machine-card" key={machine.id} onClick={() => loadMachineDetails(machine)}><div className="machine-photo">{machine.main_photo_url ? <img src={machine.main_photo_url} alt={`${machine.brand || ''} ${machine.model || 'Maskin'}`} /> : <Package size={36} />}<span className={'status ' + machine.status}>{statusLabel[machine.status] || machine.status}</span></div><div className="machine-info"><p className="machine-no">{machine.machine_number || 'Inget maskinnummer'}</p><h3>{[machine.brand,machine.model].filter(Boolean).join(' ') || 'Maskin'}</h3><div className="details"><span>{machine.year || 'Årsmodell saknas'}</span><span>{machine.hours != null ? `${machine.hours.toLocaleString('sv-SE')} h` : 'Timmar saknas'}</span></div><strong className="price">{machine.price != null ? `${Number(machine.price).toLocaleString('sv-SE')} kr` : 'Pris saknas'}</strong></div></button>)}</section>}

    {selected && <div className="overlay" onClick={() => setSelected(null)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setSelected(null)}><X /></button><p className="eyebrow">MASKINDETALJER</p><h2>{selected.brand} {selected.model}</h2><p className="muted">{selected.machine_number}</p><p>{selected.description || 'Ingen beskrivning registrerad.'}</p><div className="details"><span>Årsmodell: {selected.year || '–'}</span><span>Timmar: {selected.hours ?? '–'}</span></div><strong className="price">{selected.price != null ? `${Number(selected.price).toLocaleString('sv-SE')} kr` : 'Pris saknas'}</strong><p className="muted">Status: {statusLabel[selected.status] || selected.status}</p>
      <div className="detail-section">
        <h3>Maskinbilder</h3>
        <p className="muted">Ta ett nytt foto eller välj bilder från telefonen. Du kan lägga till flera bilder.</p>
        <div className="dialog-actions">
          <label className="primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: photoBusy ? 'wait' : 'pointer', opacity: photoBusy ? 0.6 : 1 }}>
            {photoBusy ? 'Sparar bilder…' : 'Ta foto'}
            <input type="file" accept="image/*" capture="environment" onChange={uploadMachinePhotos} disabled={photoBusy} style={{ display: 'none' }} />
          </label>
          <label className="button" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: photoBusy ? 'wait' : 'pointer', opacity: photoBusy ? 0.6 : 1 }}>
            Välj bilder
            <input type="file" accept="image/*" multiple onChange={uploadMachinePhotos} disabled={photoBusy} style={{ display: 'none' }} />
          </label>
        </div>
        {machinePhotos.length === 0 ? <p className="muted">Inga bilder uppladdade ännu.</p> : <div className="machine-photo-gallery">{machinePhotos.map(photo => <div className="machine-photo-item" key={photo.id}><button type="button" className="photo-preview-trigger" onClick={() => setPreviewPhoto(photo)} aria-label="Visa bilden större"><img src={photo.publicUrl} alt="Bild på maskinen" /></button><button type="button" className={photo.is_primary ? 'primary' : ''} onClick={() => setPrimaryPhoto(photo)} disabled={photoBusy}>{photo.is_primary ? 'Huvudbild' : 'Välj som huvudbild'}</button><button type="button" className="photo-delete-button" onClick={() => deleteMachinePhoto(photo)} disabled={photoBusy}><Trash2 size={14} /> Ta bort</button></div>)}</div>}
      </div>
      {selected.status === 'in_stock' && <div className="dialog-actions"><button onClick={() => setShowReservation(true)}><CalendarDays size={16} /> Reservera</button><button className="primary" onClick={markSold}>Markera såld</button></div>}
      {selected.status === 'reserved' && <div className="reservation-info"><h3>Aktiv reservation</h3>{activeReservation ? <><p>Kund: {activeReservation.customer_name}</p><p>Ansvarig säljare: {profiles.find(p => p.id === activeReservation.reserved_by)?.full_name || 'Namn saknas'}</p><p>Datum: {date(activeReservation.reservation_date)}</p><button onClick={cancelReservation}><Ban size={16} /> Avboka reservation</button><button className="primary" onClick={markSold}>Markera såld</button></> : <><p>Maskinen är markerad som reserverad, men ingen aktiv reservation hittades.</p><button onClick={() => changeStatus(selected,'in_stock')}>Återställ till I lager</button></>}</div>}
      {selected.status === 'sold' && <div className="dialog-actions"><button onClick={() => changeStatus(selected,'in_stock')}>Återställ till I lager</button></div>}
      <div className="detail-section"><h3><MessageSquare size={18} /> Kommentarer</h3><form onSubmit={addComment} className="comment-form"><textarea placeholder="Skriv en kommentar om maskinen…" value={commentText} onChange={e => setCommentText(e.target.value)} required /><button className="primary" disabled={!commentText.trim()}><Send size={16} /> Skicka</button></form>{comments.length === 0 ? <p className="muted">Inga kommentarer ännu.</p> : comments.map(c => <div className="comment-item" key={c.id}><p>{c.message}</p><small>{dateTime(c.created_at)}</small></div>)}</div>
      <div className="detail-section"><h3><History size={18} /> Maskinhistorik</h3>{history.length === 0 ? <p className="muted">Ingen historik registrerad ännu.</p> : history.map(h => <div className="history-item" key={h.id}><strong>{h.action}</strong><small>{dateTime(h.created_at)}</small></div>)}</div>
      {isAdmin && <div className="detail-section"><button className="wide" style={{ background: "#8f2525", color: "white", border: "1px solid #8f2525" }} onClick={deleteMachine} disabled={deleteBusy}><Trash2 size={16} /> {deleteBusy ? 'Tar bort…' : 'Ta bort maskin'}</button></div>}
    </section></div>}

    {showReservation && selected && <div className="overlay" onClick={() => setShowReservation(false)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowReservation(false)}><X /></button><p className="eyebrow">NY RESERVATION</p><h2>Reservera maskin</h2><p className="muted">{selected.brand} {selected.model} – {selected.machine_number}</p><form className="machine-form" onSubmit={createReservation}><label className="full">Kundens namn<input value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="Ange kundens namn" /></label><label className="full">Ansvarig säljare<select value={reservedBy} onChange={e => setReservedBy(e.target.value)} required><option value="">Välj säljare</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || 'Inloggad användare'}</option>)}</select></label><label className="full">Reservationsdatum<input type="date" value={reservationDate} onChange={e => setReservationDate(e.target.value)} /></label><button className="primary wide" disabled={saving}>{saving ? 'Sparar…' : 'Spara reservation'}</button>{error && <p className="error">{error}</p>}</form></section></div>}

    {showAdmin && isAdmin && <div className="overlay" onClick={() => setShowAdmin(false)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowAdmin(false)}><X /></button><p className="eyebrow">ADMINISTRATION</p><h2><Users size={22} /> Personaladministration</h2><p className="muted">Bjud in medarbetare. De får en länk via e-post för att skapa sitt eget lösenord.</p><form className="machine-form" onSubmit={inviteUser}><label className="full">Medarbetarens namn<input value={newUserName} onChange={e => setNewUserName(e.target.value)} required placeholder="För- och efternamn" /></label><label className="full">E-postadress<input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required placeholder="namn@moremaskiner.se" /></label><label className="full">Behörighet<select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}><option value="seller">Säljare</option><option value="admin">Administratör</option></select></label><button className="primary wide" disabled={adminBusy}><UserPlus size={16} /> {adminBusy ? 'Skickar inbjudan…' : 'Bjud in medarbetare'}</button>{error && <p className="error full">{error}</p>}</form><div className="detail-section"><h3><ShieldCheck size={18} /> Skapa lösenordslänk</h3><p className="muted">Skapa en länk åt en befintlig medarbetare utan att skicka e-post.</p><form className="machine-form" onSubmit={createRecoveryLink}><label className="full">Medarbetarens e-post<input type="email" value={recoveryEmail} onChange={e => { setRecoveryEmail(e.target.value); setRecoveryLink(''); }} required placeholder="namn@moremaskiner.se" /></label><button className="primary wide" disabled={adminBusy}>{adminBusy ? 'Skapar länk…' : 'Skapa lösenordslänk'}</button>{recoveryLink && <label className="full">Länk – kopiera och skicka säkert<textarea value={recoveryLink} readOnly onFocus={e => e.target.select()} rows={4} /></label>}{error && <p className="error full">{error}</p>}</form></div><div className="detail-section"><h3><ShieldCheck size={18} /> Personal i systemet</h3>{profiles.map(profile => <div className="history-item" key={profile.id}><strong>{profile.full_name || 'Namn saknas'}</strong><small>{profile.role === 'admin' ? 'Administratör' : 'Säljare'}</small></div>)}</div></section></div>}

    {previewPhoto && <div className="photo-lightbox" role="dialog" aria-modal="true" onClick={() => setPreviewPhoto(null)}>
      <button type="button" className="photo-lightbox-close" onClick={() => setPreviewPhoto(null)} aria-label="Stäng bildvisning"><X size={26} /></button>
      <img src={previewPhoto.publicUrl} alt="Förstorad bild på maskinen" onClick={event => event.stopPropagation()} />
      <div className="photo-lightbox-caption">{previewPhoto.is_primary ? 'Huvudbild' : 'Maskinbild'}</div>
    </div>}
    {showAdd && <div className="overlay" onClick={() => setShowAdd(false)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowAdd(false)}><X /></button><p className="eyebrow">NY MASKIN</p><h2>Lägg till maskin</h2><form className="machine-form" onSubmit={addMachine}>{[['machine_number','Maskinnummer'],['brand','Fabrikat'],['model','Modell'],['year','Årsmodell'],['hours','Timmar'],['price','Pris (kr)']].map(([field,label]) => <label key={field}>{label}<input value={form[field]} type={['year','hours','price'].includes(field) ? 'number' : 'text'} onChange={e => setForm({ ...form, [field]: e.target.value })} /></label>)}<label className="full">Beskrivning<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><button className="primary wide">Spara maskin</button></form></section></div>}
    </>}
  </main>;
}
