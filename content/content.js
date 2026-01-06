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
    console.log('[AI Hunter] Starting detection engine...');
    try {
      await this.detector.init();
      console.log('[AI Hunter] Detector initialized');
    } catch (error) {
      console.warn('[AI Hunter] Detector init warning:', error.message);
    }

    await this.waitForTwitterLoad();
    await this.scanAllAccounts();
    this.startMutationObserver();
    this.sendReadyMessage();
    console.log('[AI Hunter] Detection engine running');
  }

  async waitForTwitterLoad() {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 50;

      const checkReady = () => {
        attempts++;
        const mainContent = document.querySelector('[role="main"]') ||
                          document.querySelector('[data-testid="primaryColumn"]') ||
                          document.body;
        if (mainContent && document.readyState === 'complete') {
          setTimeout(resolve, 1000);
        } else if (attempts < maxAttempts) {
          setTimeout(checkReady, 200);
        } else {
          console.log('[AI Hunter] Twitter load timeout, starting anyway...');
          setTimeout(resolve, 500);
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
    console.log('[AI Hunter] Scanning all accounts...');
    const accountElements = this.getAllAccountElements();
    console.log(`[AI Hunter] Found ${accountElements.length} account elements`);
    for (const element of accountElements) {
      await this.processAccountElement(element);
    }
    console.log(`[AI Hunter] Scan complete, marked accounts:`, this.markedAccounts.size);
  }

  async scanNewAccounts() {
    const accountElements = this.getAllAccountElements();
    let newCount = 0;
    for (const element of accountElements) {
      const username = this.extractUsername(element);
      if (username && !this.markedAccounts.has(username)) {
        newCount++;
        await this.processAccountElement(element);
      }
    }
    if (newCount > 0) {
      console.log(`[AI Hunter] Scanned ${newCount} new accounts`);
    }
  }

  getAllAccountElements() {
    const selectors = [
      '[data-testid="User-Name"]',
      '[data-testid="UserAvatar"]',
      '[data-testid="cellInnerDiv"]',
      '[data-testid="tweetText"]',
      'article[role="article"]',
      '[role="article"]',
      '.css-175oi2z'  // Common Twitter container class
    ];

    let elements = [];
    for (const selector of selectors) {
      try {
        const found = document.querySelectorAll(selector);
        elements = elements.concat(Array.from(found));
      } catch (e) {
        // Invalid selector, skip
      }
    }

    console.log(`[AI Hunter] Searched ${selectors.length} selectors, found ${elements.length} elements`);
    return [...new Set(elements)];
  }

  async processAccountElement(element) {
    const username = this.extractUsername(element);
    if (!username) {
      return;
    }
    if (this.markedAccounts.has(username)) {
      return;
    }

    const retryKey = username.toLowerCase();
    if (this.retryCount.get(retryKey) >= this.maxRetries) {
      return;
    }

    try {
      const accountData = await this.extractAccountData(element, username);
      const result = await this.detector.detectAccount(accountData);

      if (result.confidence >= 0.2) {
        console.log(`[AI Hunter] Detected @${username} with ${(result.confidence * 100).toFixed(0)}% confidence`);
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
      '[data-testid="UserAvatar"]',
      'img[alt*="profile"]',
      'img[alt*="avatar"]',
      'img[alt*="user"]',
      'img[data-testid*="avatar"]',
      'article img'
    ];

    for (const selector of selectors) {
      const img = element.querySelector(selector);
      if (img) return img;
    }

    if (element.tagName === 'IMG' && element.src) {
      return element;
    }

    // Try to find any image in the element
    const allImages = element.querySelectorAll('img');
    for (const img of allImages) {
      const src = img.getAttribute('src') || '';
      if (src && (src.includes('twimg') || src.includes('profile') || src.includes('default'))) {
        return img;
      }
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
      // Method 1: Find link elements with usernames
      const allLinks = element.querySelectorAll('a[href*="/"]');
      for (const link of allLinks) {
        const href = link.getAttribute('href') || '';
        const match = href.match(/^\/([a-zA-Z0-9_]+)$/);
        if (match && match[1] && !match[1].match(/^(home|search|notifications|messages|compose|explore|lists|bookmarks|profile|more)$/i)) {
          return match[1];
        }
      }

      // Method 2: Look for @username in text content
      const textContent = element.textContent || '';
      const atMentionMatch = textContent.match(/@([a-zA-Z0-9_]{1,15})/);
      if (atMentionMatch && atMentionMatch[1]) {
        return atMentionMatch[1];
      }

      // Method 3: Find data-testid User-Name element
      const userNameEl = element.querySelector('[data-testid="User-Name"]');
      if (userNameEl) {
        const spans = userNameEl.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent.trim();
          if (text.startsWith('@') && text.length > 1) {
            return text.substring(1);
          }
        }
      }

      // Method 4: Look for link in closest article
      const article = element.closest('article') || element.closest('[role="article"]');
      if (article) {
        const userLink = article.querySelector('a[href*="/"]');
        if (userLink) {
          const href = userLink.getAttribute('href') || '';
          const match = href.match(/^\/([a-zA-Z0-9_]+)$/);
          if (match && match[1]) {
            return match[1];
          }
        }
      }

      return null;
    } catch (error) {
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
