const webpush          = require('web-push');
const config           = require('../config');
const PushSubscription = require('../models/PushSubscription');
const User             = require('../models/User');

// Notification slots: HH:MM in 24-hour format
const NOTIFICATION_SLOTS = ['09:00', '13:30', '17:30', '20:30'];

const SLOT_MESSAGES = {
  '09:00': { title: 'Renmito — Morning',   body: 'Good morning — start logging your day' },
  '13:30': { title: 'Renmito — Afternoon', body: 'Afternoon check-in — log your midday' },
  '17:30': { title: 'Renmito — Evening',   body: 'Evening check-in — wrap up the afternoon' },
  '20:30': { title: 'Renmito — Night',     body: 'Night wrap-up — close out your day' }
};

function initVapid() {
  if (!config.vapid.publicKey || !config.vapid.privateKey) return false;
  webpush.setVapidDetails(
    config.vapid.subject,
    config.vapid.publicKey,
    config.vapid.privateKey
  );
  return true;
}

/** Returns HH:MM for a given Date in a given IANA timezone */
function currentHHMM(date, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour:     '2-digit',
      minute:   '2-digit',
      hour12:   false
    }).formatToParts(date);

    const h = parts.find(p => p.type === 'hour')?.value   ?? '00';
    const m = parts.find(p => p.type === 'minute')?.value ?? '00';
    // Normalize "24:xx" → "00:xx" (some locales emit 24 instead of 0)
    return `${h === '24' ? '00' : h}:${m}`;
  } catch {
    return null;
  }
}

/**
 * Called by the cron endpoint every 30 minutes.
 * Sends push notifications to users whose local time matches a slot.
 */
async function sendScheduledNotifications() {
  if (!initVapid()) {
    console.warn('[notifications] VAPID keys not configured — skipping');
    return { sent: 0, errors: 0 };
  }

  const subscriptions = await PushSubscription.find().lean();
  if (subscriptions.length === 0) return { sent: 0, errors: 0 };

  // Build userId → timezone map
  const userIds = [...new Set(subscriptions.map(s => String(s.userId)))];
  const users   = await User.find({ _id: { $in: userIds } }, 'timezone').lean();
  const tzMap   = Object.fromEntries(users.map(u => [String(u._id), u.timezone || 'UTC']));

  const now = new Date();
  let sent = 0, errors = 0;

  for (const sub of subscriptions) {
    const tz     = tzMap[String(sub.userId)] || 'UTC';
    const hhmm   = currentHHMM(now, tz);
    const msg    = hhmm ? SLOT_MESSAGES[hhmm] : null;
    if (!msg) continue;

    const payload = JSON.stringify({
      title: msg.title,
      body:  msg.body,
      url:   '/'
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      );
      sent++;
    } catch (err) {
      errors++;
      // 410 Gone / 404 → subscription is expired, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await PushSubscription.deleteOne({ _id: sub._id });
        console.log('[notifications] Removed expired subscription:', sub.endpoint.slice(-20));
      } else {
        console.error('[notifications] Send error:', err.message);
      }
    }
  }

  return { sent, errors };
}

/**
 * Sends an immediate test notification to all subscriptions of a single user.
 */
async function sendTestNotification(userId) {
  if (!initVapid()) throw new Error('VAPID keys not configured');

  const subscriptions = await PushSubscription.find({ userId }).lean();
  if (subscriptions.length === 0) throw new Error('No subscription found for this device');

  const payload = JSON.stringify({
    title: 'Renmito — Test',
    body:  'Notifications are working on this device',
    url:   '/'
  });

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      const result = await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
      console.log('[notifications] FCM accepted push — status:', result.statusCode, 'endpoint:', sub.endpoint.slice(-30));
      sent++;
    } catch (err) {
      console.error('[notifications] FCM rejected push — status:', err.statusCode, 'body:', err.body);
      if (err.statusCode === 410 || err.statusCode === 404) {
        await PushSubscription.deleteOne({ _id: sub._id });
      } else {
        throw err;
      }
    }
  }
  return { sent };
}

async function saveSubscription(userId, subscription) {
  const { endpoint, keys } = subscription;
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { userId, endpoint, keys },
    { upsert: true, new: true }
  );
}

async function removeSubscription(userId, endpoint) {
  await PushSubscription.deleteOne({ userId, endpoint });
}

async function getSubscriptionForUser(userId, endpoint) {
  return PushSubscription.findOne({ userId, endpoint }).lean();
}

module.exports = {
  sendScheduledNotifications,
  sendTestNotification,
  saveSubscription,
  removeSubscription,
  getSubscriptionForUser,
  NOTIFICATION_SLOTS
};
