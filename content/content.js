class TwitterAIMarker {
  constructor() {
    this.detector = detector;
    this.observer = null;
    this.markedAccounts = new Map();
    this.scanning = false;
    this.retryCount = new Map();
    this.maxRetries = 3;
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
  }

  async start() {
    await this.detector.init();
    await this.waitForTwitterLoad();
    await this.scanAllAccounts();
    this.startMutationObserver();
    this.sendReadyMessage();
  }

  async waitForTwitterLoad() {
    return new Promise((resolve) => {
      const checkReady = () => {
        const mainContent = document.querySelector('[role="main"]') ||
                          document.querySelector('[data-testid="primaryColumn"]') ||
                          document.body;
        if (mainContent && document.readyState === 'complete') {
          setTimeout(resolve, 1000);
        } else {
          requestAnimationFrame(checkReady);
        }
      };
      checkReady();
    });
  }

  sendReadyMessage() {
    window.postMessage({ type: 'AI_HUNTER_READY' }, '*');
  }

  startMutationObserver() {
    this.observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (this.containsAccountElement(node)) {
                shouldScan = true;
                break;
              }
            }
          }
        }
        if (shouldScan) break;
      }

      if (shouldScan) {
        this.debounceScan();
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  debounceScan() {
    if (this.scanning) return;
    this.scanning = true;
    setTimeout(async () => {
      await this.scanNewAccounts();
      this.scanning = false;
    }, 1500);
  }

  containsAccountElement(element) {
    const selectors = [
      '[data-testid="User-Name"]',
      '[data-testid="UserAvatar"]',
      '[data-testid="tweetText"]',
      '[data-testid="cellInnerDiv"]',
      'article',
      '[role="article"]'
    ];
    for (const selector of selectors) {
      if (element.querySelector && element.querySelector(selector)) {
        return true;
      }
    }
    return false;
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
      if (username && !this.markedAccounts.has(username)) {
        await this.processAccountElement(element);
      }
    }
  }

  getAllAccountElements() {
    const selectors = [
      '[data-testid="User-Name"]',
      '[data-testid="UserAvatar"]',
      '[data-testid="cellInnerDiv"]',
      'article'
    ];

    let elements = [];
    for (const selector of selectors) {
      elements = elements.concat(Array.from(document.querySelectorAll(selector)));
    }

    return [...new Set(elements)];
  }

  async processAccountElement(element) {
    const username = this.extractUsername(element);
    if (!username || this.markedAccounts.has(username)) return;

    const retryKey = username.toLowerCase();
    if (this.retryCount.get(retryKey) >= this.maxRetries) {
      console.log(`[AI Hunter] 跳过多次失败的账号: @${username}`);
      return;
    }

    try {
      const accountData = await this.extractAccountData(element, username);
      const result = await this.detector.detectAccount(accountData);

      if (result.confidence >= 0.2) {
        this.markAccount(element, username, result);
        this.detector.markAccount(username);
        this.markedAccounts.set(username, result);
        await storage.incrementStat('detected');

        const settings = await storage.getSettings();
        if (settings.autoBlock && result.confidence >= 0.8) {
          await this.blockAccount(username);
        }
      }

      this.retryCount.delete(retryKey);
    } catch (error) {
      console.error(`[AI Hunter] 检测账号 @${username} 出错:`, error);
      const count = (this.retryCount.get(retryKey) || 0) + 1;
      this.retryCount.set(retryKey, count);
    }
  }

  markAccount(element, username, result) {
    const avatarImg = this.findAvatarElement(element);
    if (avatarImg) {
      const container = avatarImg.closest('div') || avatarImg.parentElement;
      if (container) {
        container.classList.add('ai-marked-account');

        if (result.level === 'high') {
          container.classList.add('ai-confidence-high');
        } else if (result.level === 'medium') {
          container.classList.add('ai-confidence-medium');
        } else {
          container.classList.add('ai-confidence-low');
        }

        const tooltipText = `[AI Hunter] ${result.reasons.join(', ')}`;
        container.setAttribute('data-tooltip', tooltipText);

        this.addConfidenceBadge(container, result);
        this.addBlockButtonToTweet(element, username);
      }
    }
  }

  findAvatarElement(element) {
    const selectors = [
      'img[src*="profile_images"]',
      'img[src*="pbs.twimg.com"]',
      'img[src*="abs.twimg.com"]',
      '[data-testid="UserAvatar"] img',
      'img[alt*="profile"]'
    ];

    for (const selector of selectors) {
      const img = element.querySelector(selector);
      if (img) return img;
    }

    if (element.tagName === 'IMG' && element.src) {
      return element;
    }

    return null;
  }

  addConfidenceBadge(container, result) {
    let existingBadge = container.querySelector('.ai-confidence-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    const badge = document.createElement('div');
    badge.className = `ai-confidence-badge ${result.level}`;

    if (result.level === 'high') {
      badge.textContent = '⚠️ 高风险';
    } else if (result.level === 'medium') {
      badge.textContent = '⚠️ 可能';
    } else {
      badge.textContent = '⚠️ 低风险';
    }

    container.style.position = 'relative';
    container.appendChild(badge);
  }

  addBlockButtonToTweet(element, username) {
    const article = element.closest('article') || element.closest('[role="article"]');
    if (!article) return;

    const actionBar = article.querySelector('[role="group"]') ||
                     article.querySelector('[data-testid="toolBar"]') ||
                     article.querySelector('.r-1kbdv8c');

    if (actionBar && !actionBar.querySelector('.ai-hunter-block-btn')) {
      const blockBtn = document.createElement('button');
      blockBtn.className = 'ai-hunter-block-btn';
      blockBtn.textContent = '🚫';
      blockBtn.title = `屏蔽 @${username}`;
      blockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.blockAccount(username);
      });

      actionBar.appendChild(blockBtn);
    }
  }

  async blockAccount(username) {
    try {
      await storage.addToBlacklist(username, '用户手动屏蔽');
      await storage.incrementStat('blocked');
      this.showToast(`已屏蔽 @${username}`, 'success');
      console.log(`[AI Hunter] 已屏蔽用户: @${username}`);
    } catch (error) {
      console.error('[AI Hunter] 屏蔽失败:', error);
      this.showToast('屏蔽失败，请重试', 'error');
    }
  }

  showToast(message, type = 'info') {
    const existingToast = document.querySelector('.ai-hunter-toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `ai-hunter-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'ai-hunter-fade-out 0.3s ease-in forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  extractUsername(element) {
    try {
      const linkSelectors = [
        'a[href*="/"]',
        '[data-testid="User-Name"] a',
        '[role="link"]'
      ];

      for (const selector of linkSelectors) {
        const link = element.closest('a') || element.querySelector(selector);
        if (link && link.href) {
          const match = link.href.match(/\/(?:[a-zA-Z0-9_]+\/status\/)?(@?[a-zA-Z0-9_]+)(?:\?|\/|$)/);
          if (match && match[1]) {
            let username = match[1].replace('@', '');
            if (username && !username.match(/^(status|home|search|notifications|messages|compose)$/i)) {
              return username;
            }
          }
        }
      }

      const nameElement = element.querySelector('[data-testid="User-Name"]');
      if (nameElement) {
        const spans = nameElement.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent.trim();
          if (text.startsWith('@')) {
            return text.substring(1);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[AI Hunter] 提取用户名失败:', error);
      return null;
    }
  }

  async extractAccountData(element, username) {
    const lowerUsername = username.toLowerCase();

    return {
      username: lowerUsername,
      bio: await this.extractBio(element),
      followers: this.extractFollowers(element),
      following: this.extractFollowing(element),
      tweets: this.extractTweets(element),
      accountAge: await this.estimateAccountAge(element),
      recentTweets: [],
      hasAvatar: await this.hasAvatar(element),
      hasBio: await this.hasBio(element),
      sensitivity: (await storage.getSettings()).sensitivity
    };
  }

  async extractBio(element) {
    const bioElement = element.querySelector('[data-testid="UserDescription"]');
    return bioElement ? bioElement.textContent.trim() : '';
  }

  extractFollowers(element) {
    const followerText = element.textContent.match(/(\d+[\d,.kKmM]*)\s*([Ff]ollowers|[粉絲])/);
    if (followerText) {
      return this.parseNumber(followerText[1]);
    }
    return 0;
  }

  extractFollowing(element) {
    const followingText = element.textContent.match(/(\d+[\d,.kKmM]*)\s*([Ff]ollowing|[關注])/);
    if (followingText) {
      return this.parseNumber(followingText[1]);
    }
    return 0;
  }

  extractTweets(element) {
    const tweetText = element.textContent.match(/(\d+[\d,.kKmM]*)\s*([Tt]weets|[推文])/);
    if (tweetText) {
      return this.parseNumber(tweetText[1]);
    }
    return 0;
  }

  parseNumber(str) {
    if (!str) return 0;
    str = str.toLowerCase().replace(/,/g, '');
    if (str.includes('k')) {
      return parseFloat(str) * 1000;
    }
    if (str.includes('m')) {
      return parseFloat(str) * 1000000;
    }
    return parseInt(str) || 0;
  }

  async estimateAccountAge(element) {
    return 30;
  }

  async hasAvatar(element) {
    const avatar = this.findAvatarElement(element);
    if (avatar) {
      const src = avatar.src || avatar.getAttribute('src');
      return src && !src.includes('default_profile');
    }
    return false;
  }

  async hasBio(element) {
    const bioElement = element.querySelector('[data-testid="UserDescription"]');
    return !!bioElement;
  }
}

new TwitterAIMarker();
