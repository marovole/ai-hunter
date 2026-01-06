class GitHubSync {
  constructor() {
    this.repo = 'ai-hunter/blacklist';
    this.filePath = 'ai-accounts.json';
    this.lastSync = null;
  }

  async fetchOfficialBlacklist() {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.repo}/contents/${this.filePath}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('获取黑名单失败');
      }

      const data = await response.json();
      const content = atob(data.content);
      const blacklist = JSON.parse(content);

      await chrome.storage.local.set({
        'aihunter_official_blacklist': blacklist,
        'aihunter_last_sync': Date.now()
      });

      return blacklist;
    } catch (error) {
      console.error('GitHub同步失败:', error);
      const cached = await chrome.storage.local.get('aihunter_official_blacklist');
      return cached.aihunter_official_blacklist || [];
    }
  }

  async shouldSync() {
    const lastSync = await chrome.storage.local.get('aihunter_last_sync');
    const lastSyncTime = lastSync.aihunter_last_sync || 0;
    const now = Date.now();
    return (now - lastSyncTime) > 6 * 60 * 60 * 1000;
  }

  async initSync() {
    if (await this.shouldSync()) {
      await this.fetchOfficialBlacklist();
    }

    chrome.alarms.create('sync_blacklist', { delayInMinutes: 60, periodInMinutes: 360 });
  }

  async getLastSyncTime() {
    const result = await chrome.storage.local.get('aihunter_last_sync');
    return result.aihunter_last_sync || 0;
  }
}

const githubSync = new GitHubSync();
