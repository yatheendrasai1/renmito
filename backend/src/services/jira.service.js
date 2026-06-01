const https = require('https');
const UserPreference = require('../models/UserPreference');
const { encrypt, decrypt } = require('../utils/crypto');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAuthHeader(email, encryptedToken) {
  const token = decrypt(encryptedToken);
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

/**
 * Minimal HTTPS request against the JIRA REST API.
 * method: 'GET' | 'POST'. body is optional (for POST, passed as JSON).
 * Returns parsed JSON or throws an error with a .status property.
 */
function jiraRequest(baseUrl, path, authHeader, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method,
      headers:  {
        'Authorization': authHeader,
        'Accept':        'application/json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => (raw += chunk));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(raw)); }
          catch { resolve(raw); }
        } else {
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = null; }
          const errMsg = parsed?.errorMessages?.join('; ') || parsed?.errors ? JSON.stringify(parsed.errors) : raw;
          const err = new Error(errMsg || `JIRA responded with ${res.statusCode}`);
          err.status = res.statusCode;
          err.body = raw;
          reject(err);
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Convenience wrappers kept for readability
const jiraGet  = (baseUrl, path, auth)       => jiraRequest(baseUrl, path, auth, 'GET');
const jiraPost = (baseUrl, path, auth, body) => jiraRequest(baseUrl, path, auth, 'POST', body);

// ── Service functions ─────────────────────────────────────────────────────────

async function saveJiraConfig(userId, { baseUrl, email, apiToken }) {
  const encrypted = encrypt(apiToken);
  const pref = await UserPreference.findOneAndUpdate(
    { userId },
    { $set: { jiraConfig: { baseUrl, email, apiToken: encrypted } } },
    { new: true, upsert: true }
  );
  return { baseUrl: pref.jiraConfig.baseUrl, email: pref.jiraConfig.email };
}

async function getJiraConfig(userId) {
  const pref = await UserPreference.findOne({ userId }, { jiraConfig: 1 });
  if (!pref?.jiraConfig?.apiToken) return null;
  // Never return the raw token — return a masked placeholder
  return {
    baseUrl:  pref.jiraConfig.baseUrl,
    email:    pref.jiraConfig.email,
    apiToken: '••••••••',
  };
}

async function deleteJiraConfig(userId) {
  await UserPreference.findOneAndUpdate(
    { userId },
    { $set: { jiraConfig: null } }
  );
}

async function testJiraConnection(userId) {
  const pref = await UserPreference.findOne({ userId }, { jiraConfig: 1 });
  if (!pref?.jiraConfig?.apiToken) {
    const err = new Error('No JIRA config saved for this account.');
    err.status = 404;
    throw err;
  }
  const { baseUrl, email, apiToken } = pref.jiraConfig;
  const authHeader = makeAuthHeader(email, apiToken);
  const myself = await jiraGet(baseUrl, '/rest/api/3/myself', authHeader);
  return { displayName: myself.displayName, accountId: myself.accountId };
}

/**
 * Extracts plain text from an Atlassian Document Format (ADF) node.
 * JIRA v3 API returns description as ADF; we flatten it to a string.
 */
function adfToText(node) {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) return node.content.map(adfToText).join('');
  return '';
}

/**
 * Runs a user-supplied JQL query against the user's configured JIRA instance.
 * Returns all matching tickets with enriched fields.
 */
async function searchJira(userId, { jql, maxResults = 100 }) {
  if (!jql || !jql.trim()) {
    const err = new Error('jql is required.');
    err.status = 400;
    throw err;
  }

  const pref = await UserPreference.findOne({ userId }, { jiraConfig: 1 });
  if (!pref?.jiraConfig?.apiToken) {
    const err = new Error('No JIRA config saved for this account.');
    err.status = 404;
    throw err;
  }

  const { baseUrl, email, apiToken } = pref.jiraConfig;
  const authHeader = makeAuthHeader(email, apiToken);

  const data = await jiraPost(baseUrl, '/rest/api/3/search/jql', authHeader, {
    jql,
    maxResults: Math.min(Number(maxResults) || 100, 100),
    fields: [
      'summary',
      'status',
      'issuetype',
      'priority',
      'assignee',
      'duedate',
      'description',
      'customfield_10016', // Story Points (classic Scrum boards)
      'customfield_10028', // Story Points (next-gen / team-managed)
      'customfield_10034', // Story Points (some Jira Cloud variants)
      'story_points',
      'customfield_10100', // Customer (common variant)
      'customfield_10046', // Customer Name (common variant)
      'customfield_10060', // Customer (another common variant)
      'customer',
    ],
  });

  return (data.issues || []).map(issue => {
    const f = issue.fields ?? {};
    const storyPoints =
      f.customfield_10016 ??
      f.customfield_10028 ??
      f.customfield_10034 ??
      f.story_points ??
      null;

    const customer =
      f.customfield_10100?.value ?? f.customfield_10100?.displayName ?? f.customfield_10100 ??
      f.customfield_10046?.value ?? f.customfield_10046?.displayName ?? f.customfield_10046 ??
      f.customfield_10060?.value ?? f.customfield_10060?.displayName ?? f.customfield_10060 ??
      f.customer?.value ?? f.customer?.displayName ?? f.customer ??
      null;

    return {
      id:          issue.id,
      key:         issue.key,
      summary:     f.summary ?? '',
      status:      f.status?.name ?? '',
      url:         `${baseUrl.replace(/\/$/, '')}/browse/${issue.key}`,
      assignee:    f.assignee?.displayName ?? null,
      dueDate:     f.duedate ?? null,           // YYYY-MM-DD or null
      storyPoints: storyPoints !== null && storyPoints !== undefined ? Number(storyPoints) : null,
      customer:    typeof customer === 'string' ? customer : null,
    };
  });
}

module.exports = { saveJiraConfig, getJiraConfig, deleteJiraConfig, testJiraConnection, searchJira };
