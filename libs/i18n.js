class I18nManager {
  constructor() {
    this.currentLang = 'zh-CN';
    this.translations = {};
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      const settings = await this.getSettings();
      this.currentLang = settings.language || 'zh-CN';
      await this.loadTranslations(this.currentLang);
      this.initialized = true;
    } catch (error) {
      console.error('I18n init error:', error);
      await this.loadTranslations('zh-CN');
    }
  }

  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['aihunter_settings'], (result) => {
        resolve(result.aihunter_settings || this.getDefaultSettings());
      });
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

  async loadTranslations(lang) {
    try {
      const response = await fetch(chrome.runtime.getURL(`locales/${lang}.json`));
      if (response.ok) {
        this.translations = await response.json();
      } else {
        throw new Error('Failed to load translations');
      }
    } catch (error) {
      console.error('Loading translations failed, using zh-CN:', error);
      try {
        const response = await fetch(chrome.runtime.getURL('locales/zh-CN.json'));
        if (response.ok) {
          this.translations = await response.json();
        }
      } catch (e) {
        this.translations = this.getFallbackTranslations();
      }
    }
  }

  getFallbackTranslations() {
    return {
      title: "AI Hunter",
      detected: "已检测",
      blocked: "已屏蔽",
      control_title: "检测控制",
      enable_detection: "启用检测",
      auto_block: "自动屏蔽高风险账号",
      sensitivity: "检测灵敏度",
      low: "低",
      medium: "中",
      high: "高",
      refresh: "刷新页面",
      settings: "高级设置",
      whitelist_title: "本地白名单",
      add_whitelist: "添加白名单",
      version: "v1.0.0",
      feedback: "反馈",
      detected_count: "已检测",
      blocked_count: "已屏蔽",
      sensitivity_label: "检测灵敏度",
      refresh_label: "刷新页面",
      settings_label: "高级设置",
      whitelist_placeholder: "@username",
      add_btn: "添加",
      high_risk: "高风险",
      possible: "可能",
      low_risk: "低风险",
      block: "屏蔽",
      blocked_success: "已屏蔽"
    };
  }

  t(key) {
    return this.translations[key] || key;
  }

  async changeLanguage(lang) {
    this.currentLang = lang;
    await this.loadTranslations(lang);
    this.updateDOM();
  }

  updateDOM() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        if (!element.value || element.dataset.i18nPlaceholder) {
          element.placeholder = this.t(key);
        }
      } else {
        element.textContent = this.t(key);
      }
    });
  }
}

const i18n = new I18nManager();
