class TwitterAPI {
  constructor() {
    this.baseUrl = 'https://twitter.com';
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

  async getGuestToken() {
    return new Promise((resolve) => {
      chrome.cookies.get({
        url: 'https://twitter.com',
        name: 'gt'
      }, (cookie) => {
        resolve(cookie ? cookie.value : null);
      });
    });
  }

  async blockUser(username) {
    const authToken = await this.getAuthToken();
    if (!authToken) {
      throw new Error('未登录Twitter，请先登录后再试');
    }

    console.log(`[AI Hunter] 正在屏蔽用户: @${username}`);

    try {
      const response = await fetch(`${this.baseUrl}/i/api/1.1/blocks/create.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-twitter-auth-type': 'OAuthWithRestrictedData',
          'x-twitter-client-language': 'zh-CN',
          'Cookie': `auth_token=${authToken}`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        body: `screen_name=${encodeURIComponent(username)}`
      });

      if (response.ok) {
        console.log(`[AI Hunter] 成功屏蔽用户: @${username}`);
        return true;
      } else {
        throw new Error(`屏蔽失败: ${response.status}`);
      }
    } catch (error) {
      console.error('[AI Hunter] 屏蔽用户失败:', error);
      throw error;
    }
  }

  async getUserInfo(username) {
    try {
      const response = await fetch(`${this.baseUrl}/i/api/graphql/7MInU4G_yWqa4LwaP9tKxQ/UserByScreenName?variables=%7B%22screen_name%22%3A%22${encodeURIComponent(username)}%22%2C%22withSafetyModeUserFields%22%3Atrue%7D`, {
        headers: {
          'Authorization': `Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`,
          'x-twitter-client-language': 'zh-CN'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const user = data.data?.user?.result;
        if (user) {
          return {
            username: username,
            bio: user.legacy?.description || '',
            followers: user.legacy?.followers_count || 0,
            following: user.legacy?.friends_count || 0,
            tweets: user.legacy?.statuses_count || 0,
            verified: user.legacy?.verified || false,
            profileImage: user.legacy?.profile_image_url_https || ''
          };
        }
      }
    } catch (error) {
      console.error('[AI Hunter] 获取用户信息失败:', error);
    }

    return {
      username: username,
      bio: '',
      followers: 0,
      following: 0,
      tweets: 0,
      verified: false,
      profileImage: ''
    };
  }

  async followUser(username) {
    const authToken = await this.getAuthToken();
    if (!authToken) {
      throw new Error('未登录Twitter');
    }

    try {
      const response = await fetch(`${this.baseUrl}/i/api/1.1/friendships/create.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': `auth_token=${authToken}`,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        body: `screen_name=${encodeURIComponent(username)}`
      });

      return response.ok;
    } catch (error) {
      console.error('[AI Hunter] 关注用户失败:', error);
      return false;
    }
  }
}

const twitterAPI = new TwitterAPI();
