document.addEventListener('DOMContentLoaded', async () => {
  await i18n.init();
  i18n.updateDOM();

  const elements = {
    enableDetection: document.getElementById('enable-detection'),
    autoBlock: document.getElementById('auto-block'),
    sensitivitySlider: document.getElementById('sensitivity-slider'),
    langZhBtn: document.getElementById('lang-zh-btn'),
    langEnBtn: document.getElementById('lang-en-btn'),
    whitelistInput: document.getElementById('whitelist-input'),
    addWhitelistBtn: document.getElementById('add-whitelist-btn'),
    whitelistItems: document.getElementById('whitelist-items'),
    blacklistInput: document.getElementById('blacklist-input'),
    addBlacklistBtn: document.getElementById('add-blacklist-btn'),
    blacklistItems: document.getElementById('blacklist-items'),
    totalDetected: document.getElementById('total-detected'),
    totalBlocked: document.getElementById('total-blocked'),
    resetStatsBtn: document.getElementById('reset-stats-btn'),
    feedbackLink: document.getElementById('feedback-link')
  };

  let currentSettings = await storage.getSettings();
  let whitelist = await storage.getWhitelist();
  let blacklist = await storage.getBlacklist();
  let stats = await storage.getStats();

  function updateUI() {
    elements.enableDetection.checked = currentSettings.enabled;
    elements.autoBlock.checked = currentSettings.autoBlock;
    elements.sensitivitySlider.value = currentSettings.sensitivity;
    elements.totalDetected.textContent = stats.detected || 0;
    elements.totalBlocked.textContent = stats.blocked || 0;

    elements.langZhBtn.classList.toggle('active', currentSettings.language === 'zh-CN');
    elements.langEnBtn.classList.toggle('active', currentSettings.language === 'en-US');

    renderWhitelist();
    renderBlacklist();
  }

  function renderWhitelist() {
    elements.whitelistItems.innerHTML = '';
    whitelist.forEach(username => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <span class="username">@${username}</span>
        <div class="actions">
          <button class="action-btn remove-btn" data-username="${username}" data-i18n="remove">移除</button>
        </div>
      `;
      item.querySelector('.remove-btn').addEventListener('click', async () => {
        await storage.removeFromWhitelist(username);
        whitelist = await storage.getWhitelist();
        renderWhitelist();
      });
      elements.whitelistItems.appendChild(item);
    });
    i18n.updateDOM();
  }

  function renderBlacklist() {
    elements.blacklistItems.innerHTML = '';
    blacklist.forEach(item => {
      const div = document.createElement('div');
      div.className = 'list-item';
      div.innerHTML = `
        <span class="username">@${item.username}</span>
        <div class="actions">
          <button class="action-btn remove-btn" data-username="${item.username}" data-i18n="remove">移除</button>
        </div>
      `;
      div.querySelector('.remove-btn').addEventListener('click', async () => {
        await storage.removeFromBlacklist(item.username);
        blacklist = await storage.getBlacklist();
        renderBlacklist();
      });
      elements.blacklistItems.appendChild(div);
    });
    i18n.updateDOM();
  }

  async function saveSettings() {
    await storage.saveSettings(currentSettings);
  }

  elements.enableDetection.addEventListener('change', async () => {
    currentSettings.enabled = elements.enableDetection.checked;
    await saveSettings();
  });

  elements.autoBlock.addEventListener('change', async () => {
    currentSettings.autoBlock = elements.autoBlock.checked;
    await saveSettings();
  });

  elements.sensitivitySlider.addEventListener('input', async () => {
    currentSettings.sensitivity = parseInt(elements.sensitivitySlider.value);
    await saveSettings();
  });

  elements.langZhBtn.addEventListener('click', async () => {
    if (currentSettings.language !== 'zh-CN') {
      currentSettings.language = 'zh-CN';
      await saveSettings();
      await i18n.changeLanguage('zh-CN');
      updateUI();
    }
  });

  elements.langEnBtn.addEventListener('click', async () => {
    if (currentSettings.language !== 'en-US') {
      currentSettings.language = 'en-US';
      await saveSettings();
      await i18n.changeLanguage('en-US');
      updateUI();
    }
  });

  elements.addWhitelistBtn.addEventListener('click', async () => {
    const username = elements.whitelistInput.value.trim();
    if (username) {
      await storage.addToWhitelist(username);
      whitelist = await storage.getWhitelist();
      renderWhitelist();
      elements.whitelistInput.value = '';
    }
  });

  elements.whitelistInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const username = elements.whitelistInput.value.trim();
      if (username) {
        await storage.addToWhitelist(username);
        whitelist = await storage.getWhitelist();
        renderWhitelist();
        elements.whitelistInput.value = '';
      }
    }
  });

  elements.addBlacklistBtn.addEventListener('click', async () => {
    const username = elements.blacklistInput.value.trim();
    if (username) {
      await storage.addToBlacklist(username, '手动添加');
      blacklist = await storage.getBlacklist();
      renderBlacklist();
      elements.blacklistInput.value = '';
    }
  });

  elements.blacklistInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const username = elements.blacklistInput.value.trim();
      if (username) {
        await storage.addToBlacklist(username, '手动添加');
        blacklist = await storage.getBlacklist();
        renderBlacklist();
        elements.blacklistInput.value = '';
      }
    }
  });

  elements.resetStatsBtn.addEventListener('click', async () => {
    stats = { detected: 0, blocked: 0, lastReset: Date.now() };
    await chrome.storage.local.set({ aihunter_stats: stats });
    updateUI();
  });

  elements.feedbackLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com' });
  });

  updateUI();
});
