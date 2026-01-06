// AI Hunter - Background Service Worker

importScripts('libs/twitter-api.js');

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[AI Hunter] 插件已安装/更新:', details.reason);

  await initializeStorage();
  await initializeAlarms();
});

async function initializeStorage() {
  const defaultSettings = {
    enabled: true,
    autoBlock: true,
    sensitivity: 3,
    language: 'zh-CN',
    showConfidence: true,
    blockMode: 'ask'
  };

  const existingSettings = await chrome.storage.local.get('aihunter_settings');
  if (!existingSettings.aihunter_settings) {
    await chrome.storage.local.set({ aihunter_settings: defaultSettings });
  }

  const existingStats = await chrome.storage.local.get('aihunter_stats');
  if (!existingStats.aihunter_stats) {
    await chrome.storage.local.set({
      aihunter_stats: {
        detected: 0,
        blocked: 0,
        lastReset: Date.now()
      }
    });
  }
}

async function initializeAlarms() {
  chrome.alarms.create('sync_blacklist', {
    delayInMinutes: 60,
    periodInMinutes: 360
  });

  chrome.alarms.create('cleanup_marks', {
    delayInMinutes: 5,
    periodInMinutes: 30
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sync_blacklist') {
    await syncBlacklist();
  } else if (alarm.name === 'cleanup_marks') {
    await cleanupMarkedAccounts();
  }
});

async function syncBlacklist() {
  try {
    const response = await fetch(
      'https://api.github.com/repos/ai-hunter/blacklist/contents/ai-accounts.json',
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      const content = atob(data.content);
      const officialBlacklist = JSON.parse(content);

      await chrome.storage.local.set({
        aihunter_official_blacklist: officialBlacklist,
        aihunter_last_sync: Date.now()
      });

      console.log('[AI Hunter] 黑名单同步成功, 数量:', officialBlacklist.length);
    }
  } catch (error) {
    console.error('[AI Hunter] 黑名单同步失败:', error);
  }
}

async function cleanupMarkedAccounts() {
  const tabs = await chrome.tabs.query({ url: ['https://twitter.com/*', 'https://x.com/*'] });

  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'CLEANUP_MARKS' });
    } catch (error) {
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'GET_SETTINGS':
        const settings = await chrome.storage.local.get('aihunter_settings');
        sendResponse(settings.aihunter_settings);
        break;

      case 'UPDATE_SETTINGS':
        await chrome.storage.local.set({ aihunter_settings: message.settings });
        sendResponse({ success: true });
        break;

      case 'GET_STATS':
        const stats = await chrome.storage.local.get('aihunter_stats');
        sendResponse(stats.aihunter_stats || { detected: 0, blocked: 0 });
        break;

      case 'INCREMENT_STAT':
        const key = `aihunter_${message.stat}`;
        const current = await chrome.storage.local.get(key);
        const currentValue = current[key] || 0;
        await chrome.storage.local.set({ [key]: currentValue + 1 });
        sendResponse({ success: true });
        break;

      case 'BLOCK_USER':
        try {
          await twitterAPI.blockUser(message.username);
          sendResponse({ success: true });
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
        break;

      case 'GET_BLACKLIST':
        const blacklist = await chrome.storage.local.get('aihunter_blacklist');
        sendResponse(blacklist.aihunter_blacklist || []);
        break;

      case 'ADD_TO_BLACKLIST':
        const existingBlacklist = await chrome.storage.local.get('aihunter_blacklist');
        const bl = existingBlacklist.aihunter_blacklist || [];
        if (!bl.find(item => item.username === message.username)) {
          bl.push({
            username: message.username.toLowerCase(),
            addedAt: Date.now(),
            reason: message.reason || ''
          });
          await chrome.storage.local.set({ aihunter_blacklist: bl });
        }
        sendResponse({ success: true });
        break;

      case 'REMOVE_FROM_BLACKLIST':
        const blResult = await chrome.storage.local.get('aihunter_blacklist');
        const blacklistToUpdate = blResult.aihunter_blacklist || [];
        const newBlacklist = blacklistToUpdate.filter(
          item => item.username !== message.username.toLowerCase()
        );
        await chrome.storage.local.set({ aihunter_blacklist: newBlacklist });
        sendResponse({ success: true });
        break;

      case 'GET_WHITELIST':
        const whitelist = await chrome.storage.local.get('aihunter_whitelist');
        sendResponse(whitelist.aihunter_whitelist || []);
        break;

      case 'ADD_TO_WHITELIST':
        const existingWhitelist = await chrome.storage.local.get('aihunter_whitelist');
        const wl = existingWhitelist.aihunter_whitelist || [];
        const normalizedUsername = message.username.toLowerCase().replace('@', '');
        if (!wl.includes(normalizedUsername)) {
          wl.push(normalizedUsername);
          await chrome.storage.local.set({ aihunter_whitelist: wl });
        }
        sendResponse({ success: true });
        break;

      case 'REMOVE_FROM_WHITELIST':
        const wlResult = await chrome.storage.local.get('aihunter_whitelist');
        const whitelistToUpdate = wlResult.aihunter_whitelist || [];
        const normalizedRemove = message.username.toLowerCase().replace('@', '');
        const newWhitelist = whitelistToUpdate.filter(u => u !== normalizedRemove);
        await chrome.storage.local.set({ aihunter_whitelist: newWhitelist });
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();

  return true;
});

console.log('[AI Hunter] Background service worker 已启动');
