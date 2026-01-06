class RuleEngine {
  constructor() {
    this.rules = this.getDefaultRules();
    this.rulesLoaded = false;
  }

  getDefaultRules() {
    return {
      keywords: {
        bio_keywords: [
          "I am an AI", "artificial intelligence", "AI assistant", "I'm a bot",
          "chatbot", "language model", "languagemodel", "large language model",
          "LLM", "GPT", "OpenAI", "Claude", "Bard", "AI模型", "人工智能",
          "我是AI", "我是机器人", "聊天机器人"
        ],
        username_patterns: [
          "^bot_", "_bot$", "^ai_", "_ai$", "^gpt", "gpt_",
          "^chatbot", "_chatbot$"
        ],
        weight: 0.7
      },
      patterns: {
        repetitive_phrases: [
          "As an AI", "I don't have personal", "I'm here to help",
          "artificial intelligence", "based on my training", "my knowledge cutoff",
          "I was trained by", "large language model", "language model",
          "helpful and harmless", "I cannot", "I'm unable to", "my apologies"
        ],
        template_indicators: [
          "Based on my training", "My knowledge cutoff", "I was trained by",
          "As a language model", "I'm an AI language model",
          "I don't have personal opinions", "I don't have access to",
          "I cannot browse the internet"
        ],
        weight: 0.5
      },
      frequency: {
        max_tweets_per_hour: 50,
        max_tweets_per_day: 200,
        active_24_7_threshold: 0.9,
        weight: 0.8
      },
      metadata: {
        low_followers_threshold: 100,
        followers_following_ratio: 0.1,
        no_avatar_weight: 0.3,
        no_bio_weight: 0.4,
        new_account_threshold_days: 30,
        weight: 0.6
      }
    };
  }

  async loadRules() {
    if (this.rulesLoaded) return;

    const ruleFiles = ['keywords', 'patterns', 'frequency', 'metadata'];
    let loadedCount = 0;

    for (const file of ruleFiles) {
      try {
        const url = chrome.runtime.getURL(`rules/${file}.json`);

        // Skip fetch if URL is invalid
        if (!url || url.includes('chrome-extension://invalid') || url.includes('undefined')) {
          continue;
        }

        const response = await fetch(url);
        if (response.ok) {
          this.rules[file] = await response.json();
          loadedCount++;
        }
      } catch (error) {
        // Silently use default rules
      }
    }

    this.rulesLoaded = true;
  }

  checkKeywords(accountData) {
    const keywords = this.rules.keywords;
    if (!keywords) return 0;

    let score = 0;
    const bio = (accountData.bio || '').toLowerCase();
    const username = (accountData.username || '').toLowerCase();

    for (const keyword of keywords.bio_keywords || []) {
      if (bio.includes(keyword.toLowerCase())) {
        score += 0.3;
        break;
      }
    }

    for (const pattern of keywords.username_patterns || []) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(username)) {
        score += 0.4;
        break;
      }
    }

    return Math.min(score, 0.7);
  }

  checkPatterns(accountData) {
    const patterns = this.rules.patterns;
    if (!patterns) return 0;

    let score = 0;
    const tweets = accountData.recentTweets || [];

    for (const phrase of patterns.repetitive_phrases || []) {
      for (const tweet of tweets) {
        if (tweet.toLowerCase().includes(phrase.toLowerCase())) {
          score += 0.2;
          break;
        }
      }
    }

    for (const indicator of patterns.template_indicators || []) {
      for (const tweet of tweets) {
        if (tweet.toLowerCase().includes(indicator.toLowerCase())) {
          score += 0.3;
          break;
        }
      }
    }

    return Math.min(score, patterns.weight || 0.5);
  }

  checkFrequency(accountData) {
    const frequency = this.rules.frequency;
    if (!frequency) return 0;

    let score = 0;

    if (accountData.tweetsPerHour > frequency.max_tweets_per_hour) {
      score += 0.4;
    }

    if (accountData.tweetsPerDay > frequency.max_tweets_per_day) {
      score += 0.3;
    }

    if (accountData.active24_7 && accountData.active24_7 > frequency.active_24_7_threshold) {
      score += 0.1;
    }

    return Math.min(score, frequency.weight || 0.8);
  }

  checkMetadata(accountData) {
    const metadata = this.rules.metadata;
    if (!metadata) return 0;

    let score = 0;

    if (accountData.followers < metadata.low_followers_threshold) {
      score += 0.1;
    }

    const ratio = accountData.followers / (accountData.following || 1);
    if (ratio < metadata.followers_following_ratio) {
      score += 0.2;
    }

    if (!accountData.hasAvatar) {
      score += 0.1;
    }

    if (!accountData.hasBio) {
      score += 0.15;
    }

    if (accountData.accountAge < metadata.new_account_threshold_days) {
      score += 0.15;
    }

    return Math.min(score, metadata.weight || 0.6);
  }

  calculateScore(accountData) {
    const sensitivity = accountData.sensitivity || 3;
    const sensitivityMultiplier = sensitivity / 3;

    let totalScore = 0;
    totalScore += this.checkKeywords(accountData) * 0.3 * sensitivityMultiplier;
    totalScore += this.checkFrequency(accountData) * 0.25 * sensitivityMultiplier;
    totalScore += this.checkMetadata(accountData) * 0.25 * sensitivityMultiplier;
    totalScore += this.checkPatterns(accountData) * 0.2 * sensitivityMultiplier;

    return Math.min(totalScore, 1.0);
  }
}

const ruleEngine = new RuleEngine();
