import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Plus, LogOut, LogIn, RefreshCw, X, Package, Clock3, CheckCircle2, Tag, MessageSquare, History, CalendarDays, Send, Ban, Users, UserPlus, ShieldCheck, Trash2, Megaphone, AlertCircle, Bell, BellRing, Paperclip, FileText, Download, Mail, MessageCircle, ChevronDown } from 'lucide-react';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
const statusLabel = { in_stock: 'I lager', reserved: 'Såld', sold: 'Såld', incoming: 'På väg hem', mixed: 'I lager + på väg hem', mixed_reserved: 'I lager + såld' };
const availableStock = machine => Math.max(0, Number(machine.stock_quantity ?? 1) - Number(machine.external_reserved_quantity || 0));
const displayedSoldQuantity = machine => Math.max(0, Number(machine.sold_quantity || 0) + Number(machine.external_reserved_quantity || 0));
// Statusen beskriver fysiskt lager och inkommande leverans var för sig. Inkommande antal räknas aldrig som lager.
const displayMachineStatus = machine => {
  const stock = Math.max(0, Number(machine.stock_quantity ?? 1));
  const reserved = Math.max(0, Number(machine.external_reserved_quantity || 0));
  const available = Math.max(0, stock - reserved);
  const incoming = Math.max(0, Number(machine.incoming_quantity || 0));
  if (available > 0 && incoming > 0) return 'mixed';
  if (available > 0) return 'in_stock';
  if (reserved > 0 || Number(machine.sold_quantity || 0) > 0) return 'sold';
  if (incoming > 0) return 'incoming';
  if (Number(machine.sold_quantity || 0) > 0) return 'sold';
  return machine.status;
};
const emptyForm = { article_code: '', machine_number: '', brand: '', model: '', year: '', hours: '', price: '', stock_quantity: '0', description: '' };
const emptyDelivery = () => ({ quantity: '1', eta_year: String(new Date().getFullYear()), eta_week: String(Math.min(53, Math.ceil((((new Date() - new Date(new Date().getFullYear(),0,1)) / 86400000) + new Date(new Date().getFullYear(),0,1).getDay() + 1) / 7))), });
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

export default function App() {
  const [session, setSession] = useState(null);
  const [sellerPreviewMode, setSellerPreviewMode] = useState(false);
  const [machines, setMachines] = useState([]);
  const [reorderNeeds, setReorderNeeds] = useState([]);
  const [reorderSales, setReorderSales] = useState([]);
  const [reorderQuantityEdits, setReorderQuantityEdits] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [authActivity, setAuthActivity] = useState([]);
  const [authActivityLoading, setAuthActivityLoading] = useState(false);
  const [showAuthActivity, setShowAuthActivity] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState([]);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [machineSales, setMachineSales] = useState([]);
  const [showMachineHistory, setShowMachineHistory] = useState(false);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [machinePhotos, setMachinePhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [activeReservations, setActiveReservations] = useState([]);
  const [selectedReservationId, setSelectedReservationId] = useState(null);
  const [selectedDetailMode, setSelectedDetailMode] = useState('stock');
  const [reservationQuantity, setReservationQuantity] = useState('1');
  const [saleQuantity, setSaleQuantity] = useState('1');
  const [showDirectSaleForm, setShowDirectSaleForm] = useState(false);
  const [overstockConfirmation, setOverstockConfirmation] = useState(null);
  const [overstockConfirmed, setOverstockConfirmed] = useState(false);
  const [directSaleForm, setDirectSaleForm] = useState({ customer_name: '', customer_phone: '', customer_order_number: '', customer_company: '', customer_email: '', sale_date: new Date().toLocaleDateString('sv-SE'), note: '' });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('overview');
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showEditMachine, setShowEditMachine] = useState(false);
  const [showReservation, setShowReservation] = useState(false);
  const [editingReservation, setEditingReservation] = useState(null);
  const [reservationEditForm, setReservationEditForm] = useState({ customer_name: '', quantity: '1', reserved_by: '', reservation_date: '', reservation_end_date: '' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordFlow, setPasswordFlow] = useState(''); // setup | recovery | forgot
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [machineTemplateId, setMachineTemplateId] = useState('');
  const [stockEdit, setStockEdit] = useState('1');
  const [incomingEdit, setIncomingEdit] = useState('0');
  const [incomingDeliveries, setIncomingDeliveries] = useState([]);
  const [incomingDeliverySales, setIncomingDeliverySales] = useState([]);
  const [editingDeliveryEtaId, setEditingDeliveryEtaId] = useState(null);
  const [newDelivery, setNewDelivery] = useState(emptyDelivery());
  const [addDeliveries, setAddDeliveries] = useState([]);
  const [receiveDeliveryAmounts, setReceiveDeliveryAmounts] = useState({});
  const [receiveQuantity, setReceiveQuantity] = useState('1');
  const [customerName, setCustomerName] = useState('');
  const [reservedBy, setReservedBy] = useState('');
  const [reservationDate, setReservationDate] = useState('');
  const [reservationEndDate, setReservationEndDate] = useState('');
  const [commentText, setCommentText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('seller');
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLink, setRecoveryLink] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState([]);
  const [readPrivateMessageIds, setReadPrivateMessageIds] = useState([]);
  const [announcementComments, setAnnouncementComments] = useState({});
  const [announcementAttachments, setAnnouncementAttachments] = useState({});
  const [announcementFiles, setAnnouncementFiles] = useState([]);
  const [announcementText, setAnnouncementText] = useState({ title: '', body: '', category: 'Information', is_important: false });
  const [announcementCommentText, setAnnouncementCommentText] = useState({});
  const [announcementBusy, setAnnouncementBusy] = useState(false);
  const [showDeletedAnnouncements, setShowDeletedAnnouncements] = useState(false);
  const [announcementDeleteBusy, setAnnouncementDeleteBusy] = useState(false);
  const [homeNotices, setHomeNotices] = useState([]);
  const [showHomeNoticeForm, setShowHomeNoticeForm] = useState(false);
  const [editingHomeNotice, setEditingHomeNotice] = useState(null);
  const [homeNoticeForm, setHomeNoticeForm] = useState({ title: '', body: '', is_important: false, expires_at: '' });
  const [homeNoticeBusy, setHomeNoticeBusy] = useState(false);
  const [homeOverviewExpanded, setHomeOverviewExpanded] = useState(false);
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [showInternInfo, setShowInternInfo] = useState(false);
  const [internInfoMode, setInternInfoMode] = useState('news');
  const [privateConversations, setPrivateConversations] = useState([]);
  const [selectedPrivateConversation, setSelectedPrivateConversation] = useState(null);
  const [privateMessages, setPrivateMessages] = useState([]);
  const [privateRecipientIds, setPrivateRecipientIds] = useState([]);
  const [privateMessageText, setPrivateMessageText] = useState('');
  const [privateBusy, setPrivateBusy] = useState(false);
  const [showNewPrivateMessage, setShowNewPrivateMessage] = useState(false);
  const [showReservations, setShowReservations] = useState(false);
  const [reservations, setReservations] = useState([]);
  const [reservationSearch, setReservationSearch] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState('');
  const [appRefreshBusy, setAppRefreshBusy] = useState(false);
  const [appRefreshMessage, setAppRefreshMessage] = useState('');
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const currentProfile = profiles.find(p => p.id === session?.user?.id);
  const isSuperAdminAccount = session?.user?.email?.trim().toLowerCase() === 'mhnsti@gmail.com';
  const hasAdminRole = currentProfile?.role === 'admin';
  // Endast över-admin kan växla till säljarens gränssnitt. Behörigheten i databasen ändras inte.
  const isAdmin = hasAdminRole && !(isSuperAdminAccount && sellerPreviewMode);
  const unreadAnnouncementCount = announcements.filter(
    item => !item.deleted_at && !readAnnouncementIds.includes(item.id)
  ).length;
  const unreadPrivateCount = privateConversations.reduce((count, thread) => count + thread.messages.filter(message => message.sender_id !== session?.user?.id && !readPrivateMessageIds.includes(message.id)).length, 0);
  const unreadTotalCount = unreadAnnouncementCount + unreadPrivateCount;

  useEffect(() => {
    if (!session?.user?.id) {
      setReadAnnouncementIds([]);
      return;
    }
    try {
      const stored = localStorage.getItem(`more-read-announcements-${session.user.id}`);
      setReadAnnouncementIds(stored ? JSON.parse(stored) : []);
    } catch {
      setReadAnnouncementIds([]);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) { setReadPrivateMessageIds([]); setPrivateConversations([]); return; }
    try { setReadPrivateMessageIds(JSON.parse(localStorage.getItem(`more-read-private-${session.user.id}`) || '[]')); }
    catch { setReadPrivateMessageIds([]); }
  }, [session?.user?.id]);

  function markPrivateThreadAsRead(thread) {
    if (!session?.user?.id || !thread) return;
    const stored = (() => { try { return JSON.parse(localStorage.getItem(`more-read-private-${session.user.id}`) || '[]'); } catch { return []; } })();
    const ids = [...new Set([...stored, ...(thread.messages || []).filter(m => m.sender_id !== session.user.id).map(m => m.id)])];
    setReadPrivateMessageIds(ids);
    try { localStorage.setItem(`more-read-private-${session.user.id}`, JSON.stringify(ids)); } catch {}
  }

  function markAnnouncementsAsRead(posts) {
    if (!session?.user?.id) return;
    const ids = [...new Set([...(readAnnouncementIds || []), ...(posts || []).map(item => item.id)])];
    setReadAnnouncementIds(ids);
    try {
      localStorage.setItem(`more-read-announcements-${session.user.id}`, JSON.stringify(ids));
    } catch {
      // Lässtatusen fungerar under den här sessionen även om lokal lagring inte är tillgänglig.
    }
  }

  async function loadHomeNotices() {
    const { data, error } = await supabase.from('home_important_notices').select('*').or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('is_important', { ascending: false }).order('created_at', { ascending: false });
    if (error) { console.error('Kunde inte hämta viktig information:', error.message); return; }
    setHomeNotices(data || []);
  }

  function startHomeNoticeEdit(notice = null) {
    setEditingHomeNotice(notice);
    setHomeNoticeForm(notice ? { title: notice.title || '', body: notice.body || '', is_important: Boolean(notice.is_important), expires_at: notice.expires_at ? new Date(notice.expires_at).toISOString().slice(0,16) : '' } : { title: '', body: '', is_important: false, expires_at: '' });
    setShowHomeNoticeForm(true);
  }

  async function saveHomeNotice(event) {
    event.preventDefault();
    if (!homeNoticeForm.title.trim() || !homeNoticeForm.body.trim()) return;
    setHomeNoticeBusy(true);
    const payload = { title: homeNoticeForm.title.trim(), body: homeNoticeForm.body.trim(), is_important: homeNoticeForm.is_important, expires_at: homeNoticeForm.expires_at ? new Date(homeNoticeForm.expires_at).toISOString() : null, updated_at: new Date().toISOString() };
    let savedNotice = null;
    const saveResult = editingHomeNotice
      ? await supabase.from('home_important_notices').update(payload).eq('id', editingHomeNotice.id)
      : await supabase.from('home_important_notices').insert({ ...payload, created_by: session.user.id }).select('id, title, body, is_important').single();
    if (saveResult.error) setError('Kunde inte spara viktig information: ' + saveResult.error.message);
    else {
      savedNotice = saveResult.data;
      setShowHomeNoticeForm(false);
      setEditingHomeNotice(null);
      await loadHomeNotices();
      // Push skickas bara när ett nytt viktigt meddelande publiceras, inte vid redigering.
      if (!editingHomeNotice && savedNotice?.is_important) {
        setPushMessage('Viktigt meddelande publicerat. Skickar pushnotiser…');
        try {
          const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-home-notice-push', { body: { noticeId: savedNotice.id } });
          if (pushError || pushResult?.error) {
            const details = pushResult?.error || pushError?.message || 'Okänt fel från pushfunktionen.';
            console.error('[MÖRE push] Home notice push failed', pushError || pushResult);
            setPushMessage('Meddelandet publicerades, men pushutskicket misslyckades: ' + details);
          } else {
            setPushMessage(`Viktigt meddelande publicerat. ${pushResult?.sent || 0} pushnotis(er) skickades.`);
          }
        } catch (pushException) {
          console.error('[MÖRE push] Home notice push exception', pushException);
          setPushMessage('Meddelandet publicerades, men pushanropet kunde inte genomföras: ' + (pushException?.message || 'Okänt nätverksfel.'));
        }
      }
    }
    setHomeNoticeBusy(false);
  }

  async function deleteHomeNotice(notice) {
    if (!window.confirm(`Ta bort informationen ”${notice.title}”?`)) return;
    const { error } = await supabase.from('home_important_notices').delete().eq('id', notice.id);
    if (error) setError('Kunde inte ta bort informationen: ' + error.message);
    else await loadHomeNotices();
  }

  async function openInternInfo() {
    setShowInternInfo(true);
    setShowReservations(false);
    setShowAdmin(false);
    const posts = await loadAnnouncements();
    await loadPrivateConversations();
  }


  function needsPasswordSetup(user) {
    if (!user) return false;
    if (user.user_metadata?.must_set_password === false) return false;
    return user.user_metadata?.must_set_password === true || Boolean(user.invited_at);
  }

  useEffect(() => {
    let alive = true;
    let lastSignedInUserId = null;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      if (data.session?.user && needsPasswordSetup(data.session.user)) setPasswordFlow('setup');
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, value) => {
      setSession(value);
      if (event === 'SIGNED_IN' && value?.user?.id && lastSignedInUserId !== value.user.id) {
        lastSignedInUserId = value.user.id;
        Promise.resolve().then(() => recordAuthActivity('login', value.user.id));
      } else if (event === 'SIGNED_OUT') {
        lastSignedInUserId = null;
      }
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

  // Visar online-användare med två minuters respit vid korta avbrott/bakgrundsläge.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) {
      setOnlineUserIds([]);
      setShowOnlineUsers(false);
      return;
    }

    let active = true;
    const gracePeriodMs = 2 * 60 * 1000;
    const lastSeenByUser = new Map();
    const channel = supabase.channel('more-online-presence');
    const updateOnlineUsers = () => {
      if (!active) return;
      const now = Date.now();
      const state = channel.presenceState();
      const connectedIds = new Set(
        Object.values(state).flat().map(entry => entry?.user_id).filter(Boolean)
      );

      // Aktiva användare får en färsk tidsstämpel. Saknade användare ligger kvar
      // i listan i två minuter så iOS hinner pausa/återuppta anslutningen.
      connectedIds.forEach(id => lastSeenByUser.set(id, now));
      const visibleIds = [];
      for (const [id, lastSeen] of lastSeenByUser.entries()) {
        if (connectedIds.has(id) || now - lastSeen < gracePeriodMs) {
          visibleIds.push(id);
        } else {
          lastSeenByUser.delete(id);
        }
      }
      setOnlineUserIds(visibleIds);
    };

    channel
      .on('presence', { event: 'sync' }, updateOnlineUsers)
      .on('presence', { event: 'join' }, updateOnlineUsers)
      .on('presence', { event: 'leave' }, updateOnlineUsers)
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          const { error } = await channel.track({ user_id: userId, online_at: new Date().toISOString() });
          if (error) console.warn('Kunde inte registrera online-status:', error.message);
          updateOnlineUsers();
        }
      });

    // Pollning håller tidsstämplarna aktuella även när Presence inte skickar events.
    const refreshTimer = window.setInterval(updateOnlineUsers, 15000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') updateOnlineUsers();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

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
      const { data: reorderRows, error: reorderError } = await supabase.from('machine_reorder_needs').select('*').eq('status', 'open').gt('order_quantity', 0).order('created_at', { ascending: false });
      if (reorderError) { setError('Maskinerna kunde hämtas, men beställningsbehov kunde inte hämtas: ' + reorderError.message); setLoading(false); return; }
      setReorderNeeds(reorderRows || []);
      const linkedSaleIds = (reorderRows || []).map(row => row.sale_id).filter(Boolean);
      if (linkedSaleIds.length) {
        const { data: linkedSales, error: linkedSalesError } = await supabase.from('machine_sales').select('id, machine_id, customer_name, customer_company, customer_phone, customer_email, customer_order_number, sale_date, quantity, note, status').in('id', linkedSaleIds).order('created_at', { ascending: false });
        if (linkedSalesError) setError('Beställningsbehov kunde hämtas, men kunduppgifterna kunde inte hämtas: ' + linkedSalesError.message);
        setReorderSales(linkedSales || []);
      } else setReorderSales([]);
      const { data: deliveryRows, error: deliveryError } = await supabase.from('machine_incoming_deliveries').select('machine_id, quantity');
      if (deliveryError) { setError('Maskinerna kunde hämtas, men inkommande leveranser kunde inte hämtas: ' + deliveryError.message); setLoading(false); return; }
      const incomingByMachine = {};
      (deliveryRows || []).forEach(d => { incomingByMachine[d.machine_id] = (incomingByMachine[d.machine_id] || 0) + Number(d.quantity || 0); });
      const rowsWithIncoming = rows.map(m => ({ ...m, incoming_quantity: incomingByMachine[m.id] || 0 }));
      // MÖRE använder inte längre kundreservationer i lageröversikten.
      // external_reserved_quantity kommer från artikelregistret och visas som sålt/orderlagt.
      const rowsWithReservations = rowsWithIncoming.map(m => ({ ...m, reserved_quantity: 0, app_reserved_quantity: 0, available_quantity: availableStock(m), displayed_sold_quantity: displayedSoldQuantity(m) }));
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

  async function refreshAppData() {
    if (!session || appRefreshBusy) return;
    setAppRefreshBusy(true);
    setAppRefreshMessage('');
    setError('');
    try {
      await Promise.all([
        loadMachines(),
        loadProfiles(),
        loadAnnouncements(),
        loadPrivateConversations(),
        loadReservations(true),
        loadHomeNotices(),
      ]);
      setAppRefreshMessage('Allt innehåll är uppdaterat.');
      window.setTimeout(() => setAppRefreshMessage(''), 2600);
    } catch (refreshError) {
      setError('Appen kunde inte uppdateras helt: ' + (refreshError?.message || 'Okänt fel'));
    } finally {
      setAppRefreshBusy(false);
    }
  }

  async function loadReservations(silent = false) {
    if (!session) return;
    const { data, error } = await supabase.from('reservations')
      .select('*').eq('status', 'active').order('reservation_date', { ascending: false });
    if (error) {
      if (!silent) setError('Kunde inte hämta reservationer: ' + error.message);
      return;
    }
    setReservations(data || []);
  }


  async function loadPrivateConversations() {
    if (!session?.user?.id) return;
    setPrivateBusy(true);
    const { data: threads, error: threadError } = await supabase
      .from('private_conversations').select('*').order('updated_at', { ascending: false });
    if (threadError) {
      setError('Kunde inte hämta privata meddelanden: ' + threadError.message);
      setPrivateBusy(false);
      return;
    }
    const ids = (threads || []).map(thread => thread.id);
    if (!ids.length) {
      setPrivateConversations([]);
      setSelectedPrivateConversation(null);
      setPrivateMessages([]);
      setPrivateBusy(false);
      return;
    }
    const [{ data: participants, error: participantError }, { data: messages, error: messageError }] = await Promise.all([
      supabase.from('private_conversation_participants').select('conversation_id,user_id').in('conversation_id', ids),
      supabase.from('private_messages').select('*').in('conversation_id', ids).order('created_at', { ascending: true })
    ]);
    if (participantError || messageError) {
      setError('Kunde inte läsa konversationerna: ' + (participantError?.message || messageError?.message));
      setPrivateBusy(false);
      return;
    }
    const grouped = (threads || []).map(thread => ({
      ...thread,
      participants: (participants || []).filter(item => item.conversation_id === thread.id),
      messages: (messages || []).filter(item => item.conversation_id === thread.id)
    })).filter(thread => thread.participants.length > 0 && thread.messages.length > 0 && (isAdmin || thread.participants.some(item => item.user_id === session.user.id)));
    setPrivateConversations(grouped);
    if (selectedPrivateConversation) {
      const refreshed = grouped.find(item => item.id === selectedPrivateConversation.id) || null;
      setSelectedPrivateConversation(refreshed);
      setPrivateMessages(refreshed?.messages || []);
    }
    setPrivateBusy(false);
  }

  async function notifyPrivateMessage(conversationId, messageId) {
    const { error } = await supabase.functions.invoke('send-private-message-push', {
      body: { conversationId, messageId }
    });
    if (error) console.warn('Pushnotis för privat meddelande kunde inte skickas:', error.message);
  }

  async function startPrivateConversation(event) {
    event.preventDefault();
    const recipients = [...new Set(privateRecipientIds)].filter(id => id && id !== session?.user?.id);
    const body = privateMessageText.trim();
    if (!recipients.length || !body || privateBusy) return;
    setPrivateBusy(true);
    setError('');
    const { data: conversation, error: createError } = await supabase
      .from('private_conversations').insert({ created_by: session.user.id }).select().single();
    if (createError) {
      setError('Kunde inte starta konversationen: ' + createError.message);
      setPrivateBusy(false);
      return;
    }
    const participantRows = [session.user.id, ...recipients].map(user_id => ({ conversation_id: conversation.id, user_id }));
    const { error: participantError } = await supabase.from('private_conversation_participants').insert(participantRows);
    if (participantError) {
      setError('Kunde inte lägga till mottagarna: ' + participantError.message);
      setPrivateBusy(false);
      return;
    }
    const { data: message, error: messageError } = await supabase.from('private_messages')
      .insert({ conversation_id: conversation.id, sender_id: session.user.id, body }).select().single();
    if (messageError) {
      setError('Konversationen skapades men meddelandet kunde inte skickas: ' + messageError.message);
      setPrivateBusy(false);
      return;
    }
    setPrivateMessageText('');
    setPrivateRecipientIds([]);
    setShowNewPrivateMessage(false);
    setSelectedPrivateConversation({ ...conversation, participants: participantRows, messages: [message] });
    setPrivateMessages([message]);
    await notifyPrivateMessage(conversation.id, message.id);
    await loadPrivateConversations();
    setPrivateBusy(false);
  }

  async function sendPrivateReply(event) {
    event.preventDefault();
    const body = privateMessageText.trim();
    if (!selectedPrivateConversation?.id || !body || privateBusy) return;
    setPrivateBusy(true);
    setError('');
    const { data: message, error } = await supabase.from('private_messages')
      .insert({ conversation_id: selectedPrivateConversation.id, sender_id: session.user.id, body })
      .select().single();
    if (error) {
      setError('Meddelandet kunde inte skickas: ' + error.message);
      setPrivateBusy(false);
      return;
    }
    setPrivateMessageText('');
    setPrivateMessages(current => [...current, message]);
    await notifyPrivateMessage(selectedPrivateConversation.id, message.id);
    await loadPrivateConversations();
    setPrivateBusy(false);
  }

  async function deletePrivateMessage(message) {
    const canDelete = isAdmin || message.sender_id === session?.user?.id;
    if (!canDelete || !window.confirm(isAdmin && message.sender_id !== session?.user?.id ? 'Ta bort meddelandet för alla deltagare?' : 'Vill du ta bort ditt meddelande för alla deltagare?')) return;
    setPrivateBusy(true);
    setError('');
    const { error } = await supabase.from('private_messages').delete().eq('id', message.id);
    if (error) {
      setError('Meddelandet kunde inte tas bort: ' + error.message);
      setPrivateBusy(false);
      return;
    }
    setPrivateMessages(current => current.filter(item => item.id !== message.id));
    await loadPrivateConversations();
    setPrivateBusy(false);
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
      return visibleAnnouncements || [];
    } else {
      setAnnouncements([]);
      setAnnouncementComments({});
      setAnnouncementAttachments({});
      return [];
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

  async function loadAuthActivity() {
    setAuthActivityLoading(true);
    const { data, error } = await supabase.from('auth_activity_history').select('id, user_id, event_type, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(100);
    if (error) setError('Kunde inte hämta inloggningshistoriken: ' + error.message);
    else setAuthActivity(data || []);
    setAuthActivityLoading(false);
  }

  async function recordAuthActivity(eventType, userId) {
    if (!userId) return;
    const { error } = await supabase.from('auth_activity_history').insert({ user_id: userId, event_type: eventType });
    if (error) console.warn('Kunde inte spara inloggningshändelsen:', error.message);
  }

  async function loadDevelopmentLog() {
    if (!isAdmin) return;
    const { data, error } = await supabase.from('app_release_notes').select('*').order('release_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) setError('Kunde inte hämta versionshistoriken: ' + error.message);
    else setReleaseNotes(data || []);
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

  useEffect(() => { if (session) { loadMachines(); loadProfiles(); loadAnnouncements(); loadPrivateConversations(); loadReservations(true); loadHomeNotices(); } }, [session?.user?.id]);

  const groupedReorderNeeds = useMemo(() => {
    const groups = new Map();
    reorderNeeds.forEach(need => {
      if (!groups.has(need.machine_id)) groups.set(need.machine_id, { machine_id: need.machine_id, rows: [], order_quantity: 0, sold_quantity: 0, stock_used: 0, incoming_covered: 0, sales: [] });
      const group = groups.get(need.machine_id);
      group.rows.push(need);
      group.order_quantity += Number(need.order_quantity || 0) + Number(need.extra_order_quantity || 0);
      group.sold_quantity += Number(need.sold_quantity || 0);
      group.stock_used += Number(need.stock_used || 0);
      group.incoming_covered += Number(need.incoming_covered || 0);
      const sale = reorderSales.find(item => item.id === need.sale_id);
      if (sale) group.sales.push(sale);
    });
    return [...groups.values()];
  }, [reorderNeeds, reorderSales]);

  const filtered = useMemo(() => machines.filter(m => {
    const q = search.toLowerCase();
    const matches = [m.machine_number, m.article_code, m.brand, m.model].some(v => String(v || '').toLowerCase().includes(q));
    const hasOpenReorder = groupedReorderNeeds.some(n => n.machine_id === m.id);
    return matches && (filter === 'all' || filter === 'overview' || (filter === 'reorder' ? hasOpenReorder : filter === 'sold' ? displayedSoldQuantity(m) > 0 || m.status === 'sold' : filter === 'incoming' ? Number(m.incoming_quantity || 0) > 0 : filter === 'reserved' ? false : filter === 'in_stock' ? availableStock(m) > 0 : m.status === filter));
  }), [machines, groupedReorderNeeds, search, filter]);

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

  async function signOut() {
    const userId = session?.user?.id;
    if (userId) await recordAuthActivity('logout', userId);
    await supabase.auth.signOut();
    setMachines([]); setSelected(null); setPasswordFlow('');
  }

  function applyMachineTemplate(machineId) {
    setMachineTemplateId(machineId);
    if (!machineId) { setForm(emptyForm); setAddDeliveries([]); setNewDelivery(emptyDelivery()); setError(''); return; }
    const template = machines.find(machine => machine.id === machineId);
    if (!template) return;
    setForm(current => ({
      ...current,
      article_code: template.article_code || '',
      machine_number: '',
      brand: template.brand || '',
      model: template.model || '',
      year: template.year == null ? '' : String(template.year),
      hours: template.hours == null ? '' : String(template.hours),
      price: template.price == null ? '' : String(template.price),
      stock_quantity: '0',
      description: template.description || ''
    }));
    setAddDeliveries([]);
    setNewDelivery(emptyDelivery());
    setError('');
  }

  async function addMachine(event) {
    event.preventDefault(); setError('');
    const { data: { user } } = await supabase.auth.getUser();
    const incomingTotal = addDeliveries.reduce((sum, d) => sum + Number(d.quantity || 0), 0);
    const stockAmount = Math.max(0, Number.parseInt(form.stock_quantity, 10) || 0);
    let targetMachineId = null;
    if (machineTemplateId) {
      const template = machines.find(machine => machine.id === machineTemplateId);
      if (!template) { setError('Den valda artikelmodellen kunde inte hittas.'); return; }
      const { error: updateError } = await supabase.from('machines').update({
        price: form.price ? Number(form.price) : null,
        stock_quantity: Math.max(0, Number(template.stock_quantity || 0) + stockAmount),
        incoming_quantity: Math.max(0, Number(template.incoming_quantity || 0) + incomingTotal),
        status: 'in_stock'
      }).eq('id', template.id);
      if (updateError) { setError('Artikelmodellen kunde inte uppdateras: ' + updateError.message); return; }
      targetMachineId = template.id;
    } else {
      const payload = { ...form, article_code: form.article_code.trim() || null, machine_number: form.machine_number.trim() || null, brand: form.brand.trim(), model: form.model.trim(), year: form.year ? Number(form.year) : null, hours: form.hours ? Number(form.hours) : null, price: form.price ? Number(form.price) : null, stock_quantity: stockAmount, external_reserved_quantity: 0, incoming_quantity: incomingTotal, status: 'in_stock', created_by: user.id };
      const { data: created, error } = await supabase.from('machines').insert(payload).select('id').single();
      if (error) { setError(error.message); return; }
      targetMachineId = created.id;
    }
    if (addDeliveries.length) {
      const { error: deliveryError } = await supabase.from('machine_incoming_deliveries').insert(addDeliveries.map(d => ({ ...d, machine_id: targetMachineId, created_by: user.id })));
      if (deliveryError) { setError('Artikelmodellen sparades, men leveranserna kunde inte sparas: ' + deliveryError.message); return; }
    }
    setShowAdd(false); setForm(emptyForm); setMachineTemplateId(''); setAddDeliveries([]); await loadMachines();
  }

  function openEditMachine() {
    if (!selected) return;
    setForm({
      ...emptyForm,
      article_code: selected.article_code || '', machine_number: selected.machine_number || '', brand: selected.brand || '', model: selected.model || '',
      year: selected.year == null ? '' : String(selected.year), hours: selected.hours == null ? '' : String(selected.hours),
      price: selected.price == null ? '' : String(selected.price), description: selected.description || ''
    });
    setError('');
    setShowEditMachine(true);
  }

  async function updateMachine(event) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true); setError('');
    const payload = {
      article_code: form.article_code.trim() || null,
      machine_number: form.machine_number.trim() || null,
      brand: form.brand.trim(), model: form.model.trim(),
      year: form.year ? Number(form.year) : null,
      hours: form.hours ? Number(form.hours) : null,
      price: form.price ? Number(form.price) : null,
      description: form.description.trim() || null
    };
    const { error } = await supabase.from('machines').update(payload).eq('id', selected.id);
    if (error) setError('Kunde inte uppdatera maskinen: ' + error.message);
    else {
      const updated = { ...selected, ...payload };
      setSelected(updated);
      setShowEditMachine(false);
      await loadMachines();
      await loadMachineDetails(updated, selectedReservationId);
    }
    setSaving(false);
  }

  async function loadMachineDetails(machine, reservationId = null) {
    setSelectedReservationId(reservationId);
    // Spara vilken arbetsvy som öppnade detaljen. Förlita oss inte på filterstate
    // när detaljdialogen väl är öppen.
    setSelectedDetailMode(reservationId !== null ? 'reservation' : filter === 'sold' ? 'sold' : 'stock');
    const { data: freshMachine, error: freshMachineError } = await supabase.from('machines').select('*').eq('id', machine.id).single();
    if (freshMachineError) { setError(freshMachineError.message); return; }
    machine = { ...machine, ...freshMachine };
    setSelected(machine);
    setShowMachineHistory(false);
    setStockEdit(String(machine.stock_quantity ?? 1)); setIncomingEdit(String(machine.incoming_quantity ?? 0)); setReceiveQuantity('1'); setNewDelivery(emptyDelivery()); setError(''); setComments([]); setHistory([]); setMachineSales([]); setMachinePhotos([]); setActiveReservations([]);
    const [c, h, r, p, d, sales] = await Promise.all([
      supabase.from('comments').select('*').eq('machine_id', machine.id).order('created_at', { ascending: false }),
      supabase.from('machine_history').select('*').eq('machine_id', machine.id).order('created_at', { ascending: false }),
      supabase.from('reservations').select('*').eq('machine_id', machine.id).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('machine_photos').select('*').eq('machine_id', machine.id).order('created_at', { ascending: true }),
      supabase.from('machine_incoming_deliveries').select('*').eq('machine_id', machine.id).order('eta_year', { ascending: true, nullsFirst: false }).order('eta_week', { ascending: true, nullsFirst: false }),
      supabase.from('machine_sales').select('id, customer_name, customer_company, customer_phone, customer_email, customer_order_number, sale_date, quantity, note, status, reversed_at, created_at').eq('machine_id', machine.id).order('created_at', { ascending: false })
    ]);
    if (c.error) setError(c.error.message); else setComments(c.data || []);
    if (h.error) setError(h.error.message); else setHistory(h.data || []);
    if (sales.error) setError('Kunde inte hämta försäljningsuppgifter: ' + sales.error.message); else setMachineSales(sales.data || []);
    if (r.error) setError(r.error.message); else { const reservations = r.data || []; setActiveReservations(reservations); setSelected(current => current?.id === machine.id ? { ...current, reserved_quantity: 0, app_reserved_quantity: 0, available_quantity: availableStock(current), displayed_sold_quantity: displayedSoldQuantity(current) } : current); }
    if (p.error) setError('Kunde inte hämta maskinbilder: ' + p.error.message);
    else setMachinePhotos((p.data || []).map(photo => ({
      ...photo,
      publicUrl: supabase.storage.from('machine-photos').getPublicUrl(photo.storage_path).data.publicUrl
    })));
    if (d.error) setError('Kunde inte hämta leveranser: ' + d.error.message); else {
      const deliveryRows = d.data || [];
      setIncomingDeliveries(deliveryRows);
      setReceiveDeliveryAmounts(Object.fromEntries(deliveryRows.map(item => [item.id, String(item.quantity)])));
      const deliverySaleIds = [...new Set(deliveryRows.map(item => item.sale_id).filter(Boolean))];
      if (deliverySaleIds.length) {
        const { data: deliverySales, error: deliverySalesError } = await supabase.from('machine_sales').select('id, customer_name, customer_company, customer_phone, customer_email, customer_order_number, sale_date, quantity').in('id', deliverySaleIds);
        if (deliverySalesError) setError('Leveranserna hämtades, men kunduppgifterna kunde inte hämtas: ' + deliverySalesError.message);
        setIncomingDeliverySales(deliverySales || []);
      } else setIncomingDeliverySales([]);
    }
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
    event.preventDefault();
    if (!selected) return;
    if (selectedDetailMode === 'reservation') {
      setError('Nya reservationer skapas från vyn I lager, inte från Reserverade.');
      return;
    }
    const amount = Number.parseInt(reservationQuantity, 10);
    if (!Number.isInteger(amount) || amount < 1) { setError('Ange ett giltigt antal att reservera.'); return; }
    setSaving(true); setError('');
    const { data, error: reservationError } = await supabase.rpc('reserve_machine', {
      p_machine_id: selected.id, p_customer_name: customerName, p_reservation_date: reservationDate || null, p_quantity: amount, p_reserved_by: reservedBy || null
    });
    if (reservationError) setError(reservationError.message);
    else {
      if (reservationEndDate) {
        const { error: endDateError } = await supabase.from('reservations')
          .update({ reservation_end_date: reservationEndDate, reminder_sent_at: null })
          .eq('id', data);
        if (endDateError) {
          setError('Reservationen skapades, men slutdatumet kunde inte sparas: ' + endDateError.message);
          setSaving(false);
          return;
        }
      }
      setShowReservation(false); setCustomerName(''); setReservedBy(''); setReservationDate(''); setReservationEndDate(''); setReservationQuantity('1');
      await Promise.all([loadMachines(), loadReservations()]); await loadMachineDetails(selected);
    }
    setSaving(false);
  }

  function openEditReservation(reservation) {
    if (!reservation || reservation.status !== 'active') return;
    setEditingReservation(reservation);
    setReservationEditForm({
      customer_name: reservation.customer_name || '',
      quantity: String(reservation.quantity ?? 1),
      reserved_by: reservation.reserved_by || '',
      reservation_date: reservation.reservation_date || '',
      reservation_end_date: reservation.reservation_end_date || ''
    });
    setError('');
  }

  async function saveReservationEdit(event) {
    event.preventDefault();
    if (!selected || !editingReservation || saving) return;
    const quantity = Number.parseInt(reservationEditForm.quantity, 10);
    const fulfilled = Number(editingReservation.fulfilled_quantity || 0);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Ange ett giltigt totalt antal.');
      return;
    }
    if (quantity < fulfilled) {
      setError(`Antalet kan inte vara lägre än redan levererade ${fulfilled} st.`);
      return;
    }
    if (!reservationEditForm.customer_name.trim()) {
      setError('Kundnamn måste anges.');
      return;
    }
    if (!reservationEditForm.reserved_by) {
      setError('Välj ansvarig säljare.');
      return;
    }

    setSaving(true);
    setError('');
    const { error: updateError } = await supabase.rpc('update_machine_reservation', {
      p_reservation_id: editingReservation.id,
      p_customer_name: reservationEditForm.customer_name.trim(),
      p_reservation_date: reservationEditForm.reservation_date || null,
      p_quantity: quantity,
      p_reserved_by: reservationEditForm.reserved_by
    });
    if (updateError) {
      setError('Reservationen kunde inte uppdateras: ' + updateError.message);
    } else {
      const endDateChanged = (reservationEditForm.reservation_end_date || null) !== (editingReservation.reservation_end_date || null);
      const { error: endDateError } = await supabase.from('reservations')
        .update({
          reservation_end_date: reservationEditForm.reservation_end_date || null,
          reminder_sent_at: endDateChanged ? null : editingReservation.reminder_sent_at
        })
        .eq('id', editingReservation.id);
      if (endDateError) {
        setError('Reservationen uppdaterades, men slutdatumet kunde inte sparas: ' + endDateError.message);
      } else {
        setEditingReservation(null);
        await Promise.all([loadMachines(), loadReservations()]);
        await loadMachineDetails(selected, selectedReservationId);
      }
    }
    setSaving(false);
  }

  async function cancelReservation(reservationId) {
    if (!selected || !reservationId) return;
    const reservation = activeReservations.find(item => item.id === reservationId);
    const remaining = reservation ? Math.max(0, Number(reservation.quantity || 1) - Number(reservation.fulfilled_quantity || 0)) : 0;
    if (!window.confirm(`Vill du avboka de ${remaining} återstående exemplaren på den här reservationen? De blir då tillgängliga i lagret igen.`)) return;
    setError('');
    const { error } = await supabase.rpc('cancel_machine_reservation', { p_reservation_id: reservationId });
    if (error) { setError(error.message); return; }
    await Promise.all([loadMachines(), loadReservations()]); await loadMachineDetails(selected, selectedReservationId);
  }

  async function saveStockQuantity() {
    if (!selected) return;
    const nextStock = Number.parseInt(stockEdit, 10);
    if (!Number.isInteger(nextStock) || nextStock < 0) { setError('Ange ett giltigt antal, 0 eller högre.'); return; }
    const reservedNow = activeReservations.reduce((n, r) => n + Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)), 0);
    if (nextStock < reservedNow) { setError(`Lagersaldot kan inte sättas lägre än ${reservedNow} eftersom så många exemplar är reserverade.`); return; }
    const nextStatus = nextStock > 0 ? (selected.status === 'reserved' ? 'reserved' : 'in_stock') : (Number(selected.sold_quantity || 0) > 0 ? 'sold' : 'in_stock');
    const { error } = await supabase.from('machines').update({ stock_quantity: nextStock, status: nextStatus }).eq('id', selected.id);
    if (error) { setError('Lagersaldot kunde inte uppdateras: ' + error.message); return; }
    const updated = { ...selected, stock_quantity: nextStock, status: nextStatus };
    setSelected(updated);
    await Promise.all([loadMachines(), loadReservations()]);
  }

  async function refreshIncomingDeliveries() {
    if (!selected) return;
    const { data, error } = await supabase.from('machine_incoming_deliveries').select('*').eq('machine_id', selected.id).order('eta_year', { ascending: true, nullsFirst: false }).order('eta_week', { ascending: true, nullsFirst: false });
    if (error) { setError('Kunde inte uppdatera leveranserna: ' + error.message); return; }
    const rows = data || []; setIncomingDeliveries(rows); setReceiveDeliveryAmounts(Object.fromEntries(rows.map(d => [d.id, String(d.quantity)])));
    const saleIds = [...new Set(rows.map(item => item.sale_id).filter(Boolean))];
    if (saleIds.length) {
      const { data: salesRows, error: salesError } = await supabase.from('machine_sales').select('id, customer_name, customer_company, customer_phone, customer_email, customer_order_number, sale_date, quantity').in('id', saleIds);
      if (salesError) setError('Leveranserna hämtades, men kunduppgifterna kunde inte hämtas: ' + salesError.message);
      setIncomingDeliverySales(salesRows || []);
    } else setIncomingDeliverySales([]);
    const total = rows.reduce((sum, d) => sum + Number(d.quantity || 0), 0);
    await supabase.from('machines').update({ incoming_quantity: total }).eq('id', selected.id);
    setSelected(current => current?.id === selected.id ? { ...current, incoming_quantity: total } : current);
    await loadMachines();
  }

  async function addIncomingDelivery() {
    if (!selected) return;
    const quantity = Number.parseInt(newDelivery.quantity, 10), year = Number.parseInt(newDelivery.eta_year, 10), week = Number.parseInt(newDelivery.eta_week, 10);
    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(week) || week < 1 || week > 53) { setError('Ange antal samt ett giltigt ETA-år och en ETA-vecka (1–53).'); return; }
    const { error } = await supabase.from('machine_incoming_deliveries').insert({ machine_id: selected.id, quantity, eta_year: year, eta_week: week, created_by: session.user.id });
    if (error) { setError('Leveransen kunde inte läggas till: ' + error.message); return; }
    setNewDelivery(emptyDelivery()); setError(''); await refreshIncomingDeliveries();
  }

  async function saveIncomingDeliveryEta(delivery) {
    const year = Number.parseInt(delivery.eta_year, 10), week = Number.parseInt(delivery.eta_week, 10);
    if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(week) || week < 1 || week > 53) { setError('Ange ett giltigt ETA-år och en ETA-vecka (1–53).'); return; }
    const { error } = await supabase.from('machine_incoming_deliveries').update({ eta_year: year, eta_week: week }).eq('id', delivery.id);
    if (error) { setError('ETA kunde inte sparas: ' + error.message); return; }
    setIncomingDeliveries(rows => rows.map(item => item.id === delivery.id ? { ...item, eta_year: year, eta_week: week } : item)); setEditingDeliveryEtaId(null); setError('');
  }

  async function removeIncomingDelivery(delivery) {
    if (!window.confirm(`Ta bort leveransen på ${delivery.quantity} st?`)) return;
    const { error } = await supabase.from('machine_incoming_deliveries').delete().eq('id', delivery.id);
    if (error) { setError('Leveransen kunde inte tas bort: ' + error.message); return; }
    await refreshIncomingDeliveries();
  }

  async function receiveIncomingDelivery(delivery) {
    if (!selected) return;
    const amount = Number.parseInt(receiveDeliveryAmounts[delivery.id] || String(delivery.quantity), 10);
    if (!Number.isInteger(amount) || amount < 1 || amount > Number(delivery.quantity)) { setError(`Ange ett antal mellan 1 och ${delivery.quantity}.`); return; }
    const isCustomerDelivery = Boolean(delivery.sale_id);
    const remaining = Number(delivery.quantity) - amount;
    const deliveryResult = remaining > 0
      ? await supabase.from('machine_incoming_deliveries').update({ quantity: remaining }).eq('id', delivery.id)
      : await supabase.from('machine_incoming_deliveries').delete().eq('id', delivery.id);
    if (deliveryResult.error) { setError('Leveransen kunde inte registreras som mottagen: ' + deliveryResult.error.message); return; }

    // Customer-linked deliveries are already counted as sold when the sale is registered.
    // Receiving them fulfils the customer order; it must not add stock or count another sale.
    const currentStock = Math.max(0, Number(selected.stock_quantity ?? 0));
    const nextStock = isCustomerDelivery ? currentStock : currentStock + amount;
    if (!isCustomerDelivery) {
      const { error } = await supabase.from('machines').update({ stock_quantity: nextStock, status: 'in_stock' }).eq('id', selected.id);
      if (error) { setError('Leveransen markerades, men lagersaldot kunde inte uppdateras: ' + error.message); return; }
    }
    await supabase.from('machine_history').insert({
      machine_id: selected.id,
      user_id: session?.user?.id,
      action: isCustomerDelivery ? 'Kundleverans mottagen' : 'Lagerpåfyllning mottagen',
      new_data: { delivery_id: delivery.id, sale_id: delivery.sale_id || null, quantity: amount, remaining_quantity: remaining }
    });
    setSelected(current => current?.id === selected.id ? { ...current, stock_quantity: nextStock } : current);
    setStockEdit(String(nextStock)); setError(''); await refreshIncomingDeliveries(); await loadMachineDetails({ ...selected, stock_quantity: nextStock });
  }

  async function saveReorderNeedQuantity(group) {
    if (!group?.machine_id) return;
    const amount = Number.parseInt(reorderQuantityEdits[group.machine_id] ?? group.order_quantity, 10);
    if (!Number.isInteger(amount) || amount < 1) { setError('Ange minst 1 produkt att beställa.'); return; }
    setSaving(true); setError('');
    const { error } = await supabase.rpc('update_machine_reorder_group_quantity', { p_machine_id: group.machine_id, p_quantity: amount });
    if (error) setError('Beställningsantalet kunde inte sparas: ' + error.message);
    else { setReorderQuantityEdits(current => { const next = { ...current }; delete next[group.machine_id]; return next; }); await loadMachines(); }
    setSaving(false);
  }

  async function markReorderNeedOrdered(group) {
    if (!group?.machine_id) return;
    const amount = Number.parseInt(reorderQuantityEdits[group.machine_id] ?? group.order_quantity, 10);
    if (!Number.isInteger(amount) || amount < 1) { setError('Ange minst 1 produkt att beställa.'); return; }
    if (!window.confirm(`Markera ${amount} st som beställda och flytta dem till På väg hem? De räknas inte som inlevererade förrän mottagningen registreras.`)) return;
    setSaving(true); setError('');
    const quantityResult = amount !== Number(group.order_quantity) ? await supabase.rpc('update_machine_reorder_group_quantity', { p_machine_id: group.machine_id, p_quantity: amount }) : { error: null };
    if (quantityResult.error) setError('Beställningsantalet kunde inte sparas: ' + quantityResult.error.message);
    else {
      const { error: markError } = await supabase.rpc('mark_machine_reorder_group_ordered', { p_machine_id: group.machine_id });
      if (markError) setError('Beställningsbehovet kunde inte uppdateras: ' + markError.message);
      else { setReorderQuantityEdits(current => { const next = { ...current }; delete next[group.machine_id]; return next; }); await loadMachines(); }
    }
    setSaving(false);
  }

  function beginDirectSale() {
    if (!selected) return;
    const amount = Number.parseInt(saleQuantity, 10);
    if (!Number.isInteger(amount) || amount < 1) {
      setError('Ange ett giltigt antal att sälja.');
      return;
    }
    const physicalAvailable = availableStock(selected);
    const incomingAvailable = Math.max(0, Number(selected.incoming_quantity || 0));
    const shortage = Math.max(0, amount - physicalAvailable);
    const fromIncoming = Math.min(shortage, incomingAvailable);
    const toOrder = Math.max(0, shortage - fromIncoming);
    setError('');
    setOverstockConfirmed(false);
    if (shortage > 0) {
      setOverstockConfirmation({ amount, physicalAvailable, incomingAvailable, fromIncoming, toOrder });
      return;
    }
    setShowDirectSaleForm(true);
  }

  async function markSold(reservationId = null, confirmedOverstock = false) {
    if (!selected) return;
    if (isReservationContext && reservationId === null) {
      setError('I vyn Reserverade kan du bara sälja från eller avboka en kundreservation.');
      return;
    }
    if (reservationId !== null && selectedReservationId !== null && selectedReservationId !== reservationId) {
      setError('Öppna den aktuella kundreservationen innan du säljer från den.');
      return;
    }
    if (reservationId !== null && selectedReservationId === null && selectedDetailMode !== 'reservation') {
      setError('Öppna kundreservationen från Reserverade innan du säljer från den.');
      return;
    }
    const amount = Number.parseInt(saleQuantity, 10);
    if (!Number.isInteger(amount) || amount < 1) { setError('Ange ett giltigt antal att sälja.'); return; }
    if (reservationId === null) {
      const physicalAvailable = availableStock(selected);
      const incomingAvailable = Math.max(0, Number(selected.incoming_quantity || 0));
      const shortage = Math.max(0, amount - physicalAvailable);
      const fromIncoming = Math.min(shortage, incomingAvailable);
      const toOrder = Math.max(0, shortage - fromIncoming);
      if (shortage > 0 && !confirmedOverstock) {
        setError('');
        setOverstockConfirmation({ amount, physicalAvailable, incomingAvailable, fromIncoming, toOrder });
        return;
      }
    }
    setError(''); setSaving(true);
    let result;
    if (reservationId === null) {
      result = await supabase.rpc('record_machine_sale_with_restock_v2', {
        p_machine_id: selected.id, p_quantity: amount,
        p_customer_name: directSaleForm.customer_name.trim(),
        p_customer_phone: directSaleForm.customer_phone.trim(),
        p_customer_order_number: directSaleForm.customer_order_number.trim(),
        p_customer_company: directSaleForm.customer_company.trim() || null,
        p_customer_email: directSaleForm.customer_email.trim() || null,
        p_sale_date: directSaleForm.sale_date || null,
        p_note: directSaleForm.note.trim() || null,
        p_confirm_overstock: confirmedOverstock
      });
    } else {
      result = await supabase.rpc('sell_machine_quantity', {
        p_machine_id: selected.id, p_quantity: amount, p_reservation_id: reservationId
      });
    }
    if (result.error) setError(result.error.message);
    else {
      setSaleQuantity('1');
      if (reservationId === null) {
        setShowDirectSaleForm(false);
        setOverstockConfirmation(null);
        setOverstockConfirmed(false);
        setDirectSaleForm({ customer_name: '', customer_phone: '', customer_order_number: '', customer_company: '', customer_email: '', sale_date: new Date().toLocaleDateString('sv-SE'), note: '' });
      }
      await Promise.all([loadMachines(), loadReservations()]); await loadMachineDetails(selected, selectedReservationId);
    }
    setSaving(false);
  }

  async function restoreSoldMachine() {
    if (!selected) return;
    const currentStock = Math.max(0, Number(selected.stock_quantity ?? 0));
    const currentSold = Math.max(0, Number(selected.sold_quantity || 0));
    if (currentSold <= 0) { setError('Det finns inga sålda exemplar att återställa.'); return; }
    const nextSold = currentSold - 1;
    const restoredStock = currentStock + 1; const reservedNow = Number(selected.external_reserved_quantity || 0) + activeReservations.reduce((n, r) => n + Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)), 0); const restoredStatus = reservedNow > 0 ? 'reserved' : 'in_stock';
    const { error } = await supabase.from('machines').update({ stock_quantity: restoredStock, sold_quantity: nextSold, status: restoredStatus }).eq('id', selected.id);
    if (error) setError(error.message);
    else { await Promise.all([loadMachines(), loadReservations()]); await loadMachineDetails({ ...selected, stock_quantity: restoredStock, sold_quantity: nextSold, status: restoredStatus }, selectedReservationId); }
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

  // En maskin med aktiva kundreservationer ska alltid hanteras via reservationerna,
  // även när detaljvyn öppnas från maskinlistans filter Reserverade.
  const isReservationContext = selectedDetailMode === 'reservation' || selectedReservationId !== null;
  const isSoldContext = selectedDetailMode === 'sold';
  const detailReservations = selectedReservationId !== null
    ? activeReservations.filter(r => r.id === selectedReservationId)
    : activeReservations;
  const date = value => value ? new Date(value).toLocaleDateString('sv-SE') : '–';
  const dateTime = value => value ? new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const initials = name => (name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '?';
  const onlineProfiles = onlineUserIds.map(id => profiles.find(profile => profile.id === id)).filter(Boolean).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'sv'));

  if (session && passwordFlow) return <main className="login"><div className="brand">MÖRE<span /></div><section className="login-card"><p className="eyebrow">KONTOINSTÄLLNING</p><h1>{passwordFlow === 'recovery' ? 'Nytt lösenord' : 'Skapa ditt lösenord'}</h1><p className="muted">{passwordNotice || 'Välj ett personligt lösenord för ditt konto.'}</p><form onSubmit={saveNewPassword}><label>Nytt lösenord<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required /></label><label>Bekräfta lösenord<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required /></label><button className="primary wide" disabled={passwordBusy}>{passwordBusy ? 'Sparar…' : 'Spara lösenord'}</button></form>{error && <p className="error">{error}</p>}</section></main>;

  if (!session) return <main className="login"><div className="brand">MÖRE<span /></div><section className="login-card"><p className="eyebrow">INTERNT MASKINREGISTER</p><h1>{passwordFlow === 'forgot' ? 'Återställ lösenord' : 'Välkommen'}</h1><p className="muted">{passwordFlow === 'forgot' ? 'Ange din e-postadress så skickar vi en återställningslänk.' : 'Logga in med ditt personliga konto.'}</p>{passwordFlow === 'forgot' ? <form onSubmit={requestPasswordReset}><label>E-post<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><button className="primary wide" disabled={passwordBusy}>{passwordBusy ? 'Skickar…' : 'Skicka återställningslänk'}</button><button type="button" className="wide" style={{ background: "transparent", color: "#ddd", border: "1px solid #444", borderRadius: 7, padding: 11 }} onClick={() => { setPasswordFlow(''); setError(''); setPasswordNotice(''); }}>Tillbaka till inloggning</button></form> : <form onSubmit={signIn}><label>E-post<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Lösenord<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button className="primary wide">Logga in</button><button type="button" className="wide" style={{ background: "transparent", color: "#ddd", border: "1px solid #444", borderRadius: 7, padding: 11 }} onClick={() => { setPasswordFlow('forgot'); setError(''); setPasswordNotice(''); }}>Glömt lösenord?</button></form>}{passwordNotice && <p className="muted">{passwordNotice}</p>}{error && <p className="error">{error}</p>}</section></main>;

  return <main className="app-shell">
    <style>{`
      /* Säkerställ att appens innehåll alltid följer enhetens faktiska bredd. */
      .app-shell{width:100%;max-width:1200px;min-width:0;margin-left:auto;margin-right:auto;box-sizing:border-box;}
      .app-shell *{box-sizing:border-box;}
      /* Kundkortet i försäljningshistoriken ska vara tydligt avskilt från övrig maskininformation. */
      .reorder-customer-list{margin-top:14px;padding-top:12px;border-top:1px solid #414141}.reorder-customer-list>strong{display:block;margin-bottom:8px;color:#eee;font-size:14px;}
      .sale-customer-card{display:flex;flex-direction:column;gap:7px;margin:12px 0;padding:15px;border:1px solid #6b3033;border-left:5px solid #e02b32;border-radius:12px;background:#251b1c;color:#f5f5f5;}
      .sale-customer-card .sale-customer-label{font-size:11px;font-weight:800;letter-spacing:.12em;color:#ff6268;}
      .sale-customer-card>strong{font-size:19px;line-height:1.3;color:#fff;}
      .sale-customer-card>small{font-size:14px;color:#c2c2c2;}
      .sale-customer-card>span,.sale-customer-card>a,.sale-customer-card>p{font-size:16px;color:#f2f2f2;margin:0;overflow-wrap:anywhere;}
      .sale-customer-card>a{color:#f2f2f2!important;text-decoration:none!important;}
      .sale-customer-card>a:active{color:#fff!important;}
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
      .home-quick-overview{margin:14px 0 22px;padding:0;border-bottom:1px solid #303030}.home-quick-overview.compact-after{margin-bottom:4px}
      .home-quick-heading{margin:0 0 5px;color:#aaa;font-size:10px;font-weight:800;letter-spacing:.14em}
      .home-quick-toggle{width:100%;display:flex;align-items:center;justify-content:space-between;background:transparent;border:0;padding:7px 0;cursor:pointer;text-align:left}
      .home-quick-toggle svg{transition:transform .18s ease;color:#aaa}.home-quick-toggle svg.expanded{transform:rotate(180deg)}
      .home-quick-content{animation:homeQuickOpen .16s ease-out}@keyframes homeQuickOpen{from{opacity:.5;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}
      .home-quick-row{display:flex;align-items:center;gap:11px;width:100%;min-width:0;padding:11px 2px;background:transparent;border:0;border-top:1px solid #292929;border-radius:0;color:#f3f3f3;text-align:left;cursor:pointer}
      .home-quick-row:last-child{border-bottom:0}
      .home-quick-icon{display:flex;align-items:center;justify-content:center;flex:0 0 25px;color:#e43b45}
      .home-quick-copy{display:flex;flex:1;flex-direction:column;gap:3px;min-width:0}
      .home-quick-copy strong{font-size:13px;font-weight:700;line-height:1.25}
      .home-quick-copy small{overflow:hidden;color:#999;font-size:11px;line-height:1.3;text-overflow:ellipsis;white-space:nowrap}
      .home-quick-action{display:flex;align-items:center;gap:5px;flex:0 0 auto;color:#d94a50;font-size:11px;font-weight:700}
      .home-quick-row:focus-visible{outline:2px solid #d92730;outline-offset:2px;border-radius:5px}
      @media(min-width:700px){.home-quick-overview{max-width:680px}.home-quick-row{padding:12px 3px}}
      .home-notices{margin:0 0 24px;max-width:680px;padding:0 0 2px}.home-notices-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;padding:11px 13px;border:1px solid #7f252b;border-radius:10px;background:linear-gradient(110deg,#4a171b,#252020)}.home-notices-head h2{display:flex;align-items:center;gap:9px;margin:0;color:#fff;font-size:14px;font-weight:800;letter-spacing:.07em}.home-notices-head h2 svg{color:#ff6269}.home-notice-card{padding:14px 15px;margin:9px 0;border:1px solid #3d3d3d;border-left:5px solid #4d91c9;border-radius:10px;background:linear-gradient(110deg,#242424,#1d1d1d);box-shadow:0 3px 12px #0003}.home-notice-card.important{border-color:#713238;border-left-color:#ed343d;background:linear-gradient(110deg,#321d20,#211d1e)}.home-notice-card h3{margin:8px 0 5px;font-size:16px;font-weight:750;color:#fff}.home-notice-card p{margin:0;color:#e0e0e0;font-size:13px;line-height:1.5;white-space:pre-wrap}.home-notice-meta{display:flex;align-items:center;gap:8px;color:#aaa;font-size:10px;flex-wrap:wrap}.home-notice-meta strong{padding:4px 8px;border-radius:5px;background:#18344a;color:#8fcaff;font-size:10px;letter-spacing:.06em}.home-notice-card.important .home-notice-meta strong{background:#64242a;color:#ffb4b8}.home-notice-actions{display:flex;gap:8px;margin-top:9px}.home-notice-form{display:grid;gap:9px;padding:13px;margin:10px 0;border:1px solid #444;border-radius:10px;background:#1c1c1c}.home-notice-form input,.home-notice-form textarea{width:100%;box-sizing:border-box}.home-notice-form textarea{min-height:76px}.home-notice-form label{display:flex;align-items:center;gap:8px;font-size:12px;color:#ddd}
      .main-tabs{display:grid;gap:10px;padding:12px 0 18px;border-bottom:1px solid #303030}.main-tabs.seller-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.main-tabs.admin-tabs{grid-template-columns:repeat(3,minmax(0,1fr))}.main-tabs button{min-width:0;width:100%;padding:11px 8px}
      .push-notification-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 11px;font-size:12px;white-space:nowrap}
      .push-notification-button:disabled{opacity:.75;cursor:default}
      .seller-preview-button{min-height:36px;max-width:116px;padding:7px 10px;border:1px solid #53616d;border-radius:9px;background:#26313a;color:#e2eaf0;font-size:11px;font-weight:700;line-height:1.15;text-align:center;white-space:normal;box-shadow:inset 0 1px 0 #ffffff0a}
      .seller-preview-button:hover{background:#303d47;border-color:#71808c}
      @media(max-width:520px){.seller-preview-button{min-height:36px;max-width:112px;padding:7px 9px;font-size:10px}}
      @media(max-width:520px){.top-actions{gap:6px}.push-notification-button{padding:8px 9px;font-size:11px}}
      .online-presence-wrap{position:relative;display:flex;align-items:center;flex:0 0 auto}
      .online-presence-trigger{display:inline-flex;align-items:center;gap:5px;padding:5px 3px;border:0;background:transparent;color:#929292;font-size:11px;white-space:nowrap;cursor:pointer}
      .online-presence-dot{width:6px;height:6px;flex:0 0 6px;border-radius:50%;background:#43ad70;box-shadow:0 0 5px #43ad7040}
      .online-presence-popover{position:absolute;z-index:1000;top:calc(100% + 10px);left:0!important;right:auto!important;width:220px!important;max-width:min(220px,calc(100vw - 32px))!important;min-width:0;box-sizing:border-box;padding:10px 12px;border:1px solid #383838;border-radius:9px;background:#1c1c1c;box-shadow:0 8px 24px #0008;overflow-wrap:anywhere}.online-presence-person{min-width:0}.online-presence-person>span:last-child{min-width:0;overflow-wrap:anywhere}
      .online-presence-popover strong{display:block;margin:0 0 7px;color:#ddd;font-size:11px;font-weight:700}
      .online-presence-person{display:flex;align-items:center;gap:8px;padding:6px 0;color:#c9c9c9;font-size:12px}
      .online-presence-initials{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:#303943;color:#e4e9ed;font-size:9px;font-weight:800}
      .tab-unread-badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;margin-left:2px;border-radius:10px;background:#b92f35;color:#fff;font-size:11px;font-weight:800;line-height:1}
      .main-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:11px 18px;border-radius:9px;border:1px solid #3b3b3b;background:#202020;color:#c9c9c9;font-weight:650;cursor:pointer;transition:background .15s,border-color .15s}
      .main-tabs button.active{background:#3a1719;border-color:#d92730;color:#fff}

      .interninfo-switch{display:flex;gap:8px;margin:0 0 18px;flex-wrap:wrap}
      .interninfo-switch button{display:inline-flex;align-items:center;gap:8px;background:#202020;border:1px solid #383838;color:#bbb;border-radius:8px;padding:11px 14px}
      .interninfo-switch button.active{background:#3a1719;border-color:#d92730;color:#fff}
      .private-message-layout{display:flex;flex-direction:column;gap:16px;min-height:420px}
      .private-conversation-list,.private-conversation-view,.private-compose-panel{background:#191919;border:1px solid #353535;border-radius:12px;padding:16px;min-width:0}
      .private-conversation-view.is-empty{min-height:0;padding:12px 16px}
      .private-conversation-view.is-empty .empty{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;column-gap:10px;row-gap:2px;min-height:0;padding:0;text-align:left}
      .private-conversation-view.is-empty .empty>svg{grid-row:1 / span 2;width:24px;height:24px}
      .private-conversation-view.is-empty .empty h3{margin:0;font-size:15px;line-height:1.3}
      .private-conversation-view.is-empty .empty p{grid-column:2;margin:0;font-size:12px;line-height:1.4}
      .private-list-heading,.private-view-heading{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .private-compose-panel h2{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:19px}
      .private-compose-actions{display:flex;gap:10px;flex-wrap:wrap}
      .private-list-heading h2,.private-view-heading h2{font-size:19px;margin:4px 0 12px}
      .private-thread{display:grid;gap:5px;width:100%;text-align:left;background:#202020;border:1px solid #393939;border-radius:8px;padding:12px;margin-top:8px;color:#eee}
      .private-thread.active{border-color:#d92730;background:#2a1718}
      .private-thread small{color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .private-thread time{font-size:11px;color:#888}
      .private-compose-form{display:grid;gap:13px;margin-top:16px}
      .private-compose-form label{display:grid;gap:7px;color:#bbb;font-size:13px}
      .private-recipient-picker{position:relative}
      .private-recipient-picker summary{list-style:none;cursor:pointer;min-height:48px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:#111;color:#fff;border:1px solid #444;border-radius:7px;padding:11px}
      .private-recipient-picker summary::-webkit-details-marker{display:none}
      .private-recipient-picker[open] summary{border-color:#df202b;border-radius:7px 7px 0 0}
      .private-recipient-options{display:grid;gap:0;background:#171717;border:1px solid #444;border-top:0;border-radius:0 0 7px 7px;max-height:220px;overflow:auto}
      .private-recipient-options label{display:flex!important;align-items:center;gap:10px;padding:11px 12px;border-bottom:1px solid #303030;color:#fff!important;font-size:14px!important}
      .private-recipient-options label:last-child{border-bottom:0}
      .private-recipient-options input{width:18px;height:18px;accent-color:#df202b}
      .private-compose-form textarea{width:100%;background:#111;color:#fff;border:1px solid #444;border-radius:7px;padding:11px}
      .private-message-list{display:flex;flex-direction:column;gap:10px;max-height:520px;overflow:auto;padding:12px 2px}
      .private-bubble{justify-self:start;max-width:88%;background:#252525;border:1px solid #3a3a3a;border-radius:10px;padding:10px 12px}
      .private-bubble.mine{justify-self:end;background:#351a1c;border-color:#713034}
      .private-bubble p{white-space:pre-wrap;margin:0 0 7px;line-height:1.5}
      .private-bubble small{color:#aaa;font-size:11px}
      .private-message-delete{display:inline-flex;align-items:center;justify-content:center;margin:7px 0 0 8px;padding:4px 6px;border:1px solid #555;border-radius:5px;background:transparent;color:#bbb;cursor:pointer}
      .private-message-delete:hover{border-color:#df202b;color:#fff}
      .private-message-delete:disabled{opacity:.45;cursor:wait}
      .private-reply-form{margin-top:12px}
      @media(max-width:700px){.private-message-layout{display:flex;flex-direction:column}.private-conversation-list{max-height:360px;overflow:auto}.private-compose-actions>*{flex:1}}

      .announcement-list{display:grid;gap:16px;margin-top:22px}
      .admin-user-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:13px 0;border-bottom:1px solid #333}
      .admin-user-main{display:flex;flex-direction:column;gap:4px;min-width:150px}
      .admin-user-main small{color:#999;overflow-wrap:anywhere}
      .admin-user-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .admin-user-controls select,.admin-status-button{background:#242424;color:#eee;border:1px solid #555;border-radius:7px;padding:8px 10px;font:inherit;font-size:13px}
      .admin-status-button{border-color:#8b3434;color:#ff9a9a}
      .admin-user-controls button:disabled,.admin-user-controls select:disabled{opacity:.55}
      .admin-users-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .refresh-spinning{animation:more-refresh-spin .8s linear infinite}@keyframes more-refresh-spin{to{transform:rotate(360deg)}}
      .admin-refresh-button{display:inline-flex;align-items:center;gap:7px;background:#242424;color:#eee;border:1px solid #555;border-radius:7px;padding:8px 10px;font:inherit;font-size:13px}
      .admin-refresh-button:disabled{opacity:.55;cursor:wait}
      .auth-activity-section{margin-top:18px;padding-top:16px;border-top:1px solid #333}
      .auth-activity-list{margin-top:12px}
      .auth-activity-row{display:grid;grid-template-columns:32px minmax(0,1fr);align-items:center;column-gap:12px;min-height:58px;padding:11px 0;border-bottom:1px solid #333}
      .auth-activity-row>div{display:flex;flex-direction:column;gap:3px;min-width:0}
      .auth-activity-row small{color:#999;line-height:1.4}
      .auth-activity-icon{box-sizing:border-box!important;display:grid!important;place-items:center!important;width:32px!important;height:32px!important;min-width:32px!important;min-height:32px!important;max-width:32px!important;max-height:32px!important;aspect-ratio:1/1;align-self:center;justify-self:center;overflow:hidden;border-radius:50%;flex:none}
      .auth-activity-icon svg{display:block;width:16px;height:16px}
      .auth-activity-icon.login{color:#75d69a;background:#183323}
      .auth-activity-icon.logout{color:#aaa;background:#292929}
      .machine-photo img{width:100%;height:100%;object-fit:cover;border-radius:10px}
      .status.in_stock{background:#183323;color:#75d69a;border:1px solid #2e6b45}
      .status.incoming{background:#172b3d;color:#8bc5f5;border:1px solid #315d83}
      .status.reserved{background:#493817;color:#f2c66d;border:1px solid #765b25}
      .status.sold{background:#292929;color:#d0d0d0;border:1px solid #555}
      .status.out_of_stock{background:#3a1c1e;color:#ff858a;border:1px solid #8c3036}
      .status.partial_sold{background:#493817;color:#f2c66d;border:1px solid #765b25}
      .status.mixed{background:#3b2c18;color:#ffd27a;border:1px solid #8a6428}
      .status.mixed_reserved{background:#3b2c18;color:#ffd27a;border:1px solid #8a6428}
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
      .stock-actions{
        display:grid;
        grid-template-columns:minmax(0,1fr);
        gap:12px;
        margin:18px 0 22px;
        padding:16px;
        background:#151515;
        border:1px solid #383838;
        border-radius:12px;
        min-width:0;
      }
      .stock-actions h4{margin:0;font-size:17px;line-height:1.35}
      .stock-actions>p{margin:0;line-height:1.45}
      .stock-actions>label.full{
        display:grid;
        grid-template-columns:minmax(0,1fr);
        gap:8px;
        margin:2px 0 0;
        min-width:0;
      }
      .stock-actions input{
        display:block;
        width:100%;
        min-width:0;
        height:48px;
        box-sizing:border-box;
        padding:9px 12px;
        border:1px solid #555;
        border-radius:9px;
        background:#fff;
        color:#171717;
        font:inherit;
        font-size:18px;
      }
      .stock-actions>button{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        width:100%;
        min-height:48px;
        margin:0;
        padding:11px 14px;
        border-radius:9px;
        white-space:normal;
      }
      .inventory-summary{min-width:0}
      .inventory-summary>p{line-height:1.45}
      .inventory-summary>label.full{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin:16px 0 8px}
      .inventory-summary>label.full input,.reservation-row label input{width:100%;min-width:0;box-sizing:border-box}
      .inventory-summary>button{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;margin-top:10px;white-space:normal}
      .reservation-row{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;min-width:0;padding:14px 0;border-bottom:1px solid #383838}
      .reservation-row>strong{font-size:17px;overflow-wrap:anywhere}
      .reservation-row>small{display:block;color:#aaa;line-height:1.5;overflow-wrap:anywhere}
      .reservation-row>label.full{display:grid;grid-template-columns:minmax(0,1fr);gap:7px;margin:2px 0}
      .reservation-row>button{width:100%;min-height:44px;display:flex;align-items:center;justify-content:center;gap:7px;white-space:normal}
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
      .main-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;border-bottom:1px solid #333;padding:12px 0 18px}
      .main-tabs button{min-width:0;white-space:nowrap}.main-tabs button svg{flex:0 0 auto}

      .structured-form{display:grid;gap:20px}.form-section{display:grid;gap:11px;padding-bottom:17px;border-bottom:1px solid #383838}.form-section h3{margin:0;font-size:16px}.form-section>p{margin:-5px 0 0;font-size:13px}.form-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.form-fields label{min-width:0}.form-fields .full{grid-column:1/-1}
      @media(max-width:520px){.form-fields{grid-template-columns:minmax(0,1fr)}.form-fields .full{grid-column:1}}
      .page-hero{align-items:flex-end}
      .secondary-action{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:10px 14px;border:1px solid #555;border-radius:9px;background:#242424;color:#eee;font-weight:650}
      .page-toolbar{display:grid;gap:14px;margin:18px 0}
      .page-summary{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;color:#aaa;font-size:13px}.page-summary strong{color:#fff;font-size:18px}
      .reservation-list{display:grid;gap:13px;margin:18px 0}
      .reservation-card,.page-panel{min-width:0;padding:20px;background:#191919;border:1px solid #363636;border-radius:13px}
      .reservation-card-main{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .reservation-card h2{margin:5px 0;font-size:23px;line-height:1.25}.reservation-card-heading{min-width:0}.reservation-machine-number{margin:4px 0 12px;font-size:13px}.reservation-customer{display:grid;gap:2px;margin-top:11px}.reservation-customer span{font-size:10px;font-weight:800;letter-spacing:.1em;color:#d8a69d}.reservation-customer strong{font-size:19px;line-height:1.3;color:#fff;overflow-wrap:anywhere}
      .reservation-quantity{display:grid;gap:2px;text-align:right;white-space:nowrap}.reservation-quantity strong{font-size:25px;color:#fff}.reservation-quantity span{font-size:12px;color:#aaa}
      .reservation-meta{display:flex;flex-wrap:wrap;align-items:center;gap:9px 17px;padding:14px 0;color:#aaa;font-size:13px}.reservation-meta>span{display:inline-flex;align-items:center;gap:6px}.reservation-seller{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:7px 11px;border:1px solid #51413b;border-left:3px solid #d64a3b;border-radius:7px;background:#211b19;min-width:145px}.reservation-seller-label{font-size:11px;line-height:1.2;font-weight:800;letter-spacing:.08em;color:#d8a69d}.reservation-seller strong{font-size:15px;line-height:1.3;color:#fff;overflow-wrap:anywhere}.detail-reservation-sellers{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin:14px 0 18px}.detail-reservation-seller{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px 12px;width:fit-content;margin:0;padding:0}.detail-reservation-seller .reservation-seller-label{font-size:14px;line-height:1.35;font-weight:800;letter-spacing:.045em;color:#fff}.detail-reservation-seller strong{font-size:20px;line-height:1.4;color:#fff;font-weight:800;overflow-wrap:anywhere}
      .reservation-deadline{display:inline-flex;align-items:center;gap:9px;padding:8px 11px;border:1px solid #8f3030;border-left:4px solid #e14a4a;border-radius:7px;background:#2a1717;color:#fff}.reservation-deadline>span{display:flex;flex-direction:column;gap:2px}.reservation-deadline strong{font-size:10px;letter-spacing:.08em;color:#ff9a9a}.reservation-deadline b{font-size:16px;line-height:1.25;color:#fff}.detail-deadline{margin:6px 0 2px;width:fit-content}.reservation-card .secondary-action{width:100%}
      .machine-quantity-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:13px 0 5px;padding:11px 0;border-top:1px solid #333;border-bottom:1px solid #333}
      .machine-quantity-summary span{display:grid;gap:2px;min-width:0}.machine-quantity-summary strong{font-size:19px;color:#f4f4f4}.machine-quantity-summary small{font-size:11px;color:#aaa}
      .incoming-note{margin:7px 0 0;color:#aaa;font-size:12px}
      .admin-page{margin:22px 0}.admin-page h1{display:flex;align-items:center;gap:10px;margin:4px 0 8px}
      .admin-page .detail-section{margin-top:22px;padding-top:20px;border-top:1px solid #383838}.admin-page .machine-form{max-width:760px}.admin-page .history-item{padding:13px 0}
      .admin-page .deleted-machines-summary{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
      .admin-page .deleted-machines-summary small{margin-left:auto;padding:3px 9px;border:1px solid #484848;border-radius:999px;color:#bbb;font-size:12px;line-height:1.4;white-space:nowrap}
      .admin-page .release-note-heading{display:flex;flex-direction:column;align-items:flex-start;gap:5px;margin-bottom:10px}
      .admin-page .release-note-heading strong{display:block;line-height:1.35;overflow-wrap:anywhere}
      .admin-page .release-note-heading small{display:block;color:#999;font-size:13px;line-height:1.4}
      .app-shell .hero,.app-shell .toolbar,.app-shell .stats,.app-shell .machine-grid,.app-shell .announcement-list,.app-shell .reservation-list{width:100%;min-width:0}
      .app-shell .dialog{max-height:calc(100dvh - 28px);overflow-y:auto;overscroll-behavior:contain}
      .app-shell input,.app-shell select,.app-shell textarea{max-width:100%;min-width:0}.app-shell button{touch-action:manipulation}
      @media(max-width:700px){.main-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.main-tabs button{width:100%;padding:11px 8px;font-size:13px}.reservation-card,.page-panel{padding:16px}}
      @media(max-width:520px){
        .app-shell{padding-left:14px;padding-right:14px}.app-shell .hero{align-items:stretch;gap:16px}.app-shell .hero>button{width:100%}
        .app-shell .toolbar{display:block}.app-shell .stats{gap:10px}.app-shell .machine-grid{grid-template-columns:minmax(0,1fr);gap:14px}
        .app-shell .machine-card{overflow:hidden}.app-shell .machine-info{padding:15px}
        .machine-quantity-summary{gap:5px}.machine-quantity-summary strong{font-size:17px}.machine-quantity-summary small{font-size:10px}
        .app-shell .dialog{width:100%;max-width:100%;max-height:calc(100dvh - 16px);margin:8px;padding:18px 15px;border-radius:14px}
        .app-shell .overlay{align-items:center;justify-content:center;padding:12px}.app-shell .machine-form{grid-template-columns:minmax(0,1fr)}.app-shell .machine-form .full{grid-column:1}
        .app-shell .detail-section{min-width:0}.app-shell .dialog-actions{gap:8px}.app-shell .dialog-actions>*{min-width:0;flex:1}
        .inventory-controls .quantity-control{grid-template-columns:minmax(0,1fr) 96px;padding:12px}.inventory-controls .receive-panel label{grid-template-columns:minmax(0,1fr) 96px}
        .reservation-card-main{gap:8px}.reservation-card h2{font-size:18px}.reservation-quantity strong{font-size:22px}
        .inventory-summary{padding:14px!important}
        .inventory-summary>h3{line-height:1.25;overflow-wrap:anywhere}
        .inventory-summary>p{font-size:15px}
        .reservation-row{gap:9px;padding:13px 0}
        .reservation-row>button{font-size:14px;padding:10px}
        .reservation-meta{display:grid;grid-template-columns:minmax(0,1fr);gap:8px}.reservation-seller{width:100%;box-sizing:border-box}.page-hero{align-items:stretch}
        .admin-page .admin-user-row{align-items:stretch}.admin-user-controls{width:100%;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
        .admin-user-controls select,.admin-user-controls button{width:100%;min-width:0}
      }
      @media(min-width:701px){.page-toolbar{grid-template-columns:minmax(0,1fr) auto;align-items:center}.page-summary{justify-content:flex-end}.reservation-card .secondary-action{width:auto}}
      @media(max-width:390px){.main-tabs{gap:6px}.main-tabs button{font-size:12px;gap:5px}.inventory-controls .quantity-control{grid-template-columns:minmax(0,1fr) 82px}.inventory-controls .receive-panel label{grid-template-columns:minmax(0,1fr) 82px}}

    `}</style>
    <header className="topbar"><div className="brand">MÖRE<span /></div><div className="top-actions"><span className="staff">PERSONAL</span><div className="online-presence-wrap"><button type="button" className="online-presence-trigger" onClick={() => setShowOnlineUsers(value => !value)} aria-expanded={showOnlineUsers} aria-label={`${onlineUserIds.length} online – visa inloggade`} title="Visa vilka som är online"><span className="online-presence-dot" />{onlineUserIds.length} online</button>{showOnlineUsers && <div className="online-presence-popover"><strong>{onlineUserIds.length} online</strong>{onlineProfiles.length ? onlineProfiles.map(profile => <div className="online-presence-person" key={profile.id}><span className="online-presence-initials">{initials(profile.full_name)}</span><span>{profile.full_name || 'Medarbetare'}</span></div>) : <div className="online-presence-person">Hämtar namn…</div>}</div>}</div>{isSuperAdminAccount && hasAdminRole && <button type="button" className="secondary-action seller-preview-button" onClick={() => { setSellerPreviewMode(value => !value); setShowAdmin(false); setShowInternInfo(false); setShowReservations(false); setError(''); }} title={sellerPreviewMode ? 'Återgå till administratörsvyn' : 'Visa appen som en säljare'}>{sellerPreviewMode ? 'Återgå till admin' : 'Visa som säljare'}</button>}<button className="primary push-notification-button" onClick={enablePushNotifications} disabled={pushBusy || pushEnabled} title={pushEnabled ? 'Pushnotiser är aktiverade på den här enheten' : 'Aktivera pushnotiser på den här enheten'}>{pushEnabled ? <BellRing size={16} /> : <Bell size={16} />}{pushBusy ? 'Aktiverar…' : pushEnabled ? 'Notiser aktiverade' : 'Aktivera notiser'}</button><button className="icon-btn" onClick={refreshAppData} disabled={appRefreshBusy} aria-label="Uppdatera hela appen" title={appRefreshBusy ? "Uppdaterar innehållet…" : "Uppdatera hela appen"}><RefreshCw size={18} className={appRefreshBusy ? "refresh-spinning" : ""} /></button><button className="icon-btn" onClick={signOut} aria-label="Logga ut"><LogOut size={18} /></button></div></header>
    <nav className={`main-tabs ${isAdmin ? 'admin-tabs' : 'seller-tabs'}`}><button className={!showInternInfo && !showReservations && !showAdmin ? 'active' : ''} onClick={() => { setShowInternInfo(false); setShowReservations(false); setShowAdmin(false); setFilter('overview'); }}><Package size={16} /> Maskiner</button><button className={showInternInfo ? 'active' : ''} onClick={openInternInfo}><Megaphone size={16} /> Interninfo{unreadTotalCount > 0 && <span className="tab-unread-badge">{unreadTotalCount > 99 ? '99+' : unreadTotalCount}</span>}</button>{isAdmin && <button className={showAdmin ? 'active' : ''} onClick={() => { setShowAdmin(true); setShowInternInfo(false); setShowReservations(false); setError(''); loadAdminUsers(); loadDevelopmentLog(); }}><Users size={16} /> Administration</button>}</nav>
    {pushMessage && <p className="muted" role="status" style={{ margin: '10px 0', fontSize: 13 }}>{pushMessage}</p>}
    {appRefreshMessage && <p className="muted" role="status" style={{ margin: '8px 0', fontSize: 12, color: '#9bd5a5' }}>{appRefreshMessage}</p>}
    {!showReservations && !showInternInfo && !showAdmin && <>
    <section className={`home-quick-overview ${homeNotices.length === 0 && !isAdmin ? 'compact-after' : ''}`} aria-label="Min översikt">
      <button type="button" className="home-quick-heading home-quick-toggle" aria-expanded={homeOverviewExpanded} onClick={() => setHomeOverviewExpanded(v => !v)}><span>MIN ÖVERSIKT</span><ChevronDown size={16} className={homeOverviewExpanded ? 'expanded' : ''} /></button>
      {homeOverviewExpanded && <div className="home-quick-content">
            {announcements.length > 0 && <button type="button" className="home-quick-row" onClick={openInternInfo}>
        <span className="home-quick-icon"><Megaphone size={18} /></span>
        <span className="home-quick-copy">
          <strong>Senaste Interninfo {unreadTotalCount > 0 ? `· ${unreadTotalCount} olästa` : ''}</strong>
          <small>{announcements[0].title || 'Nytt inlägg publicerat'}</small>
        </span>
        <span className="home-quick-action">Läs <span aria-hidden="true">›</span></span>
      </button>}
      </div>}
    </section>
    {homeNotices.length > 0 || isAdmin ? <section className="home-notices" aria-label="Viktig information">
      <div className="home-notices-head"><h2><Megaphone size={19}/> VIKTIG INFORMATION</h2>{isAdmin && <button type="button" className="secondary-action" onClick={() => startHomeNoticeEdit()}><Plus size={15}/> Lägg till</button>}</div>
      {homeNotices.map(notice => <article className={`home-notice-card ${notice.is_important ? 'important' : ''}`} key={notice.id}>
        <div className="home-notice-meta"><strong>{notice.is_important ? 'VIKTIGT' : 'INFORMATION'}</strong><span>{dateTime(notice.created_at)}</span>{notice.expires_at && <span>Visas till {date(notice.expires_at)}</span>}</div>
        <h3>{notice.title}</h3><p>{notice.body}</p>
        {isAdmin && <div className="home-notice-actions"><button type="button" onClick={() => startHomeNoticeEdit(notice)}>Ändra</button><button type="button" onClick={() => deleteHomeNotice(notice)} style={{color:'#f08080'}}>Ta bort</button></div>}
      </article>)}
      {showHomeNoticeForm && isAdmin && <form className="home-notice-form" onSubmit={saveHomeNotice}>
        <strong>{editingHomeNotice ? 'Ändra information' : 'Ny information'}</strong>
        <input value={homeNoticeForm.title} onChange={e => setHomeNoticeForm(v => ({...v,title:e.target.value}))} placeholder="Rubrik" maxLength={90} required />
        <textarea value={homeNoticeForm.body} onChange={e => setHomeNoticeForm(v => ({...v,body:e.target.value}))} placeholder="Kort meddelande" maxLength={350} required />
        <label><input type="checkbox" checked={homeNoticeForm.is_important} onChange={e => setHomeNoticeForm(v => ({...v,is_important:e.target.checked}))}/> Markera som viktigt</label>
        <label>Visa till och med <input type="datetime-local" value={homeNoticeForm.expires_at} onChange={e => setHomeNoticeForm(v => ({...v,expires_at:e.target.value}))}/></label>
        <div className="home-notice-actions"><button className="primary" disabled={homeNoticeBusy}>{homeNoticeBusy ? 'Sparar…' : 'Publicera'}</button><button type="button" onClick={() => {setShowHomeNoticeForm(false);setEditingHomeNotice(null);}}>Avbryt</button></div>
      </form>}
    </section> : null}
    </>}
    {showReservations ? <>
      <section className="hero page-hero"><div><p className="eyebrow">FÖRSÄLJNING & BOKNING</p><h1>Reservationer</h1><p className="muted">Överblick över kundernas bokade maskiner och återstående antal.</p></div><button className="secondary-action" onClick={loadReservations}><RefreshCw size={16}/> Uppdatera</button></section>
      <section className="page-toolbar"><div className="search"><Search size={18}/><input value={reservationSearch} onChange={e => setReservationSearch(e.target.value)} placeholder="Sök kund, maskin eller ansvarig…"/></div><div className="page-summary"><strong>{reservations.reduce((sum,r)=>sum+Math.max(0,Number(r.quantity||1)-Number(r.fulfilled_quantity||0)),0)} st</strong><span>reserverade totalt</span><strong>{reservations.length}</strong><span>aktiva reservationer</span></div></section>
    {error && <div className="error-banner">{error}</div>}
      {reservations.filter(r => { const machine=machines.find(m=>m.id===r.machine_id); const seller=profiles.find(p=>p.id===r.reserved_by); const q=reservationSearch.trim().toLowerCase(); return !q || [r.customer_name,machine?.brand,machine?.model,machine?.machine_number,seller?.full_name].some(v=>String(v||'').toLowerCase().includes(q)); }).length === 0
        ? <div className="empty"><CalendarDays size={32}/><h3>Inga aktiva reservationer</h3><p>Nya reservationer visas här när de registreras.</p></div>
        : <section className="reservation-list">{reservations.filter(r => { const machine=machines.find(m=>m.id===r.machine_id); const seller=profiles.find(p=>p.id===r.reserved_by); const q=reservationSearch.trim().toLowerCase(); return !q || [r.customer_name,machine?.brand,machine?.model,machine?.machine_number,seller?.full_name].some(v=>String(v||'').toLowerCase().includes(q)); }).map(r => { const machine=machines.find(m=>m.id===r.machine_id); const seller=profiles.find(p=>p.id===r.reserved_by); const remaining=Math.max(0,Number(r.quantity||1)-Number(r.fulfilled_quantity||0)); return <article className="reservation-card" key={r.id}><div className="reservation-card-main"><div className="reservation-card-heading"><p className="eyebrow">RESERVERAD MASKIN</p><h2>{machine ? `${machine.brand || ''} ${machine.model || ''}`.trim() || 'Maskin saknar namn' : 'Maskin saknas'}</h2>{machine?.machine_number && <p className="muted reservation-machine-number">Maskinnummer: {machine.machine_number}</p>}<div className="reservation-customer"><span>KUND</span><strong>{r.customer_name}</strong></div></div><div className="reservation-quantity"><strong>{remaining} st</strong><span>kvar att leverera</span></div></div><div className="reservation-meta"><span><CalendarDays size={15}/> {date(r.reservation_date)}</span>{r.reservation_end_date && <span className="reservation-deadline"><CalendarDays size={16}/><span><strong>RESERVERAD TILL OCH MED</strong><b>{date(r.reservation_end_date)}</b></span></span>}<div className="reservation-seller"><span className="reservation-seller-label">ANSVARIG SÄLJARE</span><strong>{seller?.full_name || 'Ansvarig saknas'}</strong></div><span>Ursprungligt antal: {r.quantity || 1} st</span>{Number(r.fulfilled_quantity||0)>0 && <span>Redan sålda: {r.fulfilled_quantity} st</span>}</div>{machine && <button className="secondary-action" onClick={() => { setShowReservations(false); loadMachineDetails(machine, r.id); }}><Package size={15}/> Öppna maskin och hantera reservation</button>}</article>; })}</section>}
    </> : showInternInfo ? <>
      <section className="hero"><div><p className="eyebrow">INTERN KOMMUNIKATION</p><h1>Interninfo</h1><p className="muted">Nyheter och privata meddelanden inom teamet.</p></div><div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>{internInfoMode === 'news' ? <>{isAdmin && <button type="button" onClick={() => { const next = !showDeletedAnnouncements; setShowDeletedAnnouncements(next); loadAnnouncements(next); }}>{showDeletedAnnouncements ? 'Visa aktiva inlägg' : 'Visa borttagna'}</button>}<button className="primary add-btn" onClick={() => setShowAnnouncementForm(v => !v)}><Plus size={18} /> Skriv meddelande</button></> : <button className="primary add-btn" onClick={() => { setShowNewPrivateMessage(v => !v); setSelectedPrivateConversation(null); }}><Plus size={18} /> Skriv meddelande</button>}</div></section>
      <div className="interninfo-switch"><button type="button" className={internInfoMode === 'news' ? 'active' : ''} onClick={() => { setInternInfoMode('news'); setSelectedPrivateConversation(null); setShowNewPrivateMessage(false); setShowAnnouncementForm(true); }}><Megaphone size={16}/> Information till alla {unreadAnnouncementCount > 0 && <span className="tab-unread-badge">{unreadAnnouncementCount}</span>}</button><button type="button" className={internInfoMode === 'private' ? 'active' : ''} onClick={() => { setInternInfoMode('private'); setShowAnnouncementForm(false); setSelectedPrivateConversation(null); setShowNewPrivateMessage(true); loadPrivateConversations(); }}><Mail size={16}/> Privata meddelanden {unreadPrivateCount > 0 && <span className="tab-unread-badge">{unreadPrivateCount}</span>}</button></div>
      {internInfoMode === 'news' ? <>
      {showAnnouncementForm && <section className="dialog announcement-compose"><h2>Nytt inlägg</h2><form className="machine-form" onSubmit={publishAnnouncement}><label className="full">Rubrik<input value={announcementText.title} onChange={e => setAnnouncementText(v => ({ ...v, title: e.target.value }))} required maxLength={140} placeholder="Vad gäller informationen?" /></label><label className="full">Kategori<select value={announcementText.category} onChange={e => setAnnouncementText(v => ({ ...v, category: e.target.value }))}><option>Information</option><option>Nyhet</option><option>Driftinformation</option><option>Viktigt</option></select></label><label className="full">Meddelande<textarea rows={5} value={announcementText.body} onChange={e => setAnnouncementText(v => ({ ...v, body: e.target.value }))} required placeholder="Skriv informationen här…" /></label><label className="full checkbox-line"><input type="checkbox" checked={announcementText.is_important} onChange={e => setAnnouncementText(v => ({ ...v, is_important: e.target.checked }))} /> Markera som viktig information</label><div className="full announcement-file-picker"><label className="button" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: announcementBusy ? 'wait' : 'pointer' }}><Paperclip size={16} /> Lägg till bilagor<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" onChange={e => { const picked = Array.from(e.target.files || []); setAnnouncementFiles(current => [...current, ...picked].slice(0, 5)); e.target.value = ''; }} disabled={announcementBusy} style={{ display: 'none' }} /></label><small className="muted">Max 5 filer, 15 MB per fil. Bilder, PDF och Office-dokument.</small>{announcementFiles.length > 0 && <div className="announcement-file-list">{announcementFiles.map((file, index) => <span key={`${file.name}-${file.size}-${index}`}><FileText size={14} /> {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB) <button type="button" onClick={() => setAnnouncementFiles(current => current.filter((_, i) => i !== index))} disabled={announcementBusy} aria-label={`Ta bort ${file.name}`}><X size={14} /></button></span>)}</div>}</div><button className="primary wide" disabled={announcementBusy}>{announcementBusy ? 'Publicerar…' : 'Publicera'}</button><button type="button" className="wide" onClick={() => setShowAnnouncementForm(false)}>Avbryt</button></form></section>}
      {announcements.length === 0 ? <div className="empty"><Megaphone size={32} /><h3>{showDeletedAnnouncements ? 'Inga borttagna inlägg' : 'Ingen intern information ännu'}</h3><p>{showDeletedAnnouncements ? 'Det finns inga borttagna inlägg att återställa.' : 'Här visas nyheter och meddelanden från medarbetarna.'}</p></div> : <section className="announcement-list">{announcements.map(item => <article className="dialog announcement-card" key={item.id} style={!readAnnouncementIds.includes(item.id) && !item.deleted_at ? {borderLeft:"4px solid #d92730"} : undefined}><div className="announcement-meta"><span>{item.category || 'Information'}{item.deleted_at ? ' · BORTTAGET' : ''}</span><small>{dateTime(item.created_at)}</small></div><div className="announcement-author"><span>Publicerat av</span><strong>{profiles.find(profile => profile.id === item.created_by)?.full_name || 'Medarbetare'}</strong></div>{item.is_important && <p className="important-label"><AlertCircle size={15} /> Viktig information</p>}<h2>{item.title} {!readAnnouncementIds.includes(item.id) && !item.deleted_at && <span className="tab-unread-badge">Ny</span>}</h2>{!readAnnouncementIds.includes(item.id) && !item.deleted_at && <button type="button" onClick={() => markAnnouncementsAsRead([item])}>Markera som läst</button>}<p className="announcement-body">{item.body}</p>{isAdmin && <div className="dialog-actions" style={{marginTop:12}}>{item.deleted_at ? <button type="button" className="primary" onClick={() => setAnnouncementDeleted(item, false)} disabled={announcementDeleteBusy}><RefreshCw size={15} /> Återställ inlägg</button> : <button type="button" onClick={() => setAnnouncementDeleted(item, true)} disabled={announcementDeleteBusy} style={{color:'#f08080'}}><Trash2 size={15} /> Ta bort inlägg</button>}</div>}{(announcementAttachments[item.id] || []).length > 0 && <div className="announcement-attachments"><strong><Paperclip size={15} style={{ verticalAlign: 'middle' }} /> Bilagor</strong>{announcementAttachments[item.id].map(file => <a className="announcement-attachment" key={file.id} href={file.signedUrl || undefined} target="_blank" rel="noreferrer" onClick={e => { if (!file.signedUrl) { e.preventDefault(); setError('Bilagan kunde inte öppnas. Uppdatera Interninfo och försök igen.'); } }}><FileText size={17} /><span>{file.file_name}</span><small>{(file.file_size / 1024 / 1024).toFixed(1)} MB</small><Download size={15} /></a>)}</div>}<div className="detail-section">{(announcementComments[item.id] || []).filter(comment => showDeletedAnnouncements ? Boolean(comment.deleted_at) : !comment.deleted_at).length > 0 && <h3><MessageSquare size={17} /> Kommentarer ({(announcementComments[item.id] || []).filter(comment => showDeletedAnnouncements ? Boolean(comment.deleted_at) : !comment.deleted_at).length})</h3>}{(announcementComments[item.id] || []).filter(comment => showDeletedAnnouncements ? Boolean(comment.deleted_at) : !comment.deleted_at).map(comment => <div className="comment-item" key={comment.id} style={comment.deleted_at ? {opacity:0.65,borderLeft:'3px solid #a33',paddingLeft:10} : undefined}><p>{comment.message}</p><div className="comment-footer"><small>{profiles.find(profile => profile.id === comment.user_id)?.full_name || 'Medarbetare'} · {dateTime(comment.created_at)}{comment.deleted_at ? ' · BORTTAGEN' : ''}</small>{isAdmin && <button className="comment-delete-button" type="button" onClick={() => setAnnouncementCommentDeleted(comment, !comment.deleted_at)} disabled={announcementDeleteBusy}>{comment.deleted_at ? <><RefreshCw size={14}/> Återställ</> : <><Trash2 size={14}/> Ta bort</>}</button>}</div></div>)}{!showDeletedAnnouncements && !item.deleted_at && <form className="comment-form" onSubmit={event => addAnnouncementComment(event, item.id)}><textarea rows={2} placeholder="Skriv en kommentar eller fråga…" value={announcementCommentText[item.id] || ''} onChange={e => setAnnouncementCommentText(v => ({ ...v, [item.id]: e.target.value }))} required /><button className="primary" disabled={!(announcementCommentText[item.id] || '').trim()}><Send size={16} /> Skicka</button></form>}</div></article>)}</section>}

      </> : <section className="private-message-layout">
        {(showNewPrivateMessage || selectedPrivateConversation) && <div className="private-compose-panel">
          {showNewPrivateMessage ? <>
            <h2><MessageCircle size={19}/> Nytt privat meddelande</h2>
            <form onSubmit={startPrivateConversation} className="private-compose-form">
              <label>Mottagare – välj en eller flera
                <details className="private-recipient-picker">
                  <summary><span>{privateRecipientIds.length ? profiles.filter(p => privateRecipientIds.includes(p.id)).map(p => p.full_name || 'Medarbetare').join(', ') : 'Välj mottagare'}</span><ChevronDown size={17}/></summary>
                  <div className="private-recipient-options">
                    {profiles.filter(p => p.id !== session?.user?.id && p.is_active !== false).map(p => <label key={p.id}><input type="checkbox" checked={privateRecipientIds.includes(p.id)} onChange={e => setPrivateRecipientIds(current => e.target.checked ? [...current, p.id] : current.filter(id => id !== p.id))}/><span>{p.full_name || 'Medarbetare'}{p.role === 'admin' ? ' · Admin' : ''}</span></label>)}
                  </div>
                </details>
              </label>
              <label>Meddelande<textarea rows={3} value={privateMessageText} onChange={e => setPrivateMessageText(e.target.value)} maxLength={5000} required placeholder="Skriv ditt privata meddelande…"/></label>
              <div className="private-compose-actions"><button className="primary" disabled={privateBusy || !privateRecipientIds.length || !privateMessageText.trim()}><Send size={16}/> {privateBusy ? 'Skickar…' : 'Skicka meddelande'}</button><button type="button" onClick={() => {setShowNewPrivateMessage(false);setPrivateMessageText('');setPrivateRecipientIds([]);}}>Avbryt</button></div>
            </form>
          </> : <>
            <div className="private-view-heading"><div><p className="eyebrow">SVAR TILL</p><h2>{selectedPrivateConversation.participants.filter(p => p.user_id !== session.user.id).map(p => profiles.find(profile => profile.id === p.user_id)?.full_name || 'Medarbetare').join(', ') || 'Konversation'}</h2></div><button type="button" onClick={() => {setSelectedPrivateConversation(null);setPrivateMessageText('');}}>Stäng</button></div>
            {selectedPrivateConversation.participants.some(p => p.user_id === session.user.id) ? <form className="private-compose-form" onSubmit={sendPrivateReply}><label>Skriv meddelande<textarea rows={3} value={privateMessageText} onChange={e => setPrivateMessageText(e.target.value)} maxLength={5000} placeholder="Skriv ett svar…" required/></label><button className="primary" disabled={privateBusy || !privateMessageText.trim()}><Send size={16}/> {privateBusy ? 'Skickar…' : 'Skicka svar'}</button></form> : <p className="muted">Administratörsvy – endast deltagarna kan svara i konversationen.</p>}
          </>}
        </div>}
        {selectedPrivateConversation ? <div className="private-conversation-view">
          <div className="private-view-heading"><div><p className="eyebrow">KONVERSATION</p><h2>{selectedPrivateConversation.participants.filter(p => p.user_id !== session.user.id).map(p => profiles.find(profile => profile.id === p.user_id)?.full_name || 'Medarbetare').join(', ') || 'Privat konversation'}</h2></div></div>
          <div className="private-message-list">{[...privateMessages].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(message => <div className={`private-bubble ${message.sender_id === session.user.id ? 'mine' : ''}`} key={message.id}><p>{message.body}</p><small>{profiles.find(p => p.id === message.sender_id)?.full_name || 'Medarbetare'} · {dateTime(message.created_at)}</small>{(isAdmin || message.sender_id === session.user.id) && <button type="button" className="private-message-delete" title="Ta bort meddelande för alla" aria-label="Ta bort meddelande för alla" disabled={privateBusy} onClick={() => deletePrivateMessage(message)}><Trash2 size={14}/></button>}</div>)}</div>
        </div> : <div className="private-conversation-view is-empty"><div className="empty"><Mail size={32}/><h3>Välj en konversation</h3><p>Öppna ett meddelande i inkorgen eller starta ett nytt.</p></div></div>}
        <aside className="private-conversation-list">
          <div className="private-list-heading"><h2><Mail size={18}/> Inkorg</h2><button type="button" className="admin-refresh-button" onClick={loadPrivateConversations} disabled={privateBusy}><RefreshCw size={14}/> Uppdatera</button></div>
          {privateBusy && privateConversations.length === 0 ? <p className="muted">Hämtar meddelanden…</p> : privateConversations.length === 0 ? <p className="muted">Inga privata meddelanden ännu.</p> : [...privateConversations].sort((a,b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)).map(thread => {
            const otherIds = thread.participants.filter(p => p.user_id !== session.user.id).map(p => p.user_id);
            const names = otherIds.map(id => profiles.find(p => p.id === id)?.full_name || 'Medarbetare').join(', ');
            const last = thread.messages[thread.messages.length - 1];
            return <button type="button" key={thread.id} className={`private-thread ${selectedPrivateConversation?.id === thread.id ? 'active' : ''}`} onClick={() => { markPrivateThreadAsRead(thread); setSelectedPrivateConversation(thread); setPrivateMessages(thread.messages || []); setShowNewPrivateMessage(false); setPrivateMessageText(''); }}>
              <strong>{names || 'Privat konversation'} {thread.messages.some(m => m.sender_id !== session.user.id && !readPrivateMessageIds.includes(m.id)) && <span className="tab-unread-badge">Ny</span>}</strong><small>{last?.body || 'Inget meddelande ännu'}</small><time>{last ? dateTime(last.created_at) : dateTime(thread.created_at)}</time>
            </button>;
          })}
        </aside>
      </section>}
    </> : showAdmin && isAdmin ? <>    {showAdmin && isAdmin && <section className="admin-page page-panel"><div className="page-panel-heading"><div><p className="eyebrow">SYSTEMINSTÄLLNINGAR</p><h1><Users size={24} /> Administration</h1><p className="muted">Hantera personal, behörigheter och konton.</p></div></div><h2><Users size={22} /> Personaladministration</h2><p className="muted">Bjud in medarbetare. De får en länk via e-post för att skapa sitt eget lösenord.</p><form className="machine-form" onSubmit={inviteUser}><label className="full">Medarbetarens namn<input value={newUserName} onChange={e => setNewUserName(e.target.value)} required placeholder="För- och efternamn" /></label><label className="full">E-postadress<input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required placeholder="namn@moremaskiner.se" /></label><label className="full">Behörighet<select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}><option value="seller">Säljare</option><option value="admin">Administratör</option></select></label><button className="primary wide" disabled={adminBusy}><UserPlus size={16} /> {adminBusy ? 'Skickar inbjudan…' : 'Bjud in medarbetare'}</button>{error && <p className="error full">{error}</p>}</form><div className="detail-section"><h3><ShieldCheck size={18} /> Skapa lösenordslänk</h3><p className="muted">Skapa en länk åt en befintlig medarbetare utan att skicka e-post.</p><form className="machine-form" onSubmit={createRecoveryLink}><label className="full">Medarbetarens e-post<input type="email" value={recoveryEmail} onChange={e => { setRecoveryEmail(e.target.value); setRecoveryLink(''); }} required placeholder="namn@moremaskiner.se" /></label><button className="primary wide" disabled={adminBusy}>{adminBusy ? 'Skapar länk…' : 'Skapa lösenordslänk'}</button>{recoveryLink && <label className="full">Länk – kopiera och skicka säkert<textarea value={recoveryLink} readOnly onFocus={e => e.target.select()} rows={4} /></label>}{error && <p className="error full">{error}</p>}</form></div><div className="detail-section"><div className="admin-users-heading"><h3><ShieldCheck size={18} /> Personal i systemet</h3><button type="button" className="admin-refresh-button" onClick={loadAdminUsers} disabled={adminUsersLoading || adminBusy}><RefreshCw size={14} /> {adminUsersLoading ? 'Hämtar…' : 'Uppdatera lista'}</button></div><p className="muted">Ändringar påverkar användarens inloggning och behörighet. Historik och tidigare bokningar behålls.</p><div className="admin-users-heading"><span className="muted">{adminUsers.filter(user => user.is_active !== false).length} aktiva medarbetare</span>{adminUsers.some(user => user.is_active === false) && <button type="button" className="admin-refresh-button" onClick={() => setShowInactiveUsers(value => !value)}>{showInactiveUsers ? 'Dölj avaktiverade' : `Visa avaktiverade (${adminUsers.filter(user => user.is_active === false).length})`}</button>}</div>{adminUsersLoading && adminUsers.length === 0 ? <p className="muted">Hämtar personal…</p> : adminUsers.length === 0 ? <p className="muted">Inga användare kunde hämtas. Prova att uppdatera listan.</p> : adminUsers.filter(user => showInactiveUsers || user.is_active !== false).map(user => <div className="history-item admin-user-row" key={user.id}><div className="admin-user-main"><strong>{user.full_name || 'Namn saknas'}</strong><small>{user.email || 'E-post saknas'} · {user.auth_user_found === false ? 'Auth-konto saknas' : user.is_active ? 'Aktiv' : 'Avaktiverad'}</small></div><div className="admin-user-controls"><select aria-label={`Behörighet för ${user.full_name || user.email}`} value={user.role || 'seller'} disabled={adminBusy || user.id === session?.user?.id} onChange={e => updateAdminUser('change_role', user, e.target.value)}><option value="seller">Säljare</option><option value="admin">Administratör</option></select>{user.id !== session?.user?.id && <button type="button" className="admin-status-button" disabled={adminBusy} onClick={() => updateAdminUser(user.is_active ? 'deactivate' : 'reactivate', user)}>{user.is_active ? 'Avaktivera' : 'Återaktivera'}</button>}</div></div>)}<div className="detail-section auth-activity-section"><button type="button" className="admin-refresh-button" onClick={() => { const next = !showAuthActivity; setShowAuthActivity(next); if (next) loadAuthActivity(); }}><History size={15} /> {showAuthActivity ? 'Dölj inloggningshistorik' : 'Visa inloggningshistorik'}</button>{showAuthActivity && <div className="auth-activity-list">{authActivityLoading ? <p className="muted">Hämtar historik…</p> : authActivity.length === 0 ? <p className="muted">Ingen inloggningshistorik ännu.</p> : authActivity.map(item => <div className="auth-activity-row" key={item.id}><span className={item.event_type === 'login' ? 'auth-activity-icon login' : 'auth-activity-icon logout'}>{item.event_type === 'login' ? <LogIn size={16} /> : <LogOut size={16} />}</span><div><strong>{item.profiles?.full_name || 'Okänd användare'}</strong><small>{item.event_type === 'login' ? 'Loggade in' : 'Loggade ut'} · {dateTime(item.created_at)}</small></div></div>)}</div>}</div></div><details className="detail-section deleted-machines-section" onToggle={e => { if (e.currentTarget.open) loadDevelopmentLog(); }}>
        <summary className="deleted-machines-summary"><span>Versionshistorik</span><small>{releaseNotes.length} ändringar</small></summary>
        <div className="deleted-machines-content">
          {releaseNotes.length === 0 ? <p className="muted">Inga versioner registrerade ännu.</p> : releaseNotes.map(note => <article className="history-item release-note-item" key={note.id}><div className="release-note-heading"><strong>{note.title}</strong><small>{new Date(note.release_date + 'T12:00:00').toLocaleDateString('sv-SE')}</small></div><p style={{whiteSpace:'pre-wrap'}}>{note.changes}</p></article>)}
        </div>
      </details></section>}</> : <>
    <section className="hero"><div><p className="eyebrow">PRODUKTÖVERSIKT</p><h1>Produkter</h1><p className="muted">Hela MÖRE:s sortiment med lagerstatus, inkommande leveranser och försäljning.</p></div><button className="primary add-btn" onClick={() => { setShowAdd(true); setForm(emptyForm); setMachineTemplateId(''); setAddDeliveries([]); setNewDelivery(emptyDelivery()); setError(''); }}><Plus size={18} /> Lägg till produkt</button></section>
    <div className="machine-search-intro"><strong>Hitta rätt produkt</strong><p>Sök på artikelnummer, produkt, fabrikat eller modell. Du kan söka på hela eller delar av artikelnumret eller namnet.</p></div>
    <section className="toolbar machine-search-toolbar"><form className="machine-search-form" onSubmit={e => { e.preventDefault(); setSearch(search.trim()); }}><div className="search"><Search size={18} /><input placeholder="Sök artikelnummer, produkt, fabrikat eller modell…" aria-label="Sök produkter" value={search} onChange={e => setSearch(e.target.value)} /></div><button type="button" className="machine-search-clear" onClick={() => setSearch('')}>Rensa</button><button type="submit" className="primary machine-search-submit">Sök</button></form></section>

    <section className="stats">
      {[
        { value: 'all', label: 'Produkter', count: machines.length, Icon: Package },
        { value: 'incoming', label: 'På väg hem', count: machines.reduce((sum, m) => sum + Math.max(0, Number(m.incoming_quantity || 0)), 0), Icon: Package },
        { value: 'sold', label: 'Sålda', count: machines.reduce((sum, m) => sum + displayedSoldQuantity(m), 0), Icon: CheckCircle2 },
        { value: 'reorder', label: 'Produkter att beställa', count: groupedReorderNeeds.reduce((sum, n) => sum + Number(n.order_quantity || 0), 0), Icon: AlertCircle }
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

    {filter === 'reorder' && <section className="detail-section reorder-overview"><h2>Produkter att beställa</h2><p className="muted">Beställningsbehov för samma produkt samlas här. Varje kundförsäljning visas separat så att kunduppgifterna följer med.</p>{groupedReorderNeeds.length === 0 ? <p className="empty">Det finns inga öppna beställningsbehov.</p> : <div className="reorder-needs-list">{groupedReorderNeeds.filter(group => !search.trim() || machines.some(m => m.id === group.machine_id && [m.machine_number,m.article_code,m.brand,m.model].some(v => String(v || '').toLowerCase().includes(search.toLowerCase())))).map(group => { const machine = machines.find(m => m.id === group.machine_id); return <article className="reorder-need-card" key={group.machine_id}><div><strong>{machine ? [machine.brand,machine.model].filter(Boolean).join(' ') : 'Produkt'}</strong><p className="muted">{machine?.article_code ? `Artikelkod ${machine.article_code}` : machine?.machine_number || 'Artikelnummer saknas'}</p><small>Sålda: {group.sold_quantity} st · Från lager: {group.stock_used} st · Saknas: {Math.max(0, Number(group.sold_quantity || 0) - Number(group.stock_used || 0) - Number(group.incoming_covered || 0))} st · På väg hem: {group.incoming_covered} st</small>{group.sales.length > 0 && <div className="reorder-customer-list"><strong>Kundförsäljningar</strong>{group.sales.map(sale => <div className="reorder-customer-card" key={sale.id} style={{ opacity: sale.status === 'reversed' ? 0.65 : 1 }}><div className="reorder-customer-main"><strong>{sale.customer_name || 'Kundnamn saknas'}{sale.status === 'reversed' ? ' · Återförd' : ''}</strong>{sale.customer_phone && <a href={'tel:' + sale.customer_phone}>{sale.customer_phone}</a>}</div><div className="reorder-customer-order"><span>Kundens ordernummer</span><strong>{sale.customer_order_number || 'Saknas – äldre försäljning'}</strong><small>{sale.quantity} st · {date(sale.sale_date)}</small></div>{sale.customer_company && <small>{sale.customer_company}</small>}{sale.customer_email && <a href={'mailto:' + sale.customer_email}>{sale.customer_email}</a>}</div>)}</div>}</div><div className="reorder-need-action"><div className="reorder-order-block"><strong className="reorder-order-heading">Att beställa:</strong><label className="reorder-quantity-label"><input aria-label="Att beställa antal" type="number" min="1" step="1" value={reorderQuantityEdits[group.machine_id] ?? group.order_quantity} onChange={e => setReorderQuantityEdits(current => ({ ...current, [group.machine_id]: e.target.value }))} /></label></div><button className="secondary" onClick={() => saveReorderNeedQuantity(group)} disabled={saving || Number(reorderQuantityEdits[group.machine_id] ?? group.order_quantity) === Number(group.order_quantity)}>Spara antal</button><button className="primary" onClick={() => markReorderNeedOrdered(group)} disabled={saving}>Beställ · flytta till På väg hem</button></div></article>; })}</div>}</section>}

    {error && <div className="error-banner">{error}</div>}
    {filter === 'reorder' || (filter === 'overview' && !search.trim()) ? null : loading ? <p className="empty">Hämtar maskiner…</p> : filtered.length === 0 ? <div className="empty"><Package size={34} /><h3>{filter === 'reorder' ? 'Inga produkter att beställa' : 'Inga produkter att visa'}</h3><p>{filter === 'reorder' ? 'Det finns inga öppna beställningsbehov just nu.' : 'Prova att ändra sökning eller filter, eller lägg till en produkt.'}</p></div> : <section className="machine-grid">{filtered.map(machine => <button className="machine-card" key={machine.id} onClick={() => loadMachineDetails(machine)}><div className="machine-photo">{machine.main_photo_url ? <img src={machine.main_photo_url} alt={`${machine.brand || ''} ${machine.model || 'Maskin'}`} /> : <Package size={36} />}<span className={'status ' + (availableStock(machine) > 0 ? 'in_stock' : Number(machine.incoming_quantity || 0) > 0 ? 'incoming' : 'out_of_stock')}>{availableStock(machine) > 0 ? `${availableStock(machine)} st i lager` : Number(machine.incoming_quantity || 0) > 0 ? `Slut i lager · ${Number(machine.incoming_quantity)} st på väg hem` : 'Slut i lager'}</span></div><div className="machine-info"><p className="machine-no">{machine.article_code ? `Artikelkod ${machine.article_code}` : (machine.machine_number || 'Inget artikelnummer')}</p><h3>{[machine.brand,machine.model].filter(Boolean).join(' ') || 'Produkt'}</h3><div className="details"><span>{machine.year || 'Årsmodell saknas'}</span><span>{machine.hours != null ? `${machine.hours.toLocaleString('sv-SE')} h` : 'Timmar saknas'}</span></div><div className="machine-quantity-summary"><span><strong>{availableStock(machine)}</strong><small>Lager</small></span><span><strong>{displayedSoldQuantity(machine)}</strong><small>Sålda</small></span></div>{Number(machine.incoming_quantity || 0) > 0 && <p className="incoming-note">På väg hem: <strong>{Number(machine.incoming_quantity)} st</strong></p>}<strong className="price">{machine.price != null ? `${Number(machine.price).toLocaleString('sv-SE')} kr exkl. moms` : 'Pris saknas'}</strong></div></button>)}</section>}

    {selected && <div className="overlay" onClick={() => { setSelected(null); setSelectedReservationId(null); setSelectedDetailMode('stock'); setShowSalesHistory(false); }}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => { setSelected(null); setSelectedReservationId(null); setSelectedDetailMode('stock'); setShowSalesHistory(false); }}><X /></button><p className="eyebrow">PRODUKTDETALJER</p><h2>{selected.brand} {selected.model}</h2><p className="muted">{selected.article_code ? `Artikelkod ${selected.article_code}` : (selected.machine_number || 'Artikelkod saknas')}</p><p>{selected.description || 'Ingen beskrivning registrerad.'}</p><div className="details"><span>Årsmodell: {selected.year || '–'}</span><span>Timmar: {selected.hours ?? '–'}</span></div><strong className="price">{selected.price != null ? `${Number(selected.price).toLocaleString('sv-SE')} kr exkl. moms` : 'Pris saknas'}</strong><p className="muted">Lagerstatus: <strong>{availableStock(selected) > 0 ? `Finns i lager · ${availableStock(selected)} st` : Number(selected.incoming_quantity || 0) > 0 ? `Slut i lager · ${Number(selected.incoming_quantity)} st på väg hem` : 'Slut i lager'}</strong></p>
      <div className="dialog-actions"><button type="button" className="secondary-action" onClick={openEditMachine}>Redigera maskinuppgifter</button></div>
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
      {isReservationContext && detailReservations.length > 0 && <div className="detail-reservation-sellers">{detailReservations.map(r => <div className="detail-reservation-seller" key={`seller-${r.id}`}><span className="reservation-seller-label">ANSVARIG SÄLJARE{detailReservations.length > 1 ? ` · ${r.customer_name || 'Kund'}` : ''}</span><strong>{profiles.find(p => p.id === r.reserved_by)?.full_name || 'Namn saknas'}</strong></div>)}</div>}
      {!isSoldContext && <>
      <div className="reservation-info inventory-summary"><h3>Lager och försäljning</h3><p>Fysiskt i lager: <strong>{Number(selected.stock_quantity ?? 1)} st</strong></p><p>Tillgängliga i lager: <strong>{availableStock(selected)} st</strong></p><p>Sålda/orderlagda: <strong>{displayedSoldQuantity(selected)} st</strong></p>
      {isReservationContext && detailReservations.length > 0 && <><h3>{selectedReservationId !== null ? 'Vald reservation' : 'Aktiva reservationer'}</h3>{detailReservations.map(r => { const remaining = Math.max(0, Number(r.quantity || 1) - Number(r.fulfilled_quantity || 0)); return <div className="history-item reservation-row" key={r.id}><strong>{r.customer_name}</strong><small>{remaining} st kvar att leverera · {date(r.reservation_date)}</small>{r.reservation_end_date && <div className="reservation-deadline detail-deadline"><CalendarDays size={16}/><span><strong>RESERVERAD TILL OCH MED</strong><b>{date(r.reservation_end_date)}</b></span></div>}<button onClick={() => openEditReservation(r)} disabled={saving}>Redigera reservation</button><label className="full">Antal att sälja från reservation<input type="number" min="1" max={remaining} value={saleQuantity} onChange={e => setSaleQuantity(e.target.value)} /></label><button className="primary" onClick={() => markSold(r.id)} disabled={saving}>Sälj från reservation</button><button onClick={() => cancelReservation(r.id)} disabled={saving}><Ban size={16} /> Avboka återstående antal</button></div>; })}</>}
      {isReservationContext && detailReservations.length === 0 && <p className="muted">Den här reservationen är avslutad eller avbokad. Uppdatera reservationerna för aktuell status.</p>}
      </div>
      </>}
      {!isReservationContext && !isSoldContext && filter !== 'incoming' && <div className="stock-actions">
        <h4>Försäljning från lager</h4>
        <p className="muted">Tillgängligt att sälja: <strong>{availableStock(selected)} st</strong></p>
        <>
          <label className="full">Antal att sälja<input type="number" min="1" step="1" value={saleQuantity} onChange={e => setSaleQuantity(e.target.value)} /></label>
          <button className="primary" onClick={beginDirectSale} disabled={saving}>Sälj från lagret</button>
        </>
      </div>}
      {!isSoldContext && (
      <div className="detail-section inventory-controls"><h3>{filter === 'incoming' ? 'Inkommande leveranser' : 'Lager och leveranser'}</h3>{filter !== 'incoming' && <div className="quantity-control"><div className="quantity-heading"><strong>Antal i lager</strong><span>Fysiskt på plats</span></div><input aria-label="Antal i lager" type="number" min="0" step="1" value={stockEdit} onChange={e => setStockEdit(e.target.value)} /><button className="primary" onClick={saveStockQuantity} disabled={Number(stockEdit) === Number(selected.stock_quantity ?? 1)}>Spara lagersaldo</button></div>}{incomingDeliveries.length > 0 && <div className="quantity-control incoming-deliveries-control"><div className="quantity-heading"><strong>Inkommande leveranser</strong><span>{incomingDeliveries.reduce((sum, d) => sum + Number(d.quantity || 0), 0)} st totalt på väg hem</span></div>{incomingDeliveries.map(delivery => <div className="incoming-delivery-card" key={delivery.id}>{delivery.sale_id && (() => { const customer = incomingDeliverySales.find(item => item.id === delivery.sale_id); return customer ? <div className="incoming-customer-card"><strong>{customer.customer_name || 'Kundnamn saknas'}</strong><span>Kundens ordernummer: <strong>{customer.customer_order_number || 'Saknas – äldre försäljning'}</strong></span>{customer.customer_phone && <a href={'tel:' + customer.customer_phone}>{customer.customer_phone}</a>}{customer.customer_company && <small>{customer.customer_company}</small>}{customer.customer_email && <a href={'mailto:' + customer.customer_email}>{customer.customer_email}</a>}</div> : <p className="muted incoming-customer-missing">Kunduppgifter saknas för denna leverans</p>; })()}<div className="incoming-delivery-title"><strong>{delivery.quantity} st</strong><span className="incoming-eta-value">{delivery.eta_year && delivery.eta_week ? `ETA ${delivery.eta_year} v${String(delivery.eta_week).padStart(2, '0')}` : 'ETA ej angiven'}</span>{delivery.is_stock_replenishment && <span className="incoming-stock-tag">Lagerpåfyllning</span>}<button type="button" className="text-button edit-eta-button" onClick={() => setEditingDeliveryEtaId(current => current === delivery.id ? null : delivery.id)}>{editingDeliveryEtaId === delivery.id ? 'Avbryt' : 'Ändra ETA'}</button><button type="button" className="icon-button" aria-label="Ta bort leverans" onClick={() => removeIncomingDelivery(delivery)}><Trash2 size={16}/></button></div>{editingDeliveryEtaId === delivery.id && <div className="delivery-eta-edit"><label>ETA år<input type="number" min="2020" max="2100" value={delivery.eta_year ?? ''} onChange={e => setIncomingDeliveries(rows => rows.map(item => item.id === delivery.id ? { ...item, eta_year: e.target.value } : item))}/></label><label>ETA vecka<input type="number" min="1" max="53" value={delivery.eta_week ?? ''} onChange={e => setIncomingDeliveries(rows => rows.map(item => item.id === delivery.id ? { ...item, eta_week: e.target.value } : item))}/></label><button type="button" onClick={() => saveIncomingDeliveryEta(delivery)}>Spara ändring</button></div>}<div className="receive-delivery-row"><label>Ta emot antal<input type="number" min="1" max={delivery.quantity} step="1" value={receiveDeliveryAmounts[delivery.id] ?? String(delivery.quantity)} onChange={e => setReceiveDeliveryAmounts(current => ({ ...current, [delivery.id]: e.target.value }))}/></label><button className="primary" onClick={() => receiveIncomingDelivery(delivery)}>Registrera mottaget</button></div></div>)}</div>}{displayedSoldQuantity(selected) > 0 && <p className="muted sold-total"><strong>Sålda totalt:</strong> {displayedSoldQuantity(selected)} st</p>}

      </div>
      )}
      {isSoldContext && displayedSoldQuantity(selected) > 0 && <section className="stock-actions sold-actions"><h4>Såld maskin</h4><p className="muted">Sålda totalt: <strong>{displayedSoldQuantity(selected)} st</strong></p><div className="machine-sales-list"><button type="button" className="admin-refresh-button" onClick={() => setShowSalesHistory(value => !value)}><History size={16} /> {showSalesHistory ? 'Dölj försäljningshistorik' : `Visa försäljningshistorik (${machineSales.length})`}</button>{showSalesHistory && <><h4>Försäljningsuppgifter</h4>{machineSales.length === 0 ? <p className="muted">Inga kunduppgifter registrerade för försäljningen.</p> : machineSales.map(sale => <div className="history-item sale-customer-card" key={sale.id} style={{ opacity: sale.status === 'reversed' ? 0.65 : 1 }}><span className="sale-customer-label">KUNDUPPGIFTER</span><strong>{sale.customer_name || 'Kundnamn saknas'} {sale.status === 'reversed' ? '· Återförd' : ''}</strong><small>{sale.quantity} st · {date(sale.sale_date)}</small><small>Kundens ordernummer: <strong>{sale.customer_order_number || 'Saknas – äldre försäljning'}</strong></small>{sale.customer_company && <span>{sale.customer_company}</span>}{sale.customer_phone && <a href={'tel:' + sale.customer_phone} style={{ color: 'inherit', textDecoration: 'none' }}>{sale.customer_phone}</a>}{sale.customer_email && <a href={'mailto:' + sale.customer_email}>{sale.customer_email}</a>}{sale.note && <p>{sale.note}</p>}</div>)}</>}</div>{Number(selected.sold_quantity || 0) > 0 && <button onClick={restoreSoldMachine} disabled={saving}>Ångra fakturerad försäljning – återför 1 till lagret</button>}</section>}
      <div className="detail-section"><h3><MessageSquare size={18} /> Kommentarer</h3><form onSubmit={addComment} className="comment-form"><textarea placeholder="Skriv en kommentar om maskinen…" value={commentText} onChange={e => setCommentText(e.target.value)} required /><button className="primary" disabled={!commentText.trim()}><Send size={16} /> Skicka</button></form>{comments.length === 0 ? <p className="muted">Inga kommentarer ännu.</p> : comments.map(c => <div className="comment-item" key={c.id}><p>{c.message}</p><small>{dateTime(c.created_at)}</small></div>)}</div>
      <div className="detail-section"><button type="button" className="admin-refresh-button" onClick={() => setShowMachineHistory(value => !value)}><History size={18} /> {showMachineHistory ? 'Dölj historik' : 'Visa historik'}</button>{showMachineHistory && <div className="machine-history-list"><h3>Maskinhistorik</h3>{history.length === 0 ? <p className="muted">Ingen historik registrerad ännu.</p> : history.map(h => <div className="history-item" key={h.id}><strong>{h.action}</strong><small>{dateTime(h.created_at)}</small></div>)}</div>}</div>
      {isAdmin && <div className="detail-section"><button className="wide" style={{ background: "#8f2525", color: "white", border: "1px solid #8f2525" }} onClick={deleteMachine} disabled={deleteBusy}><Trash2 size={16} /> {deleteBusy ? 'Tar bort…' : 'Ta bort maskin'}</button></div>}
    </section></div>}

    {editingReservation && selected && <div className="overlay" onClick={() => !saving && setEditingReservation(null)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => !saving && setEditingReservation(null)} disabled={saving}><X /></button><p className="eyebrow">REDIGERA RESERVATION</p><h2>Ändra kundreservation</h2><p className="muted">{selected.brand} {selected.model} · {selected.machine_number || 'Utan maskinnummer'}</p><form className="machine-form" onSubmit={saveReservationEdit}>
      <label className="full">Kundens namn<input value={reservationEditForm.customer_name} onChange={e => setReservationEditForm({ ...reservationEditForm, customer_name: e.target.value })} required /></label>
      <label className="full">Totalt reserverat antal<input type="number" min={Math.max(1, Number(editingReservation.fulfilled_quantity || 0))} step="1" value={reservationEditForm.quantity} onChange={e => setReservationEditForm({ ...reservationEditForm, quantity: e.target.value })} required /></label>
      {Number(editingReservation.fulfilled_quantity || 0) > 0 && <p className="muted">Redan levererade: {Number(editingReservation.fulfilled_quantity)} st. Det antalet kan inte ändras här.</p>}
      <label className="full">Ansvarig säljare<select value={reservationEditForm.reserved_by} onChange={e => setReservationEditForm({ ...reservationEditForm, reserved_by: e.target.value })} required><option value="">Välj säljare</option>{profiles.filter(p => ['admin', 'seller'].includes(p.role)).map(p => <option key={p.id} value={p.id}>{p.full_name || 'Användare'}</option>)}</select></label>
      <label className="full">Reservationsdatum<input type="date" value={reservationEditForm.reservation_date} onChange={e => setReservationEditForm({ ...reservationEditForm, reservation_date: e.target.value })} required /></label>
      <label className="full">Reserverad till och med (valfritt)<input type="date" min={new Date().toLocaleDateString('sv-SE')} value={reservationEditForm.reservation_end_date} onChange={e => setReservationEditForm({ ...reservationEditForm, reservation_end_date: e.target.value })} /><small className="muted">Ansvarig säljare får en pushpåminnelse två dagar före slutdatumet.</small></label>
      <p className="muted">Om du ökar antalet kontrollerar systemet att tillräckligt många maskiner är lediga. Ändringen sparas i maskinhistoriken.</p>
      <button className="primary wide" disabled={saving}>{saving ? 'Sparar…' : 'Spara ändringar'}</button>{error && <p className="error">{error}</p>}
    </form></section></div>}

    {showDirectSaleForm && selected && <div className="overlay" onClick={() => { if (!saving) { setShowDirectSaleForm(false); setOverstockConfirmed(false); } }}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => { setShowDirectSaleForm(false); setOverstockConfirmed(false); }} disabled={saving}><X /></button><p className="eyebrow">REGISTRERA FÖRSÄLJNING</p><h2>Kunduppgifter</h2><p className="muted">{selected.brand} {selected.model} · {saleQuantity} st</p><form className="machine-form" onSubmit={e => { e.preventDefault(); markSold(null, overstockConfirmed); }}>
      <label className="full">Kundens namn<input value={directSaleForm.customer_name} onChange={e => setDirectSaleForm({ ...directSaleForm, customer_name: e.target.value })} required placeholder="Ange kundens namn" /></label>
      <label className="full">Telefonnummer<input type="tel" value={directSaleForm.customer_phone} onChange={e => setDirectSaleForm({ ...directSaleForm, customer_phone: e.target.value })} required placeholder="Ange telefonnummer" /></label>
      <label className="full">Kundens ordernummer<input value={directSaleForm.customer_order_number} onChange={e => setDirectSaleForm({ ...directSaleForm, customer_order_number: e.target.value })} required placeholder="Ange kundens ordernummer" /></label>
      <label className="full">Företag (valfritt)<input value={directSaleForm.customer_company} onChange={e => setDirectSaleForm({ ...directSaleForm, customer_company: e.target.value })} /></label>
      <label className="full">E-post (valfritt)<input type="email" value={directSaleForm.customer_email} onChange={e => setDirectSaleForm({ ...directSaleForm, customer_email: e.target.value })} /></label>
      <label className="full">Försäljningsdatum<input type="date" value={directSaleForm.sale_date} onChange={e => setDirectSaleForm({ ...directSaleForm, sale_date: e.target.value })} required /></label>
      <label className="full">Anteckning (valfritt)<textarea value={directSaleForm.note} onChange={e => setDirectSaleForm({ ...directSaleForm, note: e.target.value })} placeholder="Övrig information om försäljningen" /></label>
      <button className="primary wide" disabled={saving}>{saving ? 'Registrerar…' : 'Fortsätt med försäljningen'}</button>{error && <p className="error">{error}</p>}
    </form></section></div>}

    {overstockConfirmation && selected && <div className="overlay" onClick={() => !saving && setOverstockConfirmation(null)}><section className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="overstock-title" onClick={e => e.stopPropagation()}><button className="close" onClick={() => !saving && setOverstockConfirmation(null)} disabled={saving}><X /></button><p className="eyebrow">LAGRET RÄCKER INTE</p><h2 id="overstock-title">Försäljningen överstiger lagret</h2><p>Du försöker sälja <strong>{overstockConfirmation.amount} st</strong>, men det finns bara <strong>{overstockConfirmation.physicalAvailable} st</strong> tillgängliga i lager.</p><div className="reservation-info"><p>På väg hem: <strong>{overstockConfirmation.incomingAvailable} st</strong></p><p>Saknas: <strong>{Math.max(0, overstockConfirmation.amount - overstockConfirmation.physicalAvailable - overstockConfirmation.fromIncoming)} st</strong></p><p>Behöver beställas: <strong>{overstockConfirmation.toOrder} st</strong></p></div><p className="muted">Om du fortsätter sparas försäljningen med kunduppgifterna och beställningsbehovet registreras automatiskt.</p><button className="primary wide" onClick={() => { setOverstockConfirmed(true); setOverstockConfirmation(null); setShowDirectSaleForm(true); }} disabled={saving}>Fortsätt till kundkortet</button><button className="wide" onClick={() => setOverstockConfirmation(null)} disabled={saving}>Avbryt</button></section></div>}

    {showReservation && selected && <div className="overlay" onClick={() => { setShowReservation(false); setReservationEndDate(''); }}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowReservation(false)}><X /></button><p className="eyebrow">NY RESERVATION</p><h2>Reservera maskin</h2><p className="muted">{selected.brand} {selected.model} – {selected.machine_number}</p><form className="machine-form" onSubmit={createReservation}><label className="full">Antal att reservera<input type="number" min="1" max={availableStock(selected)} value={reservationQuantity} onChange={e => setReservationQuantity(e.target.value)} required /></label><label className="full">Kundens namn<input value={customerName} onChange={e => setCustomerName(e.target.value)} required placeholder="Ange kundens namn" /></label><label className="full">Ansvarig säljare<select value={reservedBy} onChange={e => setReservedBy(e.target.value)} required><option value="">Välj säljare</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || 'Inloggad användare'}</option>)}</select></label><label className="full">Reservationsdatum<input type="date" value={reservationDate} onChange={e => setReservationDate(e.target.value)} /></label><label className="full">Reserverad till och med (valfritt)<input type="date" min={new Date().toLocaleDateString('sv-SE')} value={reservationEndDate} onChange={e => setReservationEndDate(e.target.value)} /><small className="muted">Ansvarig säljare får en pushpåminnelse två dagar före slutdatumet.</small></label><button className="primary wide" disabled={saving}>{saving ? 'Sparar…' : 'Spara reservation'}</button>{error && <p className="error">{error}</p>}</form></section></div>}



    {previewPhoto && <div className="photo-lightbox" role="dialog" aria-modal="true" onClick={() => setPreviewPhoto(null)}>
      <button type="button" className="photo-lightbox-close" onClick={() => setPreviewPhoto(null)} aria-label="Stäng bildvisning"><X size={26} /></button>
      <img src={previewPhoto.publicUrl} alt="Förstorad bild på maskinen" onClick={event => event.stopPropagation()} />
      <div className="photo-lightbox-caption">{previewPhoto.is_primary ? 'Huvudbild' : 'Maskinbild'}</div>
    </div>}
    {showEditMachine && selected && <div className="overlay" onClick={() => setShowEditMachine(false)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowEditMachine(false)}><X /></button><p className="eyebrow">REDIGERA MASKIN</p><h2>Ändra maskinuppgifter</h2><form className="machine-form structured-form" onSubmit={updateMachine}>
      <div className="form-section"><h3>Grunduppgifter</h3><div className="form-fields"><label>Artikelkod<input value={form.article_code} readOnly={!!machineTemplateId} onChange={e => setForm({ ...form, article_code: e.target.value })} placeholder="Ex. 116142" /></label><label>Maskinnummer<input value={form.machine_number} onChange={e => setForm({ ...form, machine_number: e.target.value })} /></label><label>Fabrikat<input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} required /></label><label className="full">Modell<input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} required /></label></div></div>
      <div className="form-section"><h3>Maskininformation</h3><div className="form-fields"><label>Årsmodell<input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} /></label><label>Timmar<input type="number" min="0" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} /></label><label className="full">Pris (kr, exkl. moms)<input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label></div></div>
      <div className="form-section"><h3>Beskrivning</h3><label className="full">Information om maskinen<textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label></div>
      <p className="muted">Lagerantal och inkommande leveranser ändras separat under lagerhantering.</p><button className="primary wide" disabled={saving}>{saving ? 'Sparar…' : 'Spara ändringar'}</button>{error && <p className="error">{error}</p>}</form></section></div>}
    {showAdd && <div className="overlay" onClick={() => setShowAdd(false)}><section className="dialog" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowAdd(false)}><X /></button><p className="eyebrow">NY MASKIN</p><h2>Lägg till maskin</h2><form className="machine-form structured-form" onSubmit={addMachine}>
      <div className="form-section"><h3>Välj artikelmodell</h3><p className="muted">Välj en modell i MÖRE:s artikelregister för att lägga till fler exemplar i samma lagerpost. Lämna tomt om du registrerar en ny artikelmodell.</p><label className="full">Artikelmodell i MÖRE:s register<select value={machineTemplateId} onChange={e => applyMachineTemplate(e.target.value)}><option value="">Ny artikelmodell</option>{machines.filter(machine => !machine.is_deleted && machine.article_code).slice().sort((a,b) => `${a.brand || ''} ${a.model || ''}`.localeCompare(`${b.brand || ''} ${b.model || ''}`, 'sv')).map(machine => <option key={machine.id} value={machine.id}>{machine.article_code ? `${machine.article_code} · ` : ''}{[machine.brand, machine.model].filter(Boolean).join(' ')}</option>)}</select></label></div>
      <div className="form-section"><h3>Grunduppgifter</h3><p className="muted">Identifiera maskinen i registret.</p><div className="form-fields"><label>Artikelkod<input value={form.article_code} readOnly={!!machineTemplateId} onChange={e => setForm({ ...form, article_code: e.target.value })} placeholder="Ex. 116142" /></label><label>Maskinnummer<input value={form.machine_number} onChange={e => setForm({ ...form, machine_number: e.target.value })} placeholder="Ex. ER2500T-01" /></label><label>Fabrikat<input value={form.brand} readOnly={!!machineTemplateId} onChange={e => setForm({ ...form, brand: e.target.value })} required placeholder="Tillverkare" /></label><label className="full">Modell<input value={form.model} readOnly={!!machineTemplateId} onChange={e => setForm({ ...form, model: e.target.value })} required placeholder="Modellbeteckning" /></label></div></div>
      <div className="form-section"><h3>Maskininformation</h3><div className="form-fields"><label>Årsmodell<input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} /></label><label>Timmar<input type="number" min="0" value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })} /></label></div></div>
      <div className="form-section"><h3>Pris och lager</h3><div className="form-fields"><label>Pris (kr, exkl. moms)<input type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label><label>{machineTemplateId ? 'Antal att lägga till i lager' : 'Antal i lager'}<input type="number" min="0" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} /></label><div className="full delivery-editor"><strong>Inkommande leveranser</strong><p className="muted">Lägg till varje beställning med eget antal och ETA-vecka.</p>{addDeliveries.map((d, i) => <div className="delivery-row" key={i}><span>{d.quantity} st · {d.eta_year} v{String(d.eta_week).padStart(2, '0')}</span><button type="button" className="text-button" onClick={() => setAddDeliveries(rows => rows.filter((_, index) => index !== i))}>Ta bort</button></div>)}<div className="delivery-add-fields"><label>Antal<input type="number" min="1" value={newDelivery.quantity} onChange={e => setNewDelivery({ ...newDelivery, quantity: e.target.value })} /></label><label>ETA år<input type="number" min="2020" max="2100" value={newDelivery.eta_year} onChange={e => setNewDelivery({ ...newDelivery, eta_year: e.target.value })} /></label><label>Vecka<input type="number" min="1" max="53" value={newDelivery.eta_week} onChange={e => setNewDelivery({ ...newDelivery, eta_week: e.target.value })} /></label></div><button type="button" onClick={() => { const q=Number.parseInt(newDelivery.quantity,10), y=Number.parseInt(newDelivery.eta_year,10), w=Number.parseInt(newDelivery.eta_week,10); if(q>0 && y>=2020 && y<=2100 && w>=1 && w<=53) { setAddDeliveries(rows => [...rows, { quantity:q, eta_year:y, eta_week:w }]); setNewDelivery(emptyDelivery()); } else setError('Ange antal, år och vecka för leveransen.'); }}>+ Lägg till leverans</button></div></div></div>
      <div className="form-section"><h3>Beskrivning</h3><label className="full">Information om maskinen<textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Beskriv skick, utrustning och annan relevant information…" /></label></div>
      <button className="primary wide">Spara maskin</button></form></section></div>}
    </>}
  <style>{`.machine-search-intro{margin:18px 0 9px;color:#f1f1f1}.machine-search-intro strong{display:block;font-size:16px}.machine-search-intro p{margin:4px 0 0;color:#aaa;font-size:13px;line-height:1.45}.machine-search-toolbar{margin:0 0 18px}.machine-search-form{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:stretch;width:100%}.machine-search-form .search{min-width:0}.machine-search-form .search input{width:100%;min-width:0}.machine-search-clear,.machine-search-submit{min-height:46px;padding:10px 16px;border-radius:9px;font-weight:700;white-space:nowrap}.machine-search-clear{border:1px solid #555;background:#242424;color:#eee}.machine-search-submit{min-width:82px}.incoming-customer-card{order:0;margin:0 0 4px;padding:12px 14px}.incoming-delivery-title{order:1}@media(max-width:520px){.machine-search-form{grid-template-columns:minmax(0,1fr) auto auto;gap:6px}.machine-search-clear,.machine-search-submit{padding:9px 11px;font-size:13px;min-height:44px}.machine-search-form .search input{font-size:15px}.incoming-customer-card{margin-bottom:4px}}
.reorder-overview{margin-top:18px}.reorder-needs-list{display:flex;flex-direction:column;gap:10px}.reorder-customer-list{display:flex;flex-direction:column;gap:7px;margin-top:10px}.reorder-customer-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(150px,auto);gap:5px 14px;padding:9px 11px;border:1px solid #3d3d3d;border-radius:9px;background:#191919}.reorder-customer-main{display:flex;flex-direction:column;gap:3px;min-width:0}.reorder-customer-main a{color:inherit;text-decoration:none;font-size:13px}.reorder-customer-order{display:flex;flex-direction:column;gap:2px;text-align:right}.reorder-customer-order span{font-size:10px;letter-spacing:.04em;color:#aaa;text-transform:uppercase}.reorder-customer-order strong{font-size:14px}.reorder-customer-order small,.reorder-customer-card>small,.reorder-customer-card>a{font-size:12px;color:#aaa}.reorder-customer-card>small,.reorder-customer-card>a{grid-column:1/-1}.reorder-need-card{display:flex;justify-content:space-between;align-items:center;gap:14px;padding:14px;border:1px solid #454545;border-radius:12px;background:#202020}.reorder-need-card p{margin:4px 0}.reorder-need-action{display:flex;flex-direction:column;align-items:flex-end;gap:8px;white-space:nowrap}.reorder-need-action>strong{font-size:22px}.reorder-order-block{display:flex;flex-direction:column;gap:7px;align-items:stretch;width:100%}.reorder-order-heading{font-size:16px;color:#fff}.reorder-quantity-label{display:flex;flex-direction:column;gap:5px;font-size:13px;color:#aaa}.reorder-quantity-label input{width:110px;max-width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #555;border-radius:8px;background:#151515;color:#fff;font-size:18px;font-weight:700}.reorder-need-action .secondary{min-height:40px;padding:8px 12px;border:1px solid #555;border-radius:8px;background:#303030;color:#fff}.reorder-need-action button{min-height:40px}@media(max-width:520px){.reorder-customer-card{grid-template-columns:minmax(0,1fr);gap:6px}.reorder-customer-order{text-align:left}.reorder-need-card{align-items:flex-start;flex-direction:column}.reorder-need-action{width:100%;align-items:stretch}.reorder-need-action button{width:100%}.reorder-quantity-label input{width:100%}}.delivery-editor{display:flex;flex-direction:column;gap:10px}.delivery-add-fields{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.delivery-row,.incoming-delivery-title,.receive-delivery-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.delivery-row,.incoming-delivery-card{padding:10px;border:1px solid #3b3b3b;border-radius:10px;margin-top:8px}.incoming-delivery-card{display:flex;flex-direction:column;gap:10px}.incoming-delivery-title .incoming-eta-value{color:#fff;font-weight:600}.incoming-delivery-title .edit-eta-button{white-space:nowrap;font-size:14px;font-weight:700;color:#fff;background:#8f2525;border:1px solid #e02b32;border-radius:8px;padding:9px 12px;min-height:40px}.delivery-eta-edit{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end}.delivery-eta-edit label{display:flex;flex-direction:column;gap:6px;min-width:0}.delivery-eta-edit input{width:100%;min-width:0;box-sizing:border-box}.delivery-eta-edit button{grid-column:1/-1;min-height:42px}.receive-delivery-row label{flex:1}.receive-delivery-row input{width:100%}.icon-button{background:transparent;border:0;color:#aaa;padding:6px}.text-button{background:transparent;border:0;color:#e02b32;padding:4px}.inventory-controls .incoming-deliveries-control{grid-template-columns:minmax(0,1fr);align-items:stretch}.incoming-deliveries-control>*{grid-column:1/-1;min-width:0}.incoming-delivery-card{width:100%;min-width:0;box-sizing:border-box}.delivery-add-fields{grid-template-columns:repeat(3,minmax(0,1fr));align-items:end}.delivery-add-fields label{display:flex;flex-direction:column;gap:6px;min-width:0;overflow-wrap:anywhere}.delivery-add-fields input,.receive-delivery-row input{width:100%;min-width:0;box-sizing:border-box}.incoming-delivery-card>button,.delivery-editor>button{width:100%;min-height:44px}.receive-delivery-row{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}.receive-delivery-row label{min-width:0}.receive-delivery-row .primary{width:100%;min-height:46px}@media(max-width:520px){.inventory-controls .incoming-deliveries-control{grid-template-columns:minmax(0,1fr);padding:12px}.incoming-delivery-card{padding:12px}.incoming-delivery-title{justify-content:flex-start;flex-wrap:wrap}.incoming-delivery-title .incoming-eta-value{font-size:16px}.incoming-delivery-title .edit-eta-button{margin-left:auto;flex:0 0 auto}.incoming-delivery-title strong{white-space:nowrap}.delivery-add-fields{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.delivery-add-fields label{font-size:13px}.delivery-add-fields input{font-size:16px;padding:10px 7px}.receive-delivery-row{grid-template-columns:minmax(0,1fr)}}.incoming-customer-card{display:flex;flex-direction:column;gap:3px;padding:10px 12px;margin:8px 0;border:1px solid var(--border,#444);border-radius:10px;background:rgba(128,128,128,.07);font-size:13px}.incoming-customer-card a{color:inherit;text-decoration:none}.incoming-customer-card span{font-size:12px}.incoming-stock-tag{font-size:11px;padding:3px 7px;border-radius:6px;background:rgba(128,128,128,.14)}.incoming-customer-missing{font-size:12px;margin:6px 0}`}</style>
  </main>;
}


