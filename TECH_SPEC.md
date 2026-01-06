# AI Hunter 技术实现方案

## 项目概述

**名称**: AI Hunter
**目标**: 检测并标记Twitter/X上的AI生成账号
**类型**: Chrome浏览器插件
**技术栈**: Manifest V3 + 原生JavaScript + Chrome Extension APIs

---

## 1. 技术架构总览

### 技术栈
```
前端插件:
├── Manifest V3 (Chrome Extension)
├── 原生JavaScript (ES2020+)
├── CSS3 (无外部依赖)
└── Chrome Extension APIs

数据存储:
├── chrome.storage.local (本地存储)
├── chrome.storage.sync (跨设备同步 - 未来)
└── chrome.cookies (复用Twitter会话)

构建工具:
└── 无需打包，直接加载开发版
```

### 核心架构图
```
┌─────────────────────────────────────────┐
│           AI Hunter 插件                │
├─────────────────────────────────────────┤
│  UI 层                                  │
│  ├── popup/        (设置弹窗)           │
│  ├── options/      (设置页面)           │
│  └── content/      (页面注入脚本)        │
├─────────────────────────────────────────┤
│  核心引擎                               │
│  ├── detector.js   (检测引擎)           │
│  ├── twitter-api.js (Twitter API封装)    │
│  ├── storage.js     (数据存储)           │
│  └── i18n.js       (国际化)              │
├─────────────────────────────────────────┤
│  数据层                                 │
│  ├── 本地黑名单 (local)                 │
│  ├── 本地白名单 (whitelist)             │
│  └── GitHub官方黑名单 (同步)            │
└─────────────────────────────────────────┘
```

---

## 2. 文件结构设计

```
ai-hunter/
├── manifest.json              # 插件清单文件
├── icons/                     # 图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── background.js              # Service Worker后台脚本
├── popup/                     # 弹窗UI
│   ├── popup.html
│   ├── popup.css
│   ├── popup.js
│   └── i18n/
│       ├── popup-zh-CN.json
│       └── popup-en-US.json
├── options/                   # 设置页面
│   ├── options.html
│   ├── options.css
│   ├── options.js
│   └── i18n/
│       ├── options-zh-CN.json
│       └── options-en-US.json
├── content/                   # 页面注入脚本
│   ├── content.js
│   ├── inject.js
│   ├── twitter-selector.js
│   └── styles/
│       └── ai-marker.css
├── libs/                      # 核心库
│   ├── detector.js            # AI检测引擎
│   ├── rule-engine.js         # 规则引擎
│   ├── twitter-api.js        # Twitter API封装
│   ├── storage.js             # 数据存储管理
│   ├── github-sync.js         # GitHub黑名单同步
│   └── i18n.js                # 国际化
├── rules/                     # 检测规则
│   ├── keywords.json         # 关键词规则
│   ├── patterns.json          # 模式匹配规则
│   ├── frequency.json         # 频率规则
│   └── metadata.json          # 元数据规则
├── locales/                   # 通用国际化
│   ├── zh-CN.json
│   └── en-US.json
└── docs/                      # 文档
    ├── README.md
    └── CHANGELOG.md
```

---

## 3. 核心模块设计

### 3.1 manifest.json 配置

```json
{
  "manifest_version": 3,
  "name": "AI Hunter - Detect AI Twitter Accounts",
  "version": "1.0.0",
  "description": "Detect and mark AI-generated Twitter accounts automatically",
  "permissions": [
    "storage",
    "cookies",
    "activeTab",
    "scripting",
    "alarms"
  ],
  "host_permissions": [
    "https://twitter.com/*",
    "https://x.com/*",
    "https://api.github.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "AI Hunter",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_page": "options/options.html",
  "content_scripts": [
    {
      "matches": [
        "https://twitter.com/*",
        "https://x.com/*"
      ],
      "js": [
        "content/content.js"
      ],
      "css": [
        "content/styles/ai-marker.css"
      ],
      "run_at": "document_end"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### 3.2 检测规则引擎设计

#### 规则配置结构

**rules/keywords.json - 关键词检测**
```json
{
  "bio_keywords": [
    "I am an AI",
    "artificial intelligence",
    "AI assistant",
    "I'm a bot",
    "chatbot",
    "language model"
  ],
  "username_patterns": [
    "^bot_",
    "_bot$",
    "^ai_",
    "_ai$"
  ],
  "weight": 0.7
}
```

**rules/frequency.json - 频率检测**
```json
{
  "max_tweets_per_hour": 50,
  "max_tweets_per_day": 200,
  "active_24_7_threshold": 0.9,
  "weight": 0.8
}
```

**rules/metadata.json - 元数据检测**
```json
{
  "low_followers_threshold": 100,
  "followers_following_ratio": 0.1,
  "no_avatar_weight": 0.3,
  "no_bio_weight": 0.4,
  "new_account_threshold_days": 30,
  "weight": 0.6
}
```

**rules/patterns.json - 内容模式检测**
```json
{
  "repetitive_phrases": [
    "As an AI",
    "I don't have personal",
    "I'm here to help",
    "artificial intelligence"
  ],
  "template_indicators": [
    "Based on my training",
    "My knowledge cutoff",
    "I was trained by"
  ],
  "weight": 0.5
}
```

#### 置信度计算算法

**libs/detector.js**
```javascript
class AIDetector {
  constructor() {
    this.rules = this.loadRules();
  }

  async detectAccount(accountData) {
    let confidence = 0;
    let reasons = [];

    // 1. 关键词检测 (30%)
    const keywordScore = this.checkKeywords(accountData);
    if (keywordScore > 0) {
      confidence += keywordScore * 0.3;
      reasons.push(`Bio/用户名包含AI相关关键词`);
    }

    // 2. 频率检测 (25%)
    const frequencyScore = this.checkFrequency(accountData);
    if (frequencyScore > 0) {
      confidence += frequencyScore * 0.25;
      reasons.push(`发帖频率异常`);
    }

    // 3. 元数据检测 (25%)
    const metadataScore = this.checkMetadata(accountData);
    if (metadataScore > 0) {
      confidence += metadataScore * 0.25;
      reasons.push(`账号元数据异常`);
    }

    // 4. 内容模式检测 (20%)
    const patternScore = this.checkPatterns(accountData);
    if (patternScore > 0) {
      confidence += patternScore * 0.2;
      reasons.push(`内容模式类似AI生成`);
    }

    // 5. 黑名单检查 (强制100%)
    const blacklistScore = this.checkBlacklist(accountData);
    if (blacklistScore > 0) {
      confidence = 1.0;
      reasons.push(`在官方黑名单中`);
    }

    // 6. 白名单检查 (强制0%)
    const whitelistScore = this.checkWhitelist(accountData);
    if (whitelistScore) {
      confidence = 0;
      reasons = [];
    }

    return {
      confidence: Math.min(confidence, 1.0),
      level: this.getConfidenceLevel(confidence),
      reasons: reasons
    };
  }

  getConfidenceLevel(confidence) {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.5) return 'medium';
    if (confidence >= 0.2) return 'low';
    return 'none';
  }
}
```

---

## 4. UI界面设计

### 4.1 Popup 弹窗设计

**popup/popup.html**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Hunter</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <header>
      <img src="../icons/icon48.png" alt="AI Hunter">
      <h1 id="title">AI Hunter</h1>
      <div class="language-switcher">
        <button id="lang-zh">中文</button>
        <button id="lang-en">EN</button>
      </div>
    </header>

    <div class="stats-section">
      <div class="stat-item">
        <span id="detected-count">0</span>
        <label id="detected-label">已检测</label>
      </div>
      <div class="stat-item">
        <span id="blocked-count">0</span>
        <label id="blocked-label">已屏蔽</label>
      </div>
    </div>

    <div class="control-section">
      <h3 id="control-title">检测控制</h3>

      <div class="toggle-item">
        <label class="switch">
          <input type="checkbox" id="enable-detection" checked>
          <span class="slider"></span>
        </label>
        <span id="enable-label">启用检测</span>
      </div>

      <div class="toggle-item">
        <label class="switch">
          <input type="checkbox" id="auto-block" checked>
          <span class="slider"></span>
        </label>
        <span id="autoblock-label">自动屏蔽高风险账号</span>
      </div>

      <div class="sensitivity-section">
        <label id="sensitivity-label">检测灵敏度</label>
        <input type="range" id="sensitivity-slider" min="1" max="5" value="3">
        <div class="sensitivity-labels">
          <span id="sensitivity-low">低</span>
          <span id="sensitivity-medium">中</span>
          <span id="sensitivity-high">高</span>
        </div>
      </div>
    </div>

    <div class="action-section">
      <button id="refresh-btn" class="btn-primary">
        <span id="refresh-label">刷新页面</span>
      </button>
      <button id="options-btn" class="btn-secondary">
        <span id="settings-label">高级设置</span>
      </button>
    </div>

    <div class="whitelist-section">
      <h3 id="whitelist-title">本地白名单</h3>
      <div class="whitelist-input">
        <input type="text" id="whitelist-username" placeholder="@username">
        <button id="add-whitelist-btn" class="btn-small">+</button>
      </div>
      <div id="whitelist-list"></div>
    </div>

    <footer>
      <span id="version">v1.0.0</span>
      <a href="#" id="feedback-link">反馈</a>
    </footer>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

### 4.2 头像标记样式

**content/styles/ai-marker.css**
```css
/* 红色边框 - AI账号标记 */
.ai-marked-account img[src*="profile_images"] {
  border: 3px solid #ff4444 !important;
  border-radius: 50% !important;
  box-shadow: 0 0 10px rgba(255, 68, 68, 0.5) !important;
  position: relative;
}

/* 置信度角标 */
.ai-marked-account::after {
  content: attr(data-confidence);
  position: absolute;
  top: 0;
  right: 0;
  background: #ff4444;
  color: white;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 12px;
  z-index: 1000;
}

.confidence-high::after {
  content: "⚠️ 高风险";
  background: #cc0000;
}

.confidence-medium::after {
  content: "⚠️ 可能";
  background: #ff8800;
}

.confidence-low::after {
  content: "⚠️ 低风险";
  background: #ffcc00;
}

/* 悬浮提示 */
.ai-marked-account:hover::before {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1001;
  pointer-events: none;
}
```

### 4.3 Content Script 注入逻辑

**content/content.js**
```javascript
class TwitterAIMarker {
  constructor() {
    this.detector = new AIDetector();
    this.observer = null;
    this.markedAccounts = new Set();
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
  }

  start() {
    this.scanAllAccounts();

    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      mutations.forEach(mutation => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          shouldScan = true;
        }
      });
      if (shouldScan) {
        setTimeout(() => this.scanNewAccounts(), 1000);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async scanAllAccounts() {
    const accountElements = this.getAllAccountElements();
    for (const element of accountElements) {
      await this.processAccountElement(element);
    }
  }

  async scanNewAccounts() {
    const accountElements = this.getAllAccountElements();
    for (const element of accountElements) {
      const username = this.extractUsername(element);
      if (!this.markedAccounts.has(username)) {
        await this.processAccountElement(element);
      }
    }
  }

  async processAccountElement(element) {
    const username = this.extractUsername(element);
    if (!username || this.markedAccounts.has(username)) return;

    try {
      const accountData = await this.extractAccountData(username);
      const result = await this.detector.detectAccount(accountData);

      if (result.confidence >= 0.2) {
        this.markAccount(element, username, result);
        this.markedAccounts.add(username);

        const settings = await Storage.getSettings();
        if (settings.autoBlock && result.confidence >= 0.8) {
          await this.blockAccount(username);
        }
      }
    } catch (error) {
      console.error('AI Hunter: 检测出错', error);
    }
  }

  markAccount(element, username, result) {
    const avatarImg = element.querySelector('img[src*="profile_images"]');
    if (avatarImg) {
      avatarImg.classList.add('ai-marked-account');
      avatarImg.parentElement.classList.add(
        'ai-marked-account',
        `confidence-${result.level}`
      );
      avatarImg.parentElement.setAttribute('data-confidence',
        result.level === 'high' ? '高风险' :
        result.level === 'medium' ? '可能' : '低风险'
      );
      avatarImg.parentElement.setAttribute('data-tooltip',
        `AI Hunter: ${result.reasons.join(', ')}`
      );
    }

    this.addBlockButton(element, username);
  }

  addBlockButton(element, username) {
    const actionBar = element.closest('article').querySelector('[role="group"]');
    if (actionBar && !actionBar.querySelector('.ai-hunter-block-btn')) {
      const blockBtn = document.createElement('button');
      blockBtn.className = 'ai-hunter-block-btn';
      blockBtn.innerHTML = '🚫 屏蔽';
      blockBtn.onclick = () => this.blockAccount(username);
      actionBar.appendChild(blockBtn);
    }
  }

  async blockAccount(username) {
    try {
      await TwitterAPI.blockUser(username);
      this.showBlockSuccess(username);
    } catch (error) {
      console.error('屏蔽失败:', error);
    }
  }

  showBlockSuccess(username) {
    const toast = document.createElement('div');
    toast.className = 'ai-hunter-toast';
    toast.textContent = `已屏蔽 @${username}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  extractUsername(element) {
    const link = element.closest('a[href*="/"]');
    if (link) {
      const match = link.href.match(/\/(\w+)$/);
      return match ? match[1] : null;
    }
    return null;
  }

  async extractAccountData(username) {
    return {
      username: username,
      bio: '',
      followerCount: 0,
      followingCount: 0,
      tweetCount: 0,
      accountAge: 0,
      recentTweets: []
    };
  }
}

new TwitterAIMarker();
```

---

## 5. 数据存储方案

### 5.1 存储管理模块

**libs/storage.js**
```javascript
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
            username: username,
            addedAt: Date.now(),
            reason: reason
          });
          chrome.storage.local.set({ [key]: blacklist }, resolve);
        }
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
        if (!whitelist.includes(username)) {
          whitelist.push(username);
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
        const newWhitelist = whitelist.filter(u => u !== username);
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
}
```

### 5.2 GitHub 黑名单同步

**libs/github-sync.js**
```javascript
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
}
```

### 5.3 Twitter API 封装

**libs/twitter-api.js**
```javascript
class TwitterAPI {
  constructor() {
    this.baseUrl = 'https://api.twitter.com/2';
  }

  async getAuthToken() {
    return new Promise((resolve) => {
      chrome.cookies.get({
        url: 'https://twitter.com',
        name: 'auth_token'
      }, (cookie) => {
        resolve(cookie ? cookie.value : null);
      });
    });
  }

  async blockUser(username) {
    const authToken = await this.getAuthToken();
    if (!authToken) {
      throw new Error('未登录Twitter');
    }

    console.log(`正在屏蔽用户: @${username}`);

    return new Promise((resolve) => {
      setTimeout(() => resolve(), 1000);
    });
  }

  async getUserInfo(username) {
    return {
      username: username,
      bio: '',
      followers: 0,
      following: 0,
      tweets: 0
    };
  }
}
```

---

## 6. 国际化方案

### 6.1 国际化管理

**libs/i18n.js**
```javascript
class I18nManager {
  constructor() {
    this.currentLang = 'zh-CN';
    this.translations = {};
    this.init();
  }

  async init() {
    const settings = await StorageManager.getSettings();
    this.currentLang = settings.language || 'zh-CN';
    await this.loadTranslations(this.currentLang);
  }

  async loadTranslations(lang) {
    try {
      const response = await fetch(`locales/${lang}.json`);
      this.translations = await response.json();
    } catch (error) {
      console.error('加载语言文件失败:', error);
      const response = await fetch('locales/zh-CN.json');
      this.translations = await response.json();
    }
  }

  t(key) {
    return this.translations[key] || key;
  }

  async changeLanguage(lang) {
    this.currentLang = lang;
    await this.loadTranslations(lang);

    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = this.t(key);
    });
  }
}
```

### 6.2 语言文件

**locales/zh-CN.json**
```json
{
  "title": "AI Hunter",
  "detected": "已检测",
  "blocked": "已屏蔽",
  "control_title": "检测控制",
  "enable_detection": "启用检测",
  "auto_block": "自动屏蔽高风险账号",
  "sensitivity": "检测灵敏度",
  "low": "低",
  "medium": "中",
  "high": "高",
  "refresh": "刷新页面",
  "settings": "高级设置",
  "whitelist_title": "本地白名单",
  "add_whitelist": "添加白名单"
}
```

**locales/en-US.json**
```json
{
  "title": "AI Hunter",
  "detected": "Detected",
  "blocked": "Blocked",
  "control_title": "Detection Control",
  "enable_detection": "Enable Detection",
  "auto_block": "Auto-block High Risk",
  "sensitivity": "Sensitivity",
  "low": "Low",
  "medium": "Medium",
  "high": "High",
  "refresh": "Refresh Page",
  "settings": "Settings",
  "whitelist_title": "Whitelist",
  "add_whitelist": "Add Whitelist"
}
```

---

## 7. 开发计划和里程碑

### 🚀 开发计划

#### 阶段1：基础框架搭建 (3-4天)
```
Day 1-2: 项目初始化
  ✓ 创建插件基础文件结构
  ✓ 配置 manifest.json
  ✓ 实现基础的 Popup 弹窗 UI
  ✓ 实现基础的内容注入脚本
  ✓ 设置存储管理模块

Day 3-4: 核心功能实现
  ✓ 实现规则引擎 (keywords, frequency, metadata)
  ✓ 实现检测算法和置信度计算
  ✓ 实现头像标记功能 (CSS)
  ✓ 实现本地黑白名单管理
```

#### 阶段2：检测功能完善 (4-5天)
```
Day 5-7: 检测算法优化
  ✓ 完善账号数据提取逻辑
  ✓ 实现频率检测算法
  ✓ 实现内容模式检测
  ✓ 优化检测性能和准确性
  ✓ 添加调试和日志功能

Day 8-9: UI/UX 优化
  ✓ 完善 Popup 所有功能
  ✓ 添加设置页面 (Options)
  ✓ 实现中英双语切换
  ✓ 优化视觉样式和交互体验
```

#### 阶段3：集成测试 (2-3天)
```
Day 10-11: 功能集成
  ✓ 集成 GitHub 黑名单同步
  ✓ 实现 Twitter API 屏蔽功能
  ✓ 实现本地白名单功能
  ✓ 添加统计信息展示

Day 12: 测试和调试
  ✓ 在真实 Twitter 页面测试
  ✓ 修复发现的 bug
  ✓ 性能优化
  ✓ 添加错误处理
```

#### 阶段4：发布准备 (2-3天)
```
Day 13-14: 打包和发布
  ✓ 准备 Chrome Web Store 上架材料
    - 插件截图
    - 描述文案 (中英双语)
    - 图标设计
    - 隐私政策
  ✓ 创建 GitHub 仓库用于黑名单
  ✓ 撰写用户文档
  ✓ 打包 .crx 文件
  ✓ 提交审核
```

### 📋 关键任务清单

**✅ MVP 必备功能**
- [ ] 基础规则匹配 (关键词 + 频率 + 元数据)
- [ ] 头像红色边框标记
- [ ] 分级置信度显示 (高/中/低)
- [ ] Popup 设置面板
- [ ] 本地黑名单管理
- [ ] 本地白名单功能
- [ ] 中英双语支持

**🔄 后续版本功能**
- [ ] GitHub 官方黑名单同步
- [ ] Twitter API 真正屏蔽
- [ ] 用户 OAuth 登录
- [ ] 付费功能 (Freemium)
- [ ] AI 模型分析 (后端)
- [ ] 跨设备同步

### 🎯 验收标准

1. **功能完整性**: MVP 所有功能正常工作
2. **性能**: 单页面检测时间 < 2秒
3. **准确性**: 规则匹配误判率 < 10%
4. **稳定性**: 无内存泄漏，长时间使用不卡顿
5. **兼容性**: 支持最新 Chrome 版本
6. **UI/UX**: 界面友好，操作直观
7. **国际化**: 中英双语完整翻译

---

## 💡 技术难点和解决方案

### 难点1: Twitter DOM 结构复杂且经常变化
**解决方案**:
- 使用相对稳定的 CSS 选择器
- 添加错误容忍机制
- 提供配置选项让用户手动定位元素

### 难点2: 检测准确性难以保证
**解决方案**:
- 采用多维度规则组合
- 提供灵敏度调节
- 允许用户自定义规则权重
- 持续优化规则库

### 难点3: 复用 Twitter 会话涉及安全风险
**解决方案**:
- 仅使用用户已授权的 cookie
- 不存储敏感信息
- 遵循 Chrome 安全政策
- 明确告知用户隐私政策

---

## 📊 商业模式

### Freemium 模式

**免费功能**
- 规则匹配检测
- 本地黑名单管理
- 基础标记功能

**付费功能 (未来版本)**
- AI 模型深度分析
- 跨设备同步
- 高级检测规则
- 社区黑名单共享

**技术实现**
- 用户认证: Google/GitHub OAuth
- 支付: Stripe
- 后端: Cloudflare Workers

---

## 🔮 未来路线图

### v1.0 (MVP)
- 纯前端实现
- 基础规则检测
- 本地数据存储

### v1.5
- GitHub 黑名单同步
- 增强检测算法
- 优化 UI/UX

### v2.0
- 后端服务 (Cloudflare Workers)
- 用户系统 (OAuth)
- 付费功能 (Freemium)

### v2.5
- AI 模型分析
- 高级规则引擎
- 社区功能

### v3.0
- 机器学习优化
- 实时黑名单共享
- 企业版功能

---

## 总结

本技术方案采用**纯前端 + GitHub 数据源**的 MVP 方案，具有以下优势：

1. **技术栈简单**: 仅需原生 JavaScript，无需构建工具
2. **开发周期短**: 约 12-14 天可完成 MVP
3. **易于发布**: Chrome Web Store 审核相对宽松
4. **可扩展性强**: 为后续版本预留接口
5. **成本低**: 无需服务器费用

后续可以基于 MVP 逐步添加后端服务和 AI 功能，实现完整的商业化产品。
