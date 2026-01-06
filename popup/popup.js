document.addEventListener('DOMContentLoaded', async () => {
  await i18n.init();
  i18n.updateDOM();

  const elements = {
    enableDetection: document.getElementById('enable-detection'),
    autoBlock: document.getElementById('auto-block'),
    sensitivitySlider: document.getElementById('sensitivity-slider'),
    refreshBtn: document.getElementById('refresh-btn'),
    optionsBtn: document.getElementById('options-btn'),
    whitelistInput: document.getElementById('whitelist-username'),
    addWhitelistBtn: document.getElementById('add-whitelist-btn'),
    whitelistList: document.getElementById('whitelist-list'),
    detectedCount: document.getElementById('detected-count'),
    blockedCount: document.getElementById('blocked-count'),
    langZh: document.getElementById('lang-zh'),
    langEn: document.getElementById('lang-en'),
    feedbackLink: document.getElementById('feedback-link')
  };

  let currentSettings = await storage.getSettings();
  let whitelist = await storage.getWhitelist();
  let stats = await storage.getStats();

  function updateUI() {
    elements.enableDetection.checked = currentSettings.enabled;
    elements.autoBlock.checked = currentSettings.autoBlock;
    elements.sensitivitySlider.value = currentSettings.sensitivity;
    elements.detectedCount.textContent = stats.detected || 0;
    elements.blockedCount.textContent = stats.blocked || 0;

    updateLanguageButtons();
    renderWhitelist();
  }

  function updateLanguageButtons() {
    elements.langZh.classList.toggle('active', currentSettings.language === 'zh-CN');
    elements.langEn.classList.toggle('active', currentSettings.language === 'en-US');
  }

  function renderWhitelist() {
    elements.whitelistList.innerHTML = '';
    whitelist.forEach(username => {
      const item = document.createElement('div');
      item.className = 'whitelist-item';
      item.innerHTML = `
        <span class="username">@${username}</span>
        <button class="remove-btn" data-username="${username}">&times;</button>
      `;
      item.querySelector('.remove-btn').addEventListener('click', async () => {
        await storage.removeFromWhitelist(username);
        whitelist = await storage.getWhitelist();
        renderWhitelist();
      });
      elements.whitelistList.appendChild(item);
    });
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

  elements.refreshBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.reload(tab.id);
    }
    window.close();
  });

  elements.optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
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

  elements.langZh.addEventListener('click', async () => {
    if (currentSettings.language !== 'zh-CN') {
      currentSettings.language = 'zh-CN';
      await saveSettings();
      await i18n.changeLanguage('zh-CN');
      updateUI();
    }
  });

  elements.langEn.addEventListener('click', async () => {
    if (currentSettings.language !== 'en-US') {
      currentSettings.language = 'en-US';
      await saveSettings();
      await i18n.changeLanguage('en-US');
      updateUI();
    }
  });

  elements.feedbackLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://github.com' });
  });

  updateUI();
});
