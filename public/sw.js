// Month-End Njangi — Service Worker
// Cache-first for app shell + polls Supabase every 20s for new chat messages
// and shows native notifications when the app is backgrounded/closed.

const CACHE_NAME = 'njangi-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icon.png'];

const SUPABASE_URL = 'https://cgyisvdjnvfbkuidtigh.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNneWlzdmRqbnZmYmt1aWR0aWdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzcxNTMsImV4cCI6MjA5NjI1MzE1M30.qu2tUJr2o_RpAtv6INdt0jH0bdvOCZBSngjaVHLJAaA';

let lastSeenId = 0;
let pollTimer = null;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
  startPolling();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).catch(() => caches.match('/index.html'))
    )
  );
});

// App tells us the last chat message id it has already seen/shown
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_LAST_SEEN_ID') {
    lastSeenId = event.data.lastSeenId || 0;
  }
});

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(checkForNewMessages, 20000);
  checkForNewMessages();
}

async function checkForNewMessages() {
  try {
    const clientsList = await self.clients.matchAll({ type: 'window' });
    const isVisible = clientsList.some((c) => c.visibilityState === 'visible');
    if (isVisible) return; // don't spam notifications while app is open/foregrounded

    const url = `${SUPABASE_URL}/rest/v1/chat_messages?select=id,sender,message,created_at&order=id.desc&limit=5`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) return;
    const messages = await res.json();
    if (!messages.length) return;

    const newest = messages.filter((m) => m.id > lastSeenId);
    if (newest.length === 0) return;

    lastSeenId = Math.max(...messages.map((m) => m.id));

    // Show a notification for the most recent new message
    const latest = newest.sort((a, b) => b.id - a.id)[0];
    self.registration.showNotification('Njangi Chat', {
      body: `${latest.sender}: ${latest.message || '📷 Photo'}`,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: 'njangi-chat',
      data: { url: '/' }
    });
  } catch (err) {
    // Silent fail — will retry on next poll cycle
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
