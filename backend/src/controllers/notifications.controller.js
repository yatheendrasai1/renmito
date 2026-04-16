const config  = require('../config');
const svc     = require('../services/notifications.service');

/** GET /api/notifications/vapid-public-key — returns VAPID public key (no auth needed) */
async function getVapidPublicKey(req, res) {
  if (!config.vapid.publicKey) {
    return res.status(503).json({ error: 'Push notifications not configured' });
  }
  res.json({ publicKey: config.vapid.publicKey });
}

/** POST /api/notifications/subscribe — save push subscription for logged-in user */
async function subscribe(req, res) {
  const { subscription } = req.body;  // { endpoint, keys: { p256dh, auth } }
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' });
  }
  try {
    await svc.saveSubscription(req.userId, subscription);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('[notifications] subscribe error:', err.message);
    res.status(500).json({ error: 'Could not save subscription' });
  }
}

/** DELETE /api/notifications/subscribe — remove push subscription */
async function unsubscribe(req, res) {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  try {
    await svc.removeSubscription(req.userId, endpoint);
    res.json({ ok: true });
  } catch (err) {
    console.error('[notifications] unsubscribe error:', err.message);
    res.status(500).json({ error: 'Could not remove subscription' });
  }
}

/** POST /api/notifications/cron — called by Vercel Cron every 30 minutes */
async function cronTrigger(req, res) {
  // Verify cron secret (skip check if no secret configured in dev)
  const secret = config.cron.secret;
  if (secret) {
    const provided = req.query.secret || req.headers['x-cron-secret'];
    if (provided !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    const result = await svc.sendScheduledNotifications();
    console.log('[notifications] cron result:', result);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[notifications] cron error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

/** POST /api/notifications/test — sends an immediate test push to the logged-in user */
async function testNotification(req, res) {
  try {
    const result = await svc.sendTestNotification(req.userId);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[notifications] test error:', err.message);
    const status = err.message.includes('No subscription') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
}

module.exports = { getVapidPublicKey, subscribe, unsubscribe, cronTrigger, testNotification };
