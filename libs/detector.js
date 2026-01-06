class AIDetector {
  constructor() {
    this.markedAccounts = new Set();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    await ruleEngine.loadRules();
    this.initialized = true;
  }

  async detectAccount(accountData) {
    await this.init();

    const username = accountData.username?.toLowerCase();
    if (!username) {
      return { confidence: 0, level: 'none', reasons: [] };
    }

    const inWhitelist = await storage.isInWhitelist(username);
    if (inWhitelist) {
      return { confidence: 0, level: 'none', reasons: ['在白名单中'] };
    }

    const inBlacklist = await storage.isInBlacklist(username);
    if (inBlacklist) {
      return { confidence: 1.0, level: 'high', reasons: ['在本地黑名单中'] };
    }

    let confidence = 0;
    let reasons = [];

    const keywordScore = ruleEngine.checkKeywords(accountData);
    if (keywordScore > 0) {
      confidence += keywordScore * 0.3;
      reasons.push('Bio/用户名包含AI相关关键词');
    }

    const frequencyScore = ruleEngine.checkFrequency(accountData);
    if (frequencyScore > 0) {
      confidence += frequencyScore * 0.25;
      reasons.push('发帖频率异常');
    }

    const metadataScore = ruleEngine.checkMetadata(accountData);
    if (metadataScore > 0) {
      confidence += metadataScore * 0.25;
      reasons.push('账号元数据异常');
    }

    const patternScore = ruleEngine.checkPatterns(accountData);
    if (patternScore > 0) {
      confidence += patternScore * 0.2;
      reasons.push('内容模式类似AI生成');
    }

    confidence = Math.min(confidence, 1.0);

    return {
      confidence: confidence,
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

  async shouldMarkAccount(confidence, sensitivity) {
    const threshold = 1 - (sensitivity / 10);
    return confidence >= threshold;
  }

  isAccountMarked(username) {
    return this.markedAccounts.has(username.toLowerCase());
  }

  markAccount(username) {
    this.markedAccounts.add(username.toLowerCase());
  }

  unmarkAccount(username) {
    this.markedAccounts.delete(username.toLowerCase());
  }

  getMarkedAccounts() {
    return new Set(this.markedAccounts);
  }

  clearMarkedAccounts() {
    this.markedAccounts.clear();
  }
}

const detector = new AIDetector();
