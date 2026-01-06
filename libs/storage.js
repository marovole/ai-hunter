class StorageManager {
  constructor() {
    this.prefix = 'aihunter_';
  }

  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.prefix + 'settings'], (result) => {
        resolve(result[this.prefix + 'settings'] || this.getDefaultSettings());
      });
    });
  }

  async saveSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        [this.prefix + 'settings']: settings
      }, resolve);
    });
  }

  getDefaultSettings() {
    return {
      enabled: true,
      autoBlock: true,
      sensitivity: 3,
      language: 'zh-CN',
      showConfidence: true,
      blockMode: 'ask'
    };
  }

  async addToBlacklist(username, reason = '') {
    return new Promise((resolve) => {
      const key = this.prefix + 'blacklist';
      chrome.storage.local.get([key], (result) => {
        const blacklist = result[key] || [];
        if (!blacklist.find(item => item.username === username)) {
          blacklist.push({
            username: username.toLowerCase(),
            addedAt: Date.now(),
            reason: reason
          });
          chrome.storage.local.set({ [key]: blacklist }, resolve);
        }
      });
    });
  }

  async removeFromBlacklist(username) {
    return new Promise((resolve) => {
      const key = this.prefix + 'blacklist';
      chrome.storage.local.get([key], (result) => {
        const blacklist = result[key] || [];
        const newBlacklist = blacklist.filter(item => item.username !== username.toLowerCase());
        chrome.storage.local.set({ [key]: newBlacklist }, resolve);
      });
    });
  }

  async getBlacklist() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.prefix + 'blacklist'], (result) => {
        resolve(result[this.prefix + 'blacklist'] || []);
      });
    });
  }

  async addToWhitelist(username) {
    return new Promise((resolve) => {
      const key = this.prefix + 'whitelist';
      chrome.storage.local.get([key], (result) => {
        const whitelist = result[key] || [];
        const normalizedUsername = username.toLowerCase().replace('@', '');
        if (!whitelist.includes(normalizedUsername)) {
          whitelist.push(normalizedUsername);
          chrome.storage.local.set({ [key]: whitelist }, resolve);
        }
      });
    });
  }

  async removeFromWhitelist(username) {
    return new Promise((resolve) => {
      const key = this.prefix + 'whitelist';
      chrome.storage.local.get([key], (result) => {
        const whitelist = result[key] || [];
        const normalizedUsername = username.toLowerCase().replace('@', '');
        const newWhitelist = whitelist.filter(u => u !== normalizedUsername);
        chrome.storage.local.set({ [key]: newWhitelist }, resolve);
      });
    });
  }

  async getWhitelist() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.prefix + 'whitelist'], (result) => {
        resolve(result[this.prefix + 'whitelist'] || []);
      });
    });
  }

  async getStats() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.prefix + 'stats'], (result) => {
        resolve(result[this.prefix + 'stats'] || {
          detected: 0,
          blocked: 0,
          lastReset: Date.now()
        });
      });
    });
  }

  async incrementStat(statName) {
    return new Promise((resolve) => {
      const key = this.prefix + 'stats';
      chrome.storage.local.get([key], (result) => {
        const stats = result[key] || { detected: 0, blocked: 0, lastReset: Date.now() };
        stats[statName] = (stats[statName] || 0) + 1;
        chrome.storage.local.set({ [key]: stats }, resolve);
      });
    });
  }

  async isInWhitelist(username) {
    const whitelist = await this.getWhitelist();
    const normalizedUsername = username.toLowerCase().replace('@', '');
    return whitelist.includes(normalizedUsername);
  }

  async isInBlacklist(username) {
    const blacklist = await this.getBlacklist();
    const normalizedUsername = username.toLowerCase().replace('@', '');
    return blacklist.some(item => item.username === normalizedUsername);
  }
}

const storage = new StorageManager();
