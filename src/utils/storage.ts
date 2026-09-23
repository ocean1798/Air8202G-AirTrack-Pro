/**
 * AirTrack Pro - 跨端持久化存储统一适配器
 * 抹平 H5、Android 原生容器与微信小程序 JSCore 沙箱之间的存储 API 差异
 */

export const safeStorage = {
  getItem(key: string): string | null {
    // #ifdef MP-WEIXIN
    try {
      const keys = uni.getStorageInfoSync().keys;
      if (!keys.includes(key)) return null;
      const v = uni.getStorageSync(key);
      return typeof v === 'string' ? v : (v ? JSON.stringify(v) : '');
    } catch {
      return null;
    }
    // #endif

    // #ifndef MP-WEIXIN
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return null;
    // #endif
  },

  setItem(key: string, value: string): void {
    // #ifdef MP-WEIXIN
    try {
      uni.setStorageSync(key, value);
    } catch {}
    // #endif

    // #ifndef MP-WEIXIN
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(key, value);
      } catch {}
    }
    // #endif
  },

  removeItem(key: string): void {
    // #ifdef MP-WEIXIN
    try {
      uni.removeStorageSync(key);
    } catch {}
    // #endif

    // #ifndef MP-WEIXIN
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
    // #endif
  }
};
