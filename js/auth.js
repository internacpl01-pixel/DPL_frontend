// ===== Auth Module =====

const Auth = {
  getCurrentUser() {
    const data = localStorage.getItem('user');
    return data ? JSON.parse(data) : null;
  },

  getToken() {
    return localStorage.getItem('access_token');
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  getUserLevel() {
    const user = this.getCurrentUser();
    return user ? (user.access_level ?? user.level ?? -1) : -1;
  },

  getStoredUser() {
    return this.getCurrentUser();
  },

  async login(username, password) {
    const result = await Api.login(username, password);
    localStorage.setItem('access_token', result.access_token);
    if (result.user) {
      localStorage.setItem('user', JSON.stringify(result.user));
    }
    return result;
  },

  async register(username, password, accessLevel) {
    return await Api.register(username, password, accessLevel);
  },

  async logout() {
    await Api.logout();
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  },

  async fetchMe() {
    try {
      const user = await Api.getMe();
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (err) {
      await this.logout();
      throw err;
    }
  },
};

window.Auth = Auth;
