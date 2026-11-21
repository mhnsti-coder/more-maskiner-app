import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Plus, LogOut, RefreshCw, X, Package, Clock3, CheckCircle2, Tag, MessageSquare, History, CalendarDays, Send, Ban, Users, UserPlus, ShieldCheck, Trash2, Megaphone, AlertCircle, Bell, BellRing, Paperclip, FileText, Download } from 'lucide-react';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const statusLabel = { in_stock: 'I lager', reserved: 'Reserverad', sold: 'Såld', incoming: 'På väg hem' };
const displayMachineStatus = machine => Number(machine.stock_quantity ?? 1) <= 0 ? (Number(machine.incoming_quantity || 0) > 0 ? 'incoming' : Number(machine.sold_quantity || 0) > 0 ? 'sold' : machine.status) : machine.status;
const emptyForm = { machine_number: '', brand: '', model: '', year: '', hours: '', price: '', stock_quantity: '1', incoming_quantity: '0', description: '' };
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
  const [adminUsers, setAdminUsers] = useState([]);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [machinePhotos, setMachinePhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [activeReservations, setActiveReservations] = useState([]);
  const [reservationQuantity, setReservationQuantity] = useState('1');
  const [saleQuantity, setSaleQuantity] = useState('1');
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
  const [stockEdit, setStockEdit] = useState('1');
  const [incomingEdit, setIncomingEdit] = useState('0');
  const [receiveQuantity, setReceiveQuantity] = useState('1');
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
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLink, setRecoveryLink] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementComments, setAnnouncementComments] = useState({});
  const [announcementAttachments, setAnnouncementAttachments] = useState({});
  const [announcementFiles, setAnnouncementFiles] = useState([]);
  const [announcementText, setAnnouncementText] = useState({ title: '', body: '', category: 'Information', is_important: false });
  const [announcementCommentText, setAnnouncementCommentText] = useState({});
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [showDeletedAnnouncements, setShowDeletedAnnouncements] = useState(false);
  const [announcementDeleteBusy, setAnnouncementDeleteBusy] = useState(false);
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
        || await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setPushEnabled(false);
        return;
      }
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('endpoint', subscription.endpoint)
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) {
        setPushEnabled(false);
        setPushMessage('Kunde inte kontrollera notisinställningen: ' + error.message);
        return;
      }
      setPushEnabled(Boolean(data));
      if (!data) {
        setPushMessage('Telefonen har en pushprenumeration, men den är inte sparad på ditt konto. Tryck på Aktivera notiser för att koppla den.');
      }
    } catch (err) {
      setPushEnabled(false);
      setPushMessage('Kunde inte kontrollera notiserna: ' + (err?.message || 'Okänt fel.'));
    }
  }

  async function enablePushNotifications() {
    if (pushBusy || pushEnabled) return;
    setPushBusy(true);
    setPushMessage('Startar aktivering av notiser…');
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

      setPushMessage('Kontrollerar behörighet för notiser…');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error(permission === 'denied'
          ? 'Notiser är blockerade i telefonens inställningar. Tillåt notiser för MÖRE och försök igen.'
          : 'Du valde att inte tillåta notiser.');
      }

      setPushMessage('Ansluter till telefonens notistjänst…');
      const registration = await navigator.serviceWorker.getRegistration('/')
        || await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const readyRegistration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => window.setTimeout(
          () => reject(new Error('Appens service worker startade inte. Stäng appen helt, öppna den igen och försök på nytt.')),
          12000
        ))
      ]);
      const activeRegistration = readyRegistration || registration;
      let subscription = await activeRegistration.pushManager.getSubscription();
      if (!subscription) {
        setPushMessage('Skapar en säker notisprenumeration…');
        subscription = await activeRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      const subscriptionJson = subscription.toJSON();
      const keys = subscriptionJson.keys || {};
      if (!subscriptionJson.endpoint || !keys.p256dh || !keys.auth) {
        throw new Error('Telefonens pushprenumeration kunde inte läsas. Försök igen.');
      }

      setPushMessage('Sparar notisinställningen på ditt konto…');
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
      if (lookupError) throw new Error('Kunde inte kontrollera pushprenumerationen i databasen: ' + lookupError.message);

      const saveResult = existing
        ? await supabase.from('push_subscriptions').update(subscriptionRow).eq('id', existing.id)
        : await supabase.from('push_subscriptions').insert(subscriptionRow);
      if (saveResult.error) throw new Error('Kunde inte spara notisinställningen i databasen: ' + saveResult.error.message);

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
      const { data: reservationRows, error: reservationRowsError } = await supabase.from('reservations').select('machine_id, quantity, fulfilled_quantity').eq('status', 'active');
      const reservedByMachine = {};
      (reservationRows || []).forEach(r => { reservedByMachine[r.machine_id] = (reservedByMachine[r.machine_id] || 0) + Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)); });
      const rowsWithReservations = rows.map(m => ({ ...m, reserved_quantity: reservedByMachine[m.id] || 0, available_quantity: Math.max(0, Number(m.stock_quantity ?? 1) - (reservedByMachine[m.id] || 0)) }));
      const { data: photoRows, error: photoError } = await supabase
        .from('machine_photos')
        .select('id, machine_id, storage_path, is_primary')
        .in('machine_id', rows.map(machine => machine.id).length ? rows.map(machine => machine.id) : ['00000000-0000-0000-0000-000000000000']);
      if (photoError) {
        setError('Maskinerna kunde hämtas, men bilderna kunde inte hämtas: ' + photoError.message);
        setMachines(rowsWithReservations);
      } else {
        const primaryByMachine = {};
        (photoRows || []).forEach(photo => {
          if (photo.is_primary && !primaryByMachine[photo.machine_id]) {
            primaryByMachine[photo.machine_id] = supabase.storage.from('machine-photos').getPublicUrl(photo.storage_path).data.publicUrl;
          }
        });
        setMachines(rowsWithReservations.map(machine => ({ ...machine, main_photo_url: primaryByMachine[machine.id] || null }))); 
      }
    }
    setLoading(false);
  }

  async function loadAnnouncements(showDeleted = showDeletedAnnouncements) {
    if (!session) return;
    let announcementQuery = supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (!(isAdmin && showDeleted)) announcementQuery = announcementQuery.is('deleted_at', null);
    const { data, error } = await announcementQuery;
    if (error) { setError('Kunde inte hämta Interninfo: ' + error.message); return; }
    if (data?.length) {
      const ids = data.map(item => item.id);
      const [{ data: commentsData, error: commentsError }, { data: attachmentRows, error: attachmentError }] = await Promise.all([
        supabase.from('announcement_comments').select('*').in('announcement_id', ids).order('created_at', { ascending: true }),
        supabase.from('announcement_attachments').select('*').in('announcement_id', ids).order('created_at', { ascending: true }),
      ]);
      if (commentsError) setError('Kunde inte hämta kommentarer: ' + commentsError.message);
      else {
        const grouped = {};
        (commentsData || []).forEach(item => { (grouped[item.announcement_id] ||= []).push(item); });
        setAnnouncementComments(grouped);
      }
      const visibleAnnouncements = isAdmin && showDeleted
        ? data.filter(post => post.deleted_at || (commentsData || []).some(comment => comment.announcement_id === post.id && comment.deleted_at))
        : data;
      setAnnouncements(visibleAnnouncements || []);
      if (attachmentError) {
        setError('Kunde inte hämta bilagor: ' + attachmentError.message);
        setAnnouncementAttachments({});
      } else {
        const groupedAttachments = {};
        await Promise.all((attachmentRows || []).map(async attachment => {
          const { data: signedData, error: signedError } = await supabase.storage
            .from('interninfo-attachments').createSignedUrl(attachment.storage_path, 60 * 60);
          (groupedAttachments[attachment.announcement_id] ||= []).push({
            ...attachment,
            signedUrl: signedError ? null : signedData?.signedUrl || null,
          });
        }));
        setAnnouncementAttachments(groupedAttachments);
      }
    } else {
      setAnnouncements([]);
      setAnnouncementComments({});
      setAnnouncementAttachments({});
    }
  }

  async function publishAnnouncement(event) {
    event.preventDefault();
    if (!announcementText.title.trim() || !announcementText.body.trim()) return;
    if (announcementFiles.length > 5) { setError('Du kan bifoga högst 5 filer per inlägg.'); return; }
    const maxFileSize = 15 * 1024 * 1024;
    const allowedTypes = new Set([
      'image/jpeg','image/png','image/webp','image/gif','application/pdf',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain','text/csv'
    ]);
    const invalidFile = announcementFiles.find(file => file.size > maxFileSize || !allowedTypes.has(file.type));
    if (invalidFile) { setError(`Filen ${invalidFile.name} har en filtyp som inte stöds eller är större än 15 MB.`); return; }

    setAnnouncementBusy(true); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { data: announcement, error } = await supabase.from('announcements').insert({
      title: announcementText.title.trim(), body: announcementText.body.trim(),
      category: announcementText.category, is_important: announcementText.is_important, created_by: user.id
    }).select('id').single();
    if (error) {
      setError('Kunde inte publicera: ' + error.message);
    } else {
      let attachmentFailure = '';
      const uploadedPaths = [];
      const attachmentRows = [];
      for (const file of announcementFiles) {
        const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-100) || 'bilaga';
        const storagePath = `${announcement.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('interninfo-attachments').upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) { attachmentFailure = `Inlägget publicerades, men filen ${file.name} kunde inte laddas upp: ${uploadError.message}`; break; }
        uploadedPaths.push(storagePath);
        attachmentRows.push({
          announcement_id: announcement.id, uploaded_by: user.id, file_name: file.name,
          storage_path: storagePath, mime_type: file.type, file_size: file.size,
        });
      }
      if (!attachmentFailure && attachmentRows.length) {
        const { error: metadataError } = await supabase.from('announcement_attachments').insert(attachmentRows);
        if (metadataError) attachmentFailure = 'Inlägget publicerades, men bilagornas information kunde inte sparas: ' + metadataError.message;
      }
      if (attachmentFailure && uploadedPaths.length) {
        await supabase.storage.from('interninfo-attachments').remove(uploadedPaths);
      }

      setAnnouncementText({ title: '', body: '', category: 'Information', is_important: false });
      setAnnouncementFiles([]);
      setShowAnnouncementForm(false);
      await loadAnnouncements();
      if (attachmentFailure) setError(attachmentFailure);

      // Push is sent only for a newly published Interninfo post, never for comments.
      // Show progress immediately and always surface failures without undoing the post.
      setPushMessage('Inlägget publicerades. Skickar pushnotiser…');
      console.info('[MÖRE push] Starting send-interninfo-push', { announcementId: announcement.id });
      try {
        const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-interninfo-push', {
          body: { announcementId: announcement.id }
        });
        if (pushError || pushResult?.error) {
          const details = pushResult?.error || pushError?.message || 'Okänt fel från pushfunktionen.';
          console.error('[MÖRE push] Function invocation failed', pushError || pushResult);
          setPushMessage('Inlägget publicerades, men utskicket av notiser misslyckades: ' + details);
        } else if (pushResult?.sent > 0) {
          console.info('[MÖRE push] Delivery request completed', pushResult);
          setPushMessage(`Inlägget publicerades. ${pushResult.sent} pushnotis(er) skickades.`);
        } else {
          console.warn('[MÖRE push] No subscriptions received a notification', pushResult);
          setPushMessage(`Inlägget publicerades, men inga notiser skickades. ${pushResult?.failed || 0} misslyckades.`);
        }
      } catch (pushException) {
        console.error('[MÖRE push] Unexpected exception', pushException);
        setPushMessage('Inlägget publicerades, men pushanropet kunde inte genomföras: ' + (pushException?.message || 'Okänt nätverksfel.'));
      }
    }
    setAnnouncementBusy(false);
  }

  async function setAnnouncementDeleted(item, deleted) {
    const action = deleted ? 'ta bort' : 'återställa';
    if (!window.confirm(`Vill du ${action} inlägget \"${item.title}\"? ${deleted ? 'Inlägget döljs för personalen men kan återställas av admin.' : 'Inlägget blir synligt för personalen igen.'}`)) return;
    setAnnouncementDeleteBusy(true); setError('');
    const { error } = await supabase.rpc('admin_set_announcement_deleted', { p_announcement_id: item.id, p_deleted: deleted });
    if (error) setError(`Kunde inte ${action} inlägget: ` + error.message);
    else await loadAnnouncements();
    setAnnouncementDeleteBusy(false);
  }

  async function setAnnouncementCommentDeleted(comment, deleted) {
    const action = deleted ? 'ta bort' : 'återställa';
    if (!window.confirm(`Vill du ${action} den här kommentaren?`)) return;
    setAnnouncementDeleteBusy(true); setError('');
    const { error } = await supabase.rpc('admin_set_announcement_comment_deleted', { p_comment_id: comment.id, p_deleted: deleted });
    if (error) setError(`Kunde inte ${action} kommentaren: ` + error.message);
    else await loadAnnouncements();
    setAnnouncementDeleteBusy(false);
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

  async function loadAdminUsers() {
    setAdminUsersLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'list_users' } });
      if (error || data?.error) {
        setError(data?.error || error?.message || 'Kunde inte hämta personalen.');
        return;
      }
      setAdminUsers(Array.isArray(data?.users) ? data.users : []);
    } catch (loadError) {
      setError(loadError?.message || 'Kunde inte hämta personalen.');
    } finally {
      setAdminUsersLoading(false);
    }
  }

  useEffect(() => { if (session) { loadMachines(); loadProfiles(); loadAnnouncements(); } }, [session]);

  const filtered = useMemo(() => machines.filter(m => {
    const q = search.toLowerCase();
    const matches = [m.machine_number, m.brand, m.model].some(v => String(v || '').toLowerCase().includes(q));
    return matches && (filter === 'all' || (filter === 'sold' ? Number(m.sold_quantity || 0) > 0 || m.status === 'sold' : filter === 'incoming' ? Number(m.incoming_quantity || 0) > 0 : filter === 'reserved' ? Number(m.reserved_quantity || 0) > 0 : filter === 'in_stock' ? Number(m.available_quantity ?? m.stock_quantity ?? 1) > 0 : m.status === filter));
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
    const payload = { ...form, year: form.year ? Number(form.year) : null, hours: form.hours ? Number(form.hours) : null, price: form.price ? Number(form.price) : null, stock_quantity: Math.max(0, Number.parseInt(form.stock_quantity, 10) || 0), incoming_quantity: Math.max(0, Number.parseInt(form.incoming_quantity, 10) || 0), status: (Number.parseInt(form.stock_quantity, 10) || 0) > 0 ? 'in_stock' : (Number.parseInt(form.incoming_quantity, 10) || 0) > 0 ? 'incoming' : 'sold', created_by: user.id };
    const { error } = await supabase.from('machines').insert(payload);
    if (error) setError(error.message); else { setShowAdd(false); setForm(emptyForm); await loadMachines(); }
  }

  async function loadMachineDetails(machine) {
    const { data: freshMachine, error: freshMachineError } = await supabase.from('machines').select('*').eq('id', machine.id).single();
    if (freshMachineError) { setError(freshMachineError.message); return; }
    machine = { ...machine, ...freshMachine };
    setSelected(machine);
    setStockEdit(String(machine.stock_quantity ?? 1)); setIncomingEdit(String(machine.incoming_quantity ?? 0)); setReceiveQuantity('1'); setError(''); setComments([]); setHistory([]); setMachinePhotos([]); setActiveReservations([]);
    const [c, h, r, p] = await Promise.all([
      supabase.from('comments').select('*').eq('machine_id', machine.id).order('created_at', { ascending: false }),
      supabase.from('machine_history').select('*').eq('machine_id', machine.id).order('created_at', { ascending: false }),
      supabase.from('reservations').select('*').eq('machine_id', machine.id).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('machine_photos').select('*').eq('machine_id', machine.id).order('created_at', { ascending: true })
    ]);
    if (c.error) setError(c.error.message); else setComments(c.data || []);
    if (h.error) setError(h.error.message); else setHistory(h.data || []);
    if (r.error) setError(r.error.message); else { const reservations = r.data || []; setActiveReservations(reservations); const reservedQuantity = reservations.reduce((n, item) => n + Math.max(0, Number(item.quantity || 1) - Number(item.fulfilled_quantity || 0)), 0); setSelected(current => current?.id === machine.id ? { ...current, reserved_quantity: reservedQuantity, available_quantity: Math.max(0, Number(current.stock_quantity ?? 1) - reservedQuantity) } : current); }
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
    const amount = Number.parseInt(reservationQuantity, 10);
    if (!Number.isInteger(amount) || amount < 1) { setError('Ange ett giltigt antal att reservera.'); return; }
    setSaving(true); setError('');
    const { data, error: reservationError } = await supabase.rpc('reserve_machine', {
      p_machine_id: selected.id, p_customer_name: customerName, p_reservation_date: reservationDate || null, p_quantity: amount, p_reserved_by: reservedBy || null
    });
    if (reservationError) setError(reservationError.message);
    else {
      setShowReservation(false); setCustomerName(''); setReservedBy(''); setReservationDate(''); setReservationQuantity('1');
      await loadMachines(); await loadMachineDetails(selected);
    }
    setSaving(false);
  }

  async function cancelReservation(reservationId) {
    if (!selected || !reservationId) return;
    setError('');
    const { error } = await supabase.rpc('cancel_machine_reservation', { p_reservation_id: reservationId });
    if (error) { setError(error.message); return; }
    await loadMachines(); await loadMachineDetails(selected);
  }

  async function saveStockQuantity() {
    if (!selected) return;
    const nextStock = Number.parseInt(stockEdit, 10);
    if (!Number.isInteger(nextStock) || nextStock < 0) { setError('Ange ett giltigt antal, 0 eller högre.'); return; }
    const reservedNow = activeReservations.reduce((n, r) => n + Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)), 0);
    if (nextStock < reservedNow) { setError(`Lagersaldot kan inte sättas lägre än ${reservedNow} eftersom så många exemplar är reserverade.`); return; }
    const nextStatus = nextStock > 0 ? (selected.status === 'reserved' ? 'reserved' : 'in_stock') : (Number(selected.incoming_quantity || 0) > 0 ? 'incoming' : Number(selected.sold_quantity || 0) > 0 ? 'sold' : selected.status);
    const { error } = await supabase.from('machines').update({ stock_quantity: nextStock, status: nextStatus }).eq('id', selected.id);
    if (error) { setError('Lagersaldot kunde inte uppdateras: ' + error.message); return; }
    const updated = { ...selected, stock_quantity: nextStock, status: nextStatus };
    setSelected(updated);
    await loadMachines();
  }

  async function saveIncomingQuantity() {
    if (!selected) return;
    const nextIncoming = Number.parseInt(incomingEdit, 10);
    if (!Number.isInteger(nextIncoming) || nextIncoming < 0) { setError('Ange ett giltigt antal på väg hem, 0 eller högre.'); return; }
    const { error } = await supabase.from('machines').update({ incoming_quantity: nextIncoming }).eq('id', selected.id);
    if (error) { setError('Antalet på väg hem kunde inte uppdateras: ' + error.message); return; }
    const updated = { ...selected, incoming_quantity: nextIncoming };
    setSelected(updated);
    await loadMachines();
  }

  async function receiveIncomingQuantity() {
    if (!selected) return;
    const amount = Number.parseInt(receiveQuantity, 10);
    const incoming = Math.max(0, Number(selected.incoming_quantity || 0));
    if (!Number.isInteger(amount) || amount < 1) { setError('Ange hur många exemplar som har kommit hem.'); return; }
    if (amount > incoming) { setError(`Det finns bara ${incoming} st registrerade på väg hem.`); return; }
    const nextIncoming = incoming - amount;
    const nextStock = Math.max(0, Number(selected.stock_quantity ?? 0)) + amount;
    const nextStatus = selected.status === 'reserved' ? 'reserved' : 'in_stock';
    const { error } = await supabase.from('machines').update({ incoming_quantity: nextIncoming, stock_quantity: nextStock, status: nextStatus }).eq('id', selected.id);
    if (error) { setError('Leveransen kunde inte registreras: ' + error.message); return; }
    const updated = { ...selected, incoming_quantity: nextIncoming, stock_quantity: nextStock, status: nextStatus };
    setSelected(updated); setStockEdit(String(nextStock)); setIncomingEdit(String(nextIncoming)); setReceiveQuantity('1');
    await loadMachines();
  }

  async function markSold(reservationId = null) {
    if (!selected) return;
    const amount = Number.parseInt(saleQuantity, 10);
    if (!Number.isInteger(amount) || amount < 1) { setError('Ange ett giltigt antal att sälja.'); return; }
    setError(''); setSaving(true);
    const { error } = await supabase.rpc('sell_machine_quantity', {
      p_machine_id: selected.id, p_quantity: amount, p_reservation_id: reservationId
    });
    if (error) setError(error.message);
    else { setSaleQuantity('1'); await loadMachines(); await loadMachineDetails(selected); }
    setSaving(false);
  }

  async function restoreSoldMachine() {
    if (!selected) return;
    const currentStock = Math.max(0, Number(selected.stock_quantity ?? 0));
    const currentSold = Math.max(0, Number(selected.sold_quantity || 0));
    if (currentSold <= 0) { setError('Det finns inga sålda exemplar att återställa.'); return; }
    const nextSold = currentSold - 1;
    const restoredStock = currentStock + 1; const reservedNow = activeReservations.reduce((n, r) => n + Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)), 0); const restoredStatus = reservedNow > 0 ? 'reserved' : 'in_stock';
    const { error } = await supabase.from('machines').update({ stock_quantity: restoredStock, sold_quantity: nextSold, status: restoredStatus }).eq('id', selected.id);
    if (error) setError(error.message);
    else { await loadMachines(); await loadMachineDetails({ ...selected, stock_quantity: restoredStock, sold_quantity: nextSold, status: restoredStatus }); }
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
      await Promise.all([loadProfiles(), loadAdminUsers()]);
      alert('Inbjudan skickad till ' + invitedEmail + '.');
    }
    setAdminBusy(false);
  }

  async function createRecoveryLink(event) {
    event.preventDefault();
    setAdminBusy(true); setError(''); setRecoveryLink('');
    const { data, error } = await supabase.functions.invoke('admin-users', {
      body: { action: 'recovery_link', email: recoveryEmail.trim(), redirect_to: window.location.origin }
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

  async function updateAdminUser(action, user, role) {
    if (!user?.id || adminBusy) return;
    const label = action === 'deactivate' ? 'avaktivera' : action === 'reactivate' ? 'återaktivera' : 'ändra behörighet för';
    const detail = action === 'change_role' ? ` till ${role === 'admin' ? 'Administratör' : 'Säljare'}` : '';
    if (!window.confirm(`Vill du ${label} ${user.full_name || user.email}${detail}?`)) return;
    setAdminBusy(true); setError('');
    const body = action === 'change_role'
      ? { action, user_id: user.id, role }
      : { action, user_id: user.id };
    const { data, error } = await supabase.functions.invoke('admin-users', { body });
    if (error || data?.error) {
      setError(data?.error || error.message || 'Åtgärden kunde inte genomföras.');
    } else {
      await Promise.all([loadAdminUsers(), loadProfiles()]);
    }
    setAdminBusy(false);
  }

  const date = value => value ? new Date(value).toLocaleDateString('sv-SE') : '–';
  const dateTime = value => value ? new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '';

  if (session && passwordFlow) return <main className="login"><div className="brand">MÖRE<span /></div><section className="login-card"><p className="eyebrow">KONTOINSTÄLLNING</p><h1>{passwordFlow === 'recovery' ? 'Nytt lösenord' : 'Skapa ditt lösenord'}</h1><p className="muted">{passwordNotice || 'Välj ett personligt lösenord för ditt konto.'}</p><form onSubmit={saveNewPassword}><label>Nytt lösenord<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required /></label><label>Bekräfta lösenord<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required /></label><button className="primary wide" disabled={passwordBusy}>{passwordBusy ? 'Sparar…' : 'Spara lösenord'}</button></form>{error && <p className="error">{error}</p>}</section></main>;

  if (!session) return <main className="login"><div className="brand">MÖRE<span /></div><section className="login-card"><p className="eyebrow">INTERNT MASKINREGISTER</p><h1>{passwordFlow === 'forgot' ? 'Återställ lösenord' : 'Välkommen'}</h1><p className="muted">{passwordFlow === 'forgot' ? 'Ange din e-postadress så skickar vi en återställningslänk.' : 'Logga in med ditt personliga konto.'}</p>{passwordFlow === 'forgot' ? <form onSubmit={requestPasswordReset}><label>E-post<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><button className="primary wide" disabled={passwordBusy}>{passwordBusy ? 'Skickar…' : 'Skicka återställningslänk'}</button><button type="button" className="wide" style={{ background: "transparent", color: "#ddd", border: "1px solid #444", borderRadius: 7, padding: 11 }} onClick={() => { setPasswordFlow(''); setError(''); setPasswordNotice(''); }}>Tillbaka till inloggning</button></form> : <form onSubmit={signIn}><label>E-post<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Lösenord<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button className="primary wide">Logga in</button><button type="button" className="wide" style={{ background: "transparent", color: "#ddd", border: "1px solid #444", borderRadius: 7, padding: 11 }} onClick={() => { setPasswordFlow('forgot'); setError(''); setPasswordNotice(''); }}>Glömt lösenord?</button></form>}{passwordNotice && <p className="muted">{passwordNotice}</p>}{error && <p className="error">{error}</p>}</section></main>;

  return <main className="app-shell">
    <style>{`
      /* Säkerställ att appens innehåll alltid följer enhetens faktiska bredd. */
      .app-shell{width:100%;max-width:1200px;min-width:0;margin-left:auto;margin-right:auto;box-sizing:border-box;}
      .app-shell *{box-sizing:border-box;}
      .app-shell .topbar,.app-shell .main-tabs,.app-shell .hero,.app-shell .toolbar,.app-shell .stats,.app-shell .machine-grid{min-width:0;max-width:100%;}
      .app-shell .search{min-width:0;width:100%;}
      .app-shell .search input{min-width:0;}
      .app-shell .stats>div{min-width:0;}
      .app-shell .machine-card{min-width:0;width:100%;}
      @media(max-width:520px){
        .app-shell{width:100%;max-width:100%;padding-left:14px;padding-right:14px;overflow-x:clip;}
        .app-shell .topbar{width:100%;gap:8px;}
        .app-shell .top-actions{min-width:0;gap:6px;}
        .app-shell .push-notification-button{max-width: min(48vw,190px);overflow:hidden;text-overflow:ellipsis;}
        .app-shell .stats{grid-template-columns:repeat(2,minmax(0,1fr));}
        .app-shell .machine-grid{grid-template-columns:minmax(0,1fr);}
      }
      .main-tabs{display:flex;gap:10px;padding:12px 0 18px;border-bottom:1px solid #303030}
      .push-notification-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 11px;font-size:12px;white-space:nowrap}
      .push-notification-button:disabled{opacity:.75;cursor:default}
      @media(max-width:520px){.top-actions{gap:6px}.push-notification-button{padding:8px 9px;font-size:11px}}
      .main-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:11px 18px;border-radius:9px;border:1px solid #3b3b3b;background:#202020;color:#c9c9c9;font-weight:650;cursor:pointer;transition:background .15s,border-color .15s}
      .main-tabs button.active{background:#3a1719;border-color:#d92730;color:#fff}
      .announcement-list{display:grid;gap:16px;margin-top:22px}
      .admin-user-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:13px 0;border-bottom:1px solid #333}
      .admin-user-main{display:flex;flex-direction:column;gap:4px;min-width:150px}
      .admin-user-main small{color:#999;overflow-wrap:anywhere}
      .admin-user-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .admin-user-controls select,.admin-status-button{background:#242424;color:#eee;border:1px solid #555;border-radius:7px;padding:8px 10px;font:inherit;font-size:13px}
      .admin-status-button{border-color:#8b3434;color:#ff9a9a}
      .admin-user-controls button:disabled,.admin-user-controls select:disabled{opacity:.55}
      .admin-users-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .admin-refresh-button{display:inline-flex;align-items:center;gap:7px;background:#242424;color:#eee;border:1px solid #555;border-radius:7px;padding:8px 10px;font:inherit;font-size:13px}
      .admin-refresh-button:disabled{opacity:.55;cursor:wait}
      .machine-photo img{width:100%;height:100%;object-fit:cover;border-radius:10px}
      .status.partial_sold{background:#493817;color:#f2c66d;border:1px solid #765b25}
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
      .inventory-controls{display:grid;gap:14px;margin-top:18px}
      .inventory-controls .quantity-control{display:grid;grid-template-columns:minmax(0,1fr) 112px;gap:10px 14px;align-items:center;padding:15px;background:#151515;border:1px solid #383838;border-radius:10px}
      .inventory-controls .quantity-heading{display:flex;flex-direction:column;gap:3px;min-width:0}
      .inventory-controls .quantity-heading strong{font-size:15px;color:#f2f2f2}
      .inventory-controls .quantity-heading span{font-size:12px;line-height:1.35;color:#999}
      .inventory-controls input{width:100%;min-width:0;height:44px;padding:8px 11px;border:1px solid #555;border-radius:8px;background:#fff;color:#171717;font:inherit;font-size:17px}
      .inventory-controls button{grid-column:1/-1;width:100%;min-height:43px;padding:10px 13px;border-radius:8px;font-size:14px}
      .inventory-controls button:disabled{opacity:.42}
      .inventory-controls .receive-panel{grid-column:1/-1;display:grid;gap:10px;padding-top:12px;border-top:1px solid #383838}
      .inventory-controls .receive-panel p{margin:0;font-size:13px;line-height:1.45}
      .inventory-controls .receive-panel label{display:grid;grid-template-columns:minmax(0,1fr) 112px;gap:10px;align-items:center}
      .inventory-controls .receive-panel label strong{font-size:14px}
      .inventory-controls .sold-total{margin:0;padding:2px 2px 0}
      .detail-section label.primary,.detail-section label.button{padding:10px 14px;border-radius:8px}
      .detail-section label.button{background:#292929;color:#eee;border:1px solid #555}
      .announcement-card{width:100%;max-width:none;background:#191919;border:1px solid #353535;border-radius:12px;padding:22px}
      .announcement-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#e45a60;font-size:13px;font-weight:700}
      .announcement-meta small{color:#999;font-weight:400}
      .announcement-author{display:flex;align-items:center;gap:8px;margin:10px 0 14px;color:#bdbdbd;font-size:13px}
      .announcement-author strong{color:#f1f1f1;font-weight:650}
      .announcement-card h2{margin:8px 0 12px}
      .announcement-body{white-space:pre-wrap;line-height:1.6;color:#e0e0e0}
      .comment-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:5px}
      .comment-footer>small{min-width:0;overflow-wrap:anywhere;color:#aaa}
      .comment-delete-button{display:inline-flex!important;align-items:center;justify-content:center;gap:6px;width:auto!important;min-height:30px;padding:5px 9px!important;margin:0!important;border:1px solid #633438!important;border-radius:7px!important;background:#24191a!important;color:#f08080!important;font:inherit!important;font-size:12px!important;line-height:1.2;white-space:nowrap;box-shadow:none!important}
      .comment-delete-button:hover:not(:disabled){background:#351d1f!important;border-color:#9b454b!important;color:#ff9a9a!important}
      .comment-delete-button:disabled{opacity:.55;cursor:wait}
      .announcement-attachments{display:grid;gap:8px;margin:14px 0;padding:12px;border:1px solid #383838;border-radius:9px;background:#151515}
      .announcement-attachment{display:flex;align-items:center;gap:9px;min-width:0;color:#f1f1f1;text-decoration:none;padding:7px 4px}
      .announcement-attachment:hover{color:#ff7777}
      .announcement-attachment span{overflow-wrap:anywhere;flex:1}
      .announcement-attachment small{color:#999;white-space:nowrap}
      .announcement-file-picker{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px;border:1px dashed #555;border-radius:9px}
      .announcement-file-list{display:grid;gap:6px;width:100%;color:#bbb;font-size:13px}
      .announcement-file-list span{display:flex;align-items:center;gap:7px;overflow-wrap:anywhere}
      .main-tabs button:focus-visible{outline:2px solid #e34a50;outline-offset:2px}
      @media(max-width:520px){.main-tabs button{flex:1;padding:10px 8px;font-size:14px}.announcement-card{padding:17px}}
    `}</style>
    <header className="topbar"><div className="brand">MÖRE<span /></div><div className="top-actions"><span className="staff">PERSONAL</span><button className="primary push-notification-button" onClick={enablePushNotifications} disabled={pushBusy || pushEnabled} title={pushEnabled ? 'Pushnotiser är aktiverade på den här enheten' : 'Aktivera pushnotiser på den här enheten'}>{pushEnabled ? <BellRing size={16} /> : <Bell size={16} />}{pushBusy ? 'Aktiverar…' : pushEnabled ? 'Notiser aktiverade' : 'Aktivera notiser'}</button>{isAdmin && <button className="icon-btn" onClick={() => { setShowAdmin(true); setError(''); loadAdminUsers(); }} aria-label="Personaladministration"><Users size={18} /></button>}<button className="icon-btn" onClick={loadMachines} aria-label="Uppdatera"><RefreshCw size={18} /></button><button className="icon-btn" onClick={signOut} aria-label="Logga ut"><LogOut size={18} /></button></div></header>
    <nav className="main-tabs"><button className={!showInternInfo ? 'active' : ''} onClick={() => setShowInternInfo(false)}><Package size={16} /> Maskiner</button><button className={showInternInfo ? 'active' : ''} onClick={() => { setShowInternInfo(true); loadAnnouncements(); }}><Megaphone size={16} /> Interninfo</button></nav>
    {pushMessage && <p className="muted" role="status" style={{ margin: '10px 0', fontSize: 13 }}>{pushMessage}</p>}
    {showInternInfo ? <>
      <section className="hero"><div><p className="eyebrow">INTERN KOMMUNIKATION</p><h1>Interninfo</h1><p className="muted">Nyheter och information från hela teamet.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>{isAdmin && <button type="button" onClick={() => { const next = !showDeletedAnnouncements; setShowDeletedAnnouncements(next); loadAnnouncements(next); }}>{showDeletedAnnouncements ? 'Visa aktiva inlägg' : 'Visa borttagna'}</button>}<button className="primary add-btn" onClick={() => setShowAnnouncementForm(v => !v)}><Plus size={18} /> Skriv inlägg</button></div></section>
      {showAnnouncementForm && <section className="dialog announcement-compose"><h2>Nytt inlägg</h2><form className="machine-form" onSubmit={publishAnnouncement}><label className="full">Rubrik<input value={announcementText.title} onChange={e => setAnnouncementText(v => ({ ...v, title: e.target.value }))} required maxLength={140} placeholder="Vad gäller informationen?" /></label><label className="full">Kategori<select value={announcementText.category} onChange={e => setAnnouncementText(v => ({ ...v, category: e.target.value }))}><option>Information</option><option>Nyhet</option><option>Driftinformation</option><option>Viktigt</option></select></label><label className="full">Meddelande<textarea rows={5} value={announcementText.body} onChange={e => setAnnouncementText(v => ({ ...v, body: e.target.value }))} required placeholder="Skriv informationen här…" /></label><label className="full checkbox-line"><input type="checkbox" checked={announcementText.is_important} onChange={e => setAnnouncementText(v => ({ ...v, is_important: e.target.checked }))} /> Markera som viktig information</label><div className="full announcement-file-picker"><label className="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: announcementBusy ? 'wait' : 'pointer' }}><Paperclip size={16} /> Lägg till bilagor<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" onChange={e => { const picked = Array.from(e.target.files || []); setAnnouncementFiles(current => [...current, ...picked].slice(0, 5)); e.target.value = ''; }} disabled={announcementBusy} style={{ display: 'none' }} /></label><small className="muted">Max 5 filer, 15 MB per fil. Bilder, PDF och Office-dokument.</small>{announcementFiles.length > 0 && <div className="announcement-file-list">{announcementFiles.map((file, index) => <span key={`${file.name}-${file.size}-${index}`}><FileText size={14} /> {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB) <button type="button" onClick={() => setAnnouncementFiles(current => current.filter((_, i) => i !== index))} disabled={announcementBusy} aria-label={`Ta bort ${file.name}`}><X size={14} /></button></span>)}</div>}</div><button className="primary wide" disabled={announcementBusy}>{announcementBusy ? 'Publicerar…' : 'Publicera'}</button><button type="button" className="wide" onClick={() => setShowAnnouncementForm(false)}>Avbryt</button></form></section>}
      {announcements.length === 0 ? <div className="empty"><Megaphone size={32} /><h3>{showDeletedAnnouncements ? 'Inga borttagna inlägg' : 'Ingen intern information ännu'}</h3><p>{showDeletedAnnouncements ? 'Det finns inga borttagna inlägg att återställa.' : 'Här visas nyheter och meddelanden från medarbetarna.'}</p></div> : <section className="announcement-list">{announcements.map(item => <article className="dialog announcement-card" key={item.id}><div className="announcement-meta"><span>{item.category || 'Information'}{item.deleted_at ? ' · BORTTAGET' : ''}</span><small>{dateTime(item.created_at)}</small></div><div className="announcement-author"><span>Publicerat av</span><strong>{profiles.find(profile => profile.id === item.created_by)?.full_name || 'Medarbetare'}</strong></div>{item.is_important && <p className="important-label"><AlertCircle size={15} /> Viktig information</p>}<h2>{item.title}</h2><p className="announcement-body">{item.body}</p>{isAdmin && <div className="dialog-actions" style={{marginTop:12}}>{item.deleted_at ? <button type="button" className="primary" onClick={() => setAnnouncementDeleted(item, false)} disabled={announcementDeleteBusy}><RefreshCw size={15} /> Återställ inlägg</button> : <button type="button" onClick={() => setAnnouncementDeleted(item, true)} disabled={announcementDeleteBusy} style={{color:'#f08080'}}><Trash2 size={15} /> Ta bort inlägg</button>}</div>}{(announcementAttachments[item.id] || []).length > 0 && <div className="announcement-attachments"><strong><Paperclip size={15} style={{ verticalAlign: 'middle' }} /> Bilagor</strong>{announcementAttachments[item.id].map(file => <a className="announcement-attachment" key={file.id} href={file.signedUrl || undefined} target="_blank" rel="noreferrer" onClick={e => { if (!file.signedUrl) { e.preventDefault(); setError('Bilagan kunde inte öppnas. Uppdatera Interninfo och försök igen.'); } }}><FileText size={17} /><span>{file.file_name}</span><small>{(file.file_size / 1024 / 1024).toFixed(1)} MB</small><Download size={15} /></a>)}</div>}<div className="detail-section">{(announcementComments[item.id] || []).filter(comment => showDeletedAnnouncements ? Boolean(comment.deleted_at) : !comment.deleted_at).length > 0 && <h3><MessageSquare size={17} /> Kommentarer ({(announcementComments[item.id] || []).filter(comment => showDeletedAnnouncements ? Boolean(comment.deleted_at) : !comment.deleted_at).length})</h3>}{(announcementComments[item.id] || []).filter(comment => showDeletedAnnouncements ? Boolean(comment.deleted_at) : !comment.deleted_at).map(comment => <div className="comment-item" key={comment.id} style={comment.deleted_at ? {opacity:0.65,borderLeft:'3px solid #a33',paddingLeft:10} : undefined}><p>{comment.message}</p><div className="comment-footer"><small>{profiles.find(profile => profile.id === comment.user_id)?.full_name || 'Medarbetare'} · {dateTime(comment.created_at)}{comment.deleted_at ? ' · BORTTAGEN' : ''}</small>{isAdmin && <button className="comment-delete-button" type="button" onClick={() => setAnnouncementCommentDeleted(comment, !comment.deleted_at)} disabled={announcementDeleteBusy}>{comment.deleted_at ? <><RefreshCw size={14}/> Återställ</> : <><Trash2 size={14}/> Ta bort</>}</button>}</div></div>)}{!showDeletedAnnouncements && !item.deleted_at && <form className="comment-form" onSubmit={event => addAnnouncementComment(event, item.id)}><textarea rows={2} placeholder="Skriv en kommentar eller fråga…" value={announcementCommentText[item.id] || ''} onChange={e => setAnnouncementCommentText(v => ({ ...v, [item.id]: e.target.value }))} required /><button className="primary" disabled={!(announcementCommentText[item.id] || '').trim()}><Send size={16} /> Skicka</button></form>}</div></article>)}</section>}
    </> : <>
    <section className="hero"><div><p className="eyebrow">MASKINÖVERSIKT</p><h1>Maskiner</h1><p className="muted">Lager, reservationer och försäljning på ett ställe.</p></div><button className="primary add-btn" onClick={() => setShowAdd(true)}><Plus size={18} /> Lägg till maskin</button></section>
    <section className="toolbar"><div className="search"><Search size={18} /><input placeholder="Sök maskinnummer, fabrikat eller modell…" value={search} onChange={e => setSearch(e.target.value)} /></div></section>
    <section className="stats">
      {[
        { value: 'in_stock', label: 'I lager', count: machines.reduce((sum, m) => sum + Math.max(0, Number(m.stock_quantity ?? 1)), 0), Icon: Tag },
        { value: 'incoming', label: 'På väg hem', count: machines.reduce((sum, m) => sum + Math.max(0, Number(m.incoming_quantity || 0)), 0), Icon: Package },
        { value: 'reserved', label: 'Reserverade', count: machines.reduce((sum, m) => sum + Math.max(0, Number(m.reserved_quantity || 0)), 0), Icon: Clock3 },
        { value: 'sold', label: 'Sålda', count: machines.reduce((sum, m) => sum + Math.max(0, Number(m.sold_quantity || 0)), 0), Icon: CheckCircle2 }
      ].map(({ value, label, count, Icon }) => (
        <div
          key={value}
          role="button"
          tabIndex={0}
          aria-pressed={filter === value}
          title={`Visa ${label.toLowerCase()} maskiner`}
          onClick={() => setFilter(value)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setFilter(value);
            }
          }}
          style={{ cursor: 'pointer', borderColor: filter === value ? '#d92730' : undefined, background: filter === value ? '#2b1718' : undefined }}
        >
          <Icon /><strong>{count}</strong><span>{label}</span>
        </div>
      ))}
    </section>
    {error && <div className="error-banner">{error}</div>}
    {loading ? <p className="empty">Hämtar maskiner…</p> : filtered.length === 0 ? <div className="empty"><Package size={34} /><h3>Inga maskiner att visa</h3><p>Prova att ändra sökning eller filter, eller lägg till en maskin.</p></div> : <section className="machine-grid">{filtered.map(machine => <button className="machine-card" key={machine.id} onClick={() => loadMachineDetails(machine)}><div className="machine-photo">{machine.main_photo_url ? <img src={machine.main_photo_url} alt={`${machine.brand || ''} ${machine.model || 'Maskin'}`} /> : <Package size={36} />}<span className={'status ' + (filter === 'sold' && Number(machine.sold_quantity || 0) > 0 ? 'sold' : displayMachineStatus(machine))}>{filter === 'sold' && Number(machine.sold_quantity || 0) > 0 ? 'Såld' : (filter === 'incoming' && Number(machine.incoming_quantity || 0) > 0 && Number(machine.stock_quantity ?? 1) <= 0 ? 'På väg hem' : (statusLabel[displayMachineStatus(machine)] || displayMachineStatus(machine)))}</span></div><div className="machine-info"><p className="machine-no">{machine.machine_number || 'Inget maskinnummer'}</p><h3>{[machine.brand,machine.model].filter(Boolean).join(' ') || 'Maskin'}</h3><div className="details"><span>{machine.year || 'Årsmodell saknas'}</span><span>{machine.hours != null ? `${machine.hours.toLocaleString('sv-SE')} h` : 'Timmar saknas'}</span></div><div className="details"><span>Antal i lager: <strong>{Number(machine.stock_quantity ?? 1)} st</strong></span>{Number(machine.sold_quantity || 0) > 0 && <span>Sålda: <strong>{Number(machine.sold_quantity)} st</strong></span>}{Number(machine.incoming_quantity || 0) > 0 && <span>På väg hem: <strong>{Number(machine.incoming_quantity)} st</strong></span>}</div><strong className="price">{machine.price != null ? `${Number(machine.price).toLocaleString('sv-SE')} kr` : 'Pris saknas'}</strong></div></button>)}</section>}

    {selected && <div className="overlay" onClick={() => setSelected(null)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setSelected(null)}><X /></button><p className="eyebrow">MASKINDETALJER</p><h2>{selected.brand} {selected.model}</h2><p className="muted">{selected.machine_number}</p><p>{selected.description || 'Ingen beskrivning registrerad.'}</p><div className="details"><span>Årsmodell: {selected.year || '–'}</span><span>Timmar: {selected.hours ?? '–'}</span></div><strong className="price">{selected.price != null ? `${Number(selected.price).toLocaleString('sv-SE')} kr` : 'Pris saknas'}</strong><p className="muted">Status: {statusLabel[displayMachineStatus(selected)] || displayMachineStatus(selected)}</p><div className="detail-section inventory-controls"><div className="quantity-control"><div className="quantity-heading"><strong>Antal i lager</strong><span>Fysiskt på plats</span></div><input aria-label="Antal i lager" type="number" min="0" step="1" value={stockEdit} onChange={e => setStockEdit(e.target.value)} /><button className="primary" onClick={saveStockQuantity} disabled={Number(stockEdit) === Number(selected.stock_quantity ?? 1)}>Spara lagersaldo</button></div><div className="quantity-control"><div className="quantity-heading"><strong>Antal på väg hem</strong><span>Beställt men ännu inte levererat</span></div><input aria-label="Antal på väg hem" type="number" min="0" step="1" value={incomingEdit} onChange={e => setIncomingEdit(e.target.value)} /><button onClick={saveIncomingQuantity} disabled={Number(incomingEdit) === Number(selected.incoming_quantity || 0)}>Spara antal på väg hem</button>{Number(selected.incoming_quantity || 0) > 0 && <div className="receive-panel"><p className="muted">Ta emot en hel eller del av leveransen. Antalet flyttas då till lagret.</p><label><strong>Antal mottagna</strong><input type="number" min="1" max={Number(selected.incoming_quantity)} step="1" value={receiveQuantity} onChange={e => setReceiveQuantity(e.target.value)} /></label><button className="primary" onClick={receiveIncomingQuantity}>Ta emot leverans</button></div>}</div>{Number(selected.sold_quantity || 0) > 0 && <p className="muted sold-total"><strong>Sålda totalt:</strong> {Number(selected.sold_quantity)} st</p>}</div>
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
      <div className="reservation-info inventory-summary"><h3>Lager och reservationer</h3><p>I lager: <strong>{Number(selected.stock_quantity ?? 1)} st</strong></p><p>Reserverade: <strong>{activeReservations.reduce((n, r) => n + Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)), 0)} st</strong></p><p>Tillgängliga: <strong>{Math.max(0, Number(selected.stock_quantity ?? 1) - activeReservations.reduce((n, r) => n + Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)), 0))} st</strong></p>
      {Number(selected.stock_quantity ?? 1) - activeReservations.reduce((n, r) => n + Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)), 0) > 0 && <><label className="full">Antal att sälja direkt<input type="number" min="1" max={Math.max(0, Number(selected.stock_quantity ?? 1) - activeReservations.reduce((n, r) => n + Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)), 0))} value={saleQuantity} onChange={e => setSaleQuantity(e.target.value)} /></label><button className="primary" onClick={() => markSold(null)} disabled={saving}>Sälj från lagret</button></>}
      {activeReservations.length > 0 && <><h3>Aktiva reservationer</h3>{activeReservations.map(r => { const remaining = Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)); return <div className="history-item reservation-row" key={r.id}><strong>{r.customer_name}</strong><small>{remaining} st kvar att leverera · {date(r.reservation_date)} · {profiles.find(p => p.id === r.reserved_by)?.full_name || 'Namn saknas'}</small><label className="full">Antal att sälja från reservation<input type="number" min="1" max={remaining} value={saleQuantity} onChange={e => setSaleQuantity(e.target.value)} /></label><button className="primary" onClick={() => markSold(r.id)} disabled={saving}>Sälj från reservation</button><button onClick={() => cancelReservation(r.id)}><Ban size={16} /> Avboka återstående antal</button></div>; })}</>}
      <button onClick={() => { setReservationQuantity('1'); setShowReservation(true); }} disabled={Math.max(0, Number(selected.stock_quantity ?? 1) - activeReservations.reduce((n, r) => n + Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)), 0)) <= 0}><CalendarDays size={16} /> Reservera</button>
      </div>
      {Number(selected.sold_quantity || 0) > 0 && <div className="dialog-actions"><button onClick={restoreSoldMachine}>Återställ 1 såld till lager</button></div>}
      <div className="detail-section"><h3><MessageSquare size={18} /> Kommentarer</h3><form onSubmit={addComment} className="comment-form"><textarea placeholder="Skriv en kommentar om maskinen…" value={commentText} onChange={e => setCommentText(e.target.value)} required /><button className="primary" disabled={!commentText.trim()}><Send size={16} /> Skicka</button></form>{comments.length === 0 ? <p className="muted">Inga kommentarer ännu.</p> : comments.map(c => <div className="comment-item" key={c.id}><p>{c.message}</p><small>{dateTime(c.created_at)}</small></div>)}</div>
      <div className="detail-section"><h3><History size={18} /> Maskinhistorik</h3>{history.length === 0 ? <p className="muted">Ingen historik registrerad ännu.</p> : history.map(h => <div className="history-item" key={h.id}><strong>{h.action}</strong><small>{dateTime(h.created_at)}</small></div>)}</div>
      {isAdmin && <div className="detail-section"><button className="wide" style={{ background: "#8f2525", color: "white", border: "1px solid #8f2525" }} onClick={deleteMachine} disabled={deleteBusy}><Trash2 size={16} /> {deleteBusy ? 'Tar bort…' : 'Ta bort maskin'}</button></div>}
    </section></div>}

    {showReservation && selected && <div className="overlay" onClick={() => setShowReservation(false)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowReservation(false)}><X /></button><p className="eyebrow">NY RESERVATION</p><h2>Reservera maskin</h2><p className="muted">{selected.brand} {selected.model} – {selected.machine_number}</p><form className="machine-form" onSubmit={createReservation}><label className="full">Antal att reservera<input type="number" min="1" max={Math.max(0, Number(selected.stock_quantity ?? 1) - activeReservations.reduce((n, r) => n + Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)), 0))} value={reservationQuantity} onChange={e => setReservationQuantity(e.target.value)} required /></label><label className="full">Kundens namn<input value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="Ange kundens namn" /></label><label className="full">Ansvarig säljare<select value={reservedBy} onChange={e => setReservedBy(e.target.value)} required><option value="">Välj säljare</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || 'Inloggad användare'}</option>)}</select></label><label className="full">Reservationsdatum<input type="date" value={reservationDate} onChange={e => setReservationDate(e.target.value)} /></label><button className="primary wide" disabled={saving}>{saving ? 'Sparar…' : 'Spara reservation'}</button>{error && <p className="error">{error}</p>}</form></section></div>}

    {showAdmin && isAdmin && <div className="overlay" onClick={() => setShowAdmin(false)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowAdmin(false)}><X /></button><p className="eyebrow">ADMINISTRATION</p><h2><Users size={22} /> Personaladministration</h2><p className="muted">Bjud in medarbetare. De får en länk via e-post för att skapa sitt eget lösenord.</p><form className="machine-form" onSubmit={inviteUser}><label className="full">Medarbetarens namn<input value={newUserName} onChange={e => setNewUserName(e.target.value)} required placeholder="För- och efternamn" /></label><label className="full">E-postadress<input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required placeholder="namn@moremaskiner.se" /></label><label className="full">Behörighet<select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}><option value="seller">Säljare</option><option value="admin">Administratör</option></select></label><button className="primary wide" disabled={adminBusy}><UserPlus size={16} /> {adminBusy ? 'Skickar inbjudan…' : 'Bjud in medarbetare'}</button>{error && <p className="error full">{error}</p>}</form><div className="detail-section"><h3><ShieldCheck size={18} /> Skapa lösenordslänk</h3><p className="muted">Skapa en länk åt en befintlig medarbetare utan att skicka e-post.</p><form className="machine-form" onSubmit={createRecoveryLink}><label className="full">Medarbetarens e-post<input type="email" value={recoveryEmail} onChange={e => { setRecoveryEmail(e.target.value); setRecoveryLink(''); }} required placeholder="namn@moremaskiner.se" /></label><button className="primary wide" disabled={adminBusy}>{adminBusy ? 'Skapar länk…' : 'Skapa lösenordslänk'}</button>{recoveryLink && <label className="full">Länk – kopiera och skicka säkert<textarea value={recoveryLink} readOnly onFocus={e => e.target.select()} rows={4} /></label>}{error && <p className="error full">{error}</p>}</form></div><div className="detail-section"><div className="admin-users-heading"><h3><ShieldCheck size={18} /> Personal i systemet</h3><button type="button" className="admin-refresh-button" onClick={loadAdminUsers} disabled={adminUsersLoading || adminBusy}><RefreshCw size={14} /> {adminUsersLoading ? 'Hämtar…' : 'Uppdatera lista'}</button></div><p className="muted">Ändringar påverkar användarens inloggning och behörighet. Historik och tidigare bokningar behålls.</p>{adminUsersLoading && adminUsers.length === 0 ? <p className="muted">Hämtar personal…</p> : adminUsers.length === 0 ? <p className="muted">Inga användare kunde hämtas. Prova att uppdatera listan.</p> : adminUsers.map(user => <div className="history-item admin-user-row" key={user.id}><div className="admin-user-main"><strong>{user.full_name || 'Namn saknas'}</strong><small>{user.email || 'E-post saknas'} · {user.auth_user_found === false ? 'Auth-konto saknas' : user.is_active ? 'Aktiv' : 'Avaktiverad'}</small></div><div className="admin-user-controls"><select aria-label={`Behörighet för ${user.full_name || user.email}`} value={user.role || 'seller'} disabled={adminBusy || user.id === session?.user?.id} onChange={e => updateAdminUser('change_role', user, e.target.value)}><option value="seller">Säljare</option><option value="admin">Administratör</option></select>{user.id !== session?.user?.id && <button type="button" className="admin-status-button" disabled={adminBusy} onClick={() => updateAdminUser(user.is_active ? 'deactivate' : 'reactivate', user)}>{user.is_active ? 'Avaktivera' : 'Återaktivera'}</button>}</div></div>)}</div></section></div>}

    {previewPhoto && <div className="photo-lightbox" role="dialog" aria-modal="true" onClick={() => setPreviewPhoto(null)}>
      <button type="button" className="photo-lightbox-close" onClick={() => setPreviewPhoto(null)} aria-label="Stäng bildvisning"><X size={26} /></button>
      <img src={previewPhoto.publicUrl} alt="Förstorad bild på maskinen" onClick={event => event.stopPropagation()} />
      <div className="photo-lightbox-caption">{previewPhoto.is_primary ? 'Huvudbild' : 'Maskinbild'}</div>
    </div>}
    {showAdd && <div className="overlay" onClick={() => setShowAdd(false)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowAdd(false)}><X /></button><p className="eyebrow">NY MASKIN</p><h2>Lägg till maskin</h2><form className="machine-form" onSubmit={addMachine}>{[['machine_number','Maskinnummer'],['brand','Fabrikat'],['model','Modell'],['year','Årsmodell'],['hours','Timmar'],['price','Pris (kr)'],['stock_quantity','Antal i lager'],['incoming_quantity','Antal på väg hem']].map(([field,label]) => <label key={field}>{label}<input value={form[field]} type={['year','hours','price','stock_quantity','incoming_quantity'].includes(field) ? 'number' : 'text'} min={['stock_quantity','incoming_quantity'].includes(field) ? '0' : undefined} onChange={e => setForm({ ...form, [field]: e.target.value })} /></label>)}<label className="full">Beskrivning<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><button className="primary wide">Spara maskin</button></form></section></div>}
    </>}
  </main>;
}
