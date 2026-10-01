const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
let store;

function configurePush(data, save) {
  data.pushTokens ||= [];
  store = { data, save };
}

function registerPushToken(ownerType, ownerId, token, platform) {
  if (!store) throw new Error('Push service is not ready.');
  const { data, save } = store;
  // A device can move between accounts; never keep its previous owner's registration.
  data.pushTokens = data.pushTokens.filter((item) => item.token !== token);
  data.pushTokens.push({ ownerType, ownerId, token, platform, updatedAt: new Date().toISOString() });
  save();
}

function removePushToken(ownerType, ownerId, token) {
  if (!store) return;
  const { data, save } = store;
  data.pushTokens = data.pushTokens.filter((item) => !(item.ownerType === ownerType && item.ownerId === ownerId && item.token === token));
  save();
}

async function pushTo(ownerType, ownerId, title, body, extra = {}) {
  if (!store || !ownerId) return;
  const tokens = store.data.pushTokens.filter((item) => item.ownerType === ownerType && item.ownerId === ownerId);
  if (!tokens.length) return;
  const messages = tokens.map((item) => ({ to: item.token, title, body, sound: 'default', priority: 'high', channelId: 'clearance-updates', data: { role: ownerType, ...extra } }));
  for (let start = 0; start < messages.length; start += 100) {
    const chunk = messages.slice(start, start + 100);
    try {
      const response = await fetch(EXPO_PUSH_URL, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(chunk), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Expo push service returned ${response.status}`);
      const tickets = (await response.json()).data || [];
      const invalid = new Set(tickets.flatMap((ticket, index) => ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered' ? [chunk[index].to] : []));
      if (invalid.size) { store.data.pushTokens = store.data.pushTokens.filter((item) => !invalid.has(item.token)); store.save(); }
      tickets.forEach((ticket) => { if (ticket.status === 'error' && ticket.details?.error !== 'DeviceNotRegistered') console.error(`Push delivery failed: ${ticket.details?.error || ticket.message}`); });
    } catch (error) { console.error(`Push delivery failed: ${error.message}`); }
  }
}

module.exports = { configurePush, registerPushToken, removePushToken, pushTo };
