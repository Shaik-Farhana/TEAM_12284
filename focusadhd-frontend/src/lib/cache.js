export const cache = {
  async set(key, value, ttlHours = 24) {
    if (!window.indexedDB) return;
    try {
      const item = {
        value,
        expiry: new Date().getTime() + ttlHours * 60 * 60 * 1000,
      };
      localStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
      console.error("Cache set failed", e);
    }
  },

  async get(key) {
    if (!window.indexedDB) return null;
    try {
      const itemStr = localStorage.getItem(key);
      if (!itemStr) return null;
      const item = JSON.parse(itemStr);
      if (new Date().getTime() > item.expiry) {
        localStorage.removeItem(key);
        return null;
      }
      return item.value;
    } catch (e) {
      console.error("Cache get failed", e);
      return null;
    }
  },

  async remove(key) {
    localStorage.removeItem(key);
  },
};
