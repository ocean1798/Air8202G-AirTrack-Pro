/**
 * AirTrack Pro - 商业级 IoT 客户端与时空数据中枢
 *
 * 核心特性：
 * 1. 100% 对接合宙官方真实网关，真实物理坐标与路网移动轨迹。
 * 2. 离线时空缓存：基于 IndexedDB (`AirTrackDB_v1`) 持久化设备档案与历史轨迹点。
 * 3. 本地优先检索：切换时段优先从本地毫秒级重绘，云端静默受控增量同步。
 * 4. 商业化多账号管理：支持任意合宙账号安全授权与多项目自动适配。
 */

import { Capacitor } from '@capacitor/core';
import type { DeviceInfo, TrackPoint } from './types';
import { OfficialTags } from './types';
import { DeviceRateLimiter } from './rate-limiter';
import {
  getAllRegisteredAccounts,
  findAccount,
  registerUserAccount,
  unregisterUserAccount,
  updateUserAccountLabel,
  DEFAULT_ACCOUNT_PHONE,
  DEMO_ACCOUNTS,
  PRESET_AUTH_TOKENS
} from './accounts';
import type { AccountDef, HostInjectedSession } from './accounts';
import { db, type StoredTrackPoint, type StoredDeviceProfile } from '../utils/db';
import { voltageToPercentage } from '../utils/battery-model';
import { safeStorage } from '../utils/storage';

/** 跨端统一网络请求适配器 (H5/App 走 fetch，微信小程序走 uni.request) */
export async function httpPlatformRequest(url: string, options: RequestInit): Promise<Response> {
  // #ifdef MP-WEIXIN
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: (options.method as any) || 'GET',
      data: options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : undefined,
      header: options.headers as any,
      timeout: (options as any).timeout || 10000,
      success: (res) => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: String(res.statusCode),
          json: async () => typeof res.data === 'string' ? JSON.parse(res.data) : res.data,
          text: async () => typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
        } as Response);
      },
      fail: (err) => reject(new Error((err && err.errMsg) || '网络请求失败'))
    });
  });
  // #endif

  // #ifndef MP-WEIXIN
  return fetch(url, options);
  // #endif
}


/** 跨端安全剪贴板文本写入 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  // #ifdef MP-WEIXIN
  return new Promise((resolve) => {
    uni.setClipboardData({
      data: text,
      showToast: true,
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
  // #endif

  // #ifndef MP-WEIXIN
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const res = document.execCommand('copy');
      document.body.removeChild(textarea);
      return !!res;
    }
  } catch (e) {
    console.warn('[Clipboard] copy failed', e);
  }
  return false;
  // #endif
}

/** 换算 4G 蜂窝信号中文评级描述 */
export function getSignalLevelText(csq: number): string {
  if (csq >= 20) return '强';
  if (csq >= 12) return '中';
  if (csq >= 5) return '弱';
  return '无';
}

/** 换算人性化相对更新时间（如“刚刚”、“4分钟前”、“2小时前”） */
export function formatRelativeTime(ts?: string | number): string {
  if (!ts || ts === '—') return '—';
  const ms = typeof ts === 'number' ? ts : new Date(String(ts).replace(/-/g, '/')).getTime();
  if (isNaN(ms) || ms <= 0) return String(ts);
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

export { getAllRegisteredAccounts, DEFAULT_ACCOUNT_PHONE, findAccount, updateUserAccountLabel };
export type { AccountDef };

export const OFFICIAL_API_CONFIG = {
  gateway: 'https://api-iot.luatos.com/iot/open_api',
  oauthAuthorizeUrl: 'https://api-iot.luatos.com/iam/luat_oauth/authorize',
  oauthLoginApi: 'https://api-iot.luatos.com/iam/luat_oauth/v2/login'
};

/** 网关鉴权失败 / 会话在其他设备登录 */
export class AuthExpiredError extends Error {
  constructor(message = '合宙云端会话已断开（可能在其他设备重复登录）') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

export interface HealthProbeResult {
  ok: boolean;
  isExpired?: boolean;
  isNetworkError?: boolean;
  message: string;
  deviceCount: number;
}

const LS_ACTIVE_ACCOUNT = 'airtrack_active_account';
const LS_PENDING_ACCOUNT = 'airtrack_pending_account';
const LS_PROJECTS_CACHE = 'airtrack_projects_cache_';
const LS_CUSTOM_DEVICE_NAMES = 'airtrack_custom_device_names';
const lsAuthKey = (phone: string) => `airtrack_auth_${phone}`;
const lsServiceKey = (phone: string) => `airtrack_service_${phone}`;
const lsProfileKey = (phone: string) => `airtrack_profile_${phone}`;
const lsProjectKey = (phone: string) => `airtrack_project_${phone}`;

export interface AccountRuntimeState {
  account: AccountDef;
  hasAuth: boolean;
  isExpired: boolean;
  projectKey: string;
  active: boolean;
  deviceCount?: number;
}

export function calculateScopeWindow(
  scope: string = '90d',
  customStart?: string,
  customEnd?: string
): { startMs: number; endMs: number; isMultiDay: boolean; startDate: Date; endDate: Date } {
  let startDate: Date;
  let endDate: Date = new Date();

  if (scope === 'custom' && customStart && customEnd) {
    startDate = new Date(customStart + 'T00:00:00');
    endDate = new Date(customEnd + 'T23:59:59');
  } else if (scope === 'today') {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (scope === 'yesterday') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 0);
  } else if (scope === '3d') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);
  } else if (scope === '7d') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
  } else if (scope === '30d') {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
  } else if (scope === 'recent_window') {
    startDate = new Date(Date.now() - 48 * 3600 * 1000);
  } else {
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
  }

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const isMultiDay = (endMs - startMs) > 86400000;
  return { startMs, endMs, isMultiDay, startDate, endDate };
}

export class AirCloudClient {
  private static instance: AirCloudClient;
  private rateLimiter: DeviceRateLimiter;
  private token = '';
  private salt = '';
  private sid = '336677';
  private projectKey = '';
  private activePhone = DEFAULT_ACCOUNT_PHONE;
  private expiredAccounts = new Set<string>();
  private probedDeviceCounts: Map<string, number> = new Map();

  public static getInstance(): AirCloudClient {
    if (!AirCloudClient.instance) {
      AirCloudClient.instance = new AirCloudClient();
    }
    return AirCloudClient.instance;
  }

  constructor() {
    this.rateLimiter = DeviceRateLimiter.getInstance();
    this.loadFromStorage();
  }

  // ============================ 账号管理 ============================

  /** 读取当前激活账号 */
  public getActiveAccount(): AccountDef {
    return findAccount(this.activePhone) || {
      phone: this.activePhone,
      label: '',
      role: '',
      projectKey: this.projectKey
    };
  }

  public getActivePhone(): string {
    return this.activePhone;
  }

  /** 获取云端返回并持久化的用户 Profile 名称（若有） */
  public getCloudProfileName(phone?: string): string {
    const target = phone || this.activePhone;
    if (!target) return '';
    try {
      const raw = safeStorage.getItem(lsProfileKey(target));
      if (raw) {
        const p = JSON.parse(raw);
        return String(p?.name || p?.nickName || p?.nickname || p?.user_name || '').trim();
      }
    } catch (_) {}
    return '';
  }

  public getProbedDeviceCount(phone: string): number | undefined {
    return this.probedDeviceCounts.get(phone);
  }

  /**
   * 独立凭据获取辅助方法：获取指定手机号独立凭据，避免单例污染
   */
  public getCredentialsForPhone(phone: string): { token: string; salt: string; sid: string; projectKey: string } | null {
    // safe storage
    let token = '';
    let salt = '';
    let sid = '336677';
    let projectKey = this.readProjectKey(phone) || '';

    try {
      const authStr = safeStorage.getItem(lsAuthKey(phone));
      if (authStr) {
        const auth = JSON.parse(authStr);
        if (auth?.token && auth?.salt) {
          token = auth.token;
          salt = auth.salt;
        }
      }
      const servStr = safeStorage.getItem(lsServiceKey(phone));
      if (servStr) {
        const serv = JSON.parse(servStr);
        if (serv?.sid) sid = serv.sid;
      }
    } catch (_) {}

    if ((!token || !salt) && PRESET_AUTH_TOKENS[phone]) {
      const preset = PRESET_AUTH_TOKENS[phone];
      token = preset.auth?.token || '';
      salt = preset.auth?.salt || '';
      if (preset.service?.sid) sid = preset.service.sid;
    }

    if (!projectKey) {
      const acct = findAccount(phone);
      if (acct?.projectKey) projectKey = acct.projectKey;
    }

    if (token && salt) {
      return { token, salt, sid, projectKey };
    }
    return null;
  }

  /**
   * 轻量无副作用只读 HTTP 请求：使用目标账号独立凭据发送单次调用，绝不改写单例状态
   */
  public async rawPostApi(
    endpoint: string,
    payload: any,
    creds: { token: string; salt: string; sid: string; projectKey?: string },
    timeoutMs: number = 5000
  ): Promise<any> {
    const url = `${OFFICIAL_API_CONFIG.gateway}/${endpoint.replace(/^\//, '')}`;
    // 严格遵循合宙 API CORS 白名单，严禁添加自定义 header (如 project)，否则将被浏览器 preflight 拦截报 Failed to fetch
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'authorization': creds.token,
      'salt': creds.salt,
      'sid': creds.sid || '336677'
    };

    let controller: any = null;
    let timer: any = null;
    if (typeof AbortController !== 'undefined') {
      try {
        controller = new AbortController();
        timer = setTimeout(() => {
          try { controller.abort(); } catch (_) {}
        }, timeoutMs);
      } catch (_) {}
    }

    try {
      const res = await httpPlatformRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });
      if (timer) clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      if (timer) clearTimeout(timer);
      throw err;
    }
  }

  /**
   * 纯只读健康探活接口（严禁调用 setActiveAccount，绝不篡改全局激活状态与写盘）
   */
  public async checkAccountHealth(phone?: string): Promise<HealthProbeResult> {
    const targetPhone = phone || this.activePhone;
    const creds = this.getCredentialsForPhone(targetPhone);

    let fallbackCount = this.probedDeviceCounts.get(targetPhone);
    if (fallbackCount === undefined) {
      try {
        const cachedDevs = await db.getDeviceProfiles(targetPhone);
        if (cachedDevs && cachedDevs.length > 0) {
          fallbackCount = cachedDevs.length;
        }
      } catch (_) {}
    }
    const finalFallback = fallbackCount ?? 0;

    if (!creds || !creds.token || !creds.salt) {
      this.markAuthExpired(targetPhone, true);
      return {
        ok: false,
        isExpired: true,
        message: `账号 ${targetPhone.slice(-4)} 尚未登录授权`,
        deviceCount: finalFallback
      };
    }

    try {
      let projectKey = creds.projectKey || '';
      if (!projectKey) {
        const pResp = await this.rawPostApi('/list_my_projects', { page: 1, size: 50 }, creds, 5000);
        if (pResp && (pResp.code === 105 || (typeof pResp.value === 'string' && pResp.value.includes('auth failed')))) {
          this.markAuthExpired(targetPhone, true);
          return {
            ok: false,
            isExpired: true,
            message: `账号 ${targetPhone.slice(-4)} 登录态已失效`,
            deviceCount: finalFallback
          };
        }
        if (pResp && pResp.code === 0 && Array.isArray(pResp.value) && pResp.value.length > 0) {
          projectKey = pResp.value[0].project_key;
          creds.projectKey = projectKey;
          this.writeProjectKey(targetPhone, projectKey);
        } else if (pResp && pResp.code === 0 && Array.isArray(pResp.value) && pResp.value.length === 0) {
          // 官方默认工程密钥兜底 (见《AirCloud接口文档.md》第 102 行)
          const defaultKey = await this.getDefaultProjectKey(creds);
          if (defaultKey) {
            projectKey = defaultKey;
            creds.projectKey = projectKey;
            this.writeProjectKey(targetPhone, projectKey);
          }
        }
      }

      if (!projectKey) {
        return {
          ok: false,
          isExpired: false,
          message: `账号 ${targetPhone.slice(-4)} 未找到有效项目`,
          deviceCount: finalFallback
        };
      }

      let dResp = await this.rawPostApi('/list_my_devices', {
        project: projectKey,
        page: 1,
        size: 50
      }, creds, 5000);

      // 自愈防线：若非 105 错误且鉴权受阻，尝试重新拉取有效 projectKey 并重试一次
      if (dResp && dResp.code !== 0 && dResp.code !== 105) {
        const pResp = await this.rawPostApi('/list_my_projects', { page: 1, size: 50 }, creds, 5000);
        if (pResp && pResp.code === 0 && Array.isArray(pResp.value) && pResp.value.length > 0) {
          const freshKey = pResp.value[0].project_key;
          if (freshKey && freshKey !== projectKey) {
            projectKey = freshKey;
            creds.projectKey = freshKey;
            this.writeProjectKey(targetPhone, freshKey);
            dResp = await this.rawPostApi('/list_my_devices', {
              project: projectKey,
              page: 1,
              size: 50
            }, creds, 5000);
          }
        }
      }

      if (dResp && (dResp.code === 105 || (typeof dResp.value === 'string' && dResp.value.includes('auth failed')))) {
        this.markAuthExpired(targetPhone, true);
        return {
          ok: false,
          isExpired: true,
          message: `账号 ${targetPhone.slice(-4)} 登录态已失效，需重新授权`,
          deviceCount: finalFallback
        };
      }

      let rawRecords: any[] = [];
      if (dResp && dResp.code === 0 && dResp.value) {
        if (Array.isArray(dResp.value.records)) {
          rawRecords = dResp.value.records;
        } else if (Array.isArray(dResp.value)) {
          rawRecords = dResp.value;
        }
      }

      if (dResp && dResp.code === 0 && dResp.value) {
        this.markAuthExpired(targetPhone, false);
        const validRecords = rawRecords.filter((r: any) => {
          const imei = r.deviceid || r.deviceId;
          return imei !== '864317087173038';
        });
        const count = validRecords.length;
        this.probedDeviceCounts.set(targetPhone, count);
        return {
          ok: true,
          isExpired: false,
          message: `账号 ${targetPhone.slice(-4)} 凭据有效，名下共 ${count} 台设备`,
          deviceCount: count
        };
      }

      return {
        ok: false,
        isExpired: false,
        message: '设备清单拉取失败',
        deviceCount: this.probedDeviceCounts.get(targetPhone) ?? finalFallback
      };
    } catch (e: any) {
      const isTimeout = e?.name === 'AbortError' || e?.message?.includes('timeout') || e?.message?.includes('aborted');
      const isFetchErr = e?.message?.includes('fetch') || e?.message?.includes('network') || e?.message?.includes('NetworkError');
      let errMsg = '网络连接异常';
      if (isTimeout) {
        errMsg = `账号 ${targetPhone.slice(-4)} 云端连接超时`;
      } else if (isFetchErr) {
        errMsg = `账号 ${targetPhone.slice(-4)} 云端网络受阻，已保留离线资产`;
      } else if (e?.message) {
        errMsg = e.message;
      }
      return {
        ok: false,
        isExpired: false,
        isNetworkError: true,
        message: errMsg,
        deviceCount: this.probedDeviceCounts.get(targetPhone) ?? finalFallback
      };
    }
  }

  /**
   * 串行检测多个账号的健康状态与设备数（严格避免并发单例状态踩踏）
   */
  public async probeAccountsSequential(
    phones?: string[],
    onProgress?: (phone: string, result: HealthProbeResult) => void
  ): Promise<Record<string, HealthProbeResult>> {
    const list = phones && phones.length > 0 
      ? phones 
      : getAllRegisteredAccounts().map(a => a.phone);
    const results: Record<string, HealthProbeResult> = {};
    for (const p of list) {
      try {
        const res = await this.checkAccountHealth(p);
        results[p] = res;
        if (onProgress) {
          onProgress(p, res);
        }
      } catch (err: any) {
        results[p] = {
          ok: false,
          isExpired: false,
          isNetworkError: true,
          message: err?.message || '检测异常',
          deviceCount: this.probedDeviceCounts.get(p) ?? 0
        };
        if (onProgress) {
          onProgress(p, results[p]);
        }
      }
      // 间隔 100ms 避免网络请求触发云端频控
      await new Promise(r => setTimeout(r, 100));
    }
    return results;
  }

  /**
   * 切换激活账号
   */
  public setActiveAccount(phone: string): void {
    this.activePhone = phone;
    if (true) {
      safeStorage.setItem(LS_ACTIVE_ACCOUNT, phone);
    }
    this.resetCredentials();
    this.loadFromStorage();
  }

  /** 移除账号并清除本地缓存 */
  public removeAccount(phone: string): void {
    unregisterUserAccount(phone);
    this.clearAuth(phone);
    if (this.activePhone === phone) {
      const all = getAllRegisteredAccounts();
      if (all.length > 0) {
        this.setActiveAccount(all[0].phone);
      }
    }
  }

  /** 获取用户本地自定义设备名称 */
  public getCustomDeviceName(imei: string): string {
    // safe storage
    try {
      const raw = safeStorage.getItem(LS_CUSTOM_DEVICE_NAMES);
      if (raw) {
        const map = JSON.parse(raw);
        return map[imei] || '';
      }
    } catch (_) {}
    return '';
  }

  /** 设置用户本地自定义设备名称 */
  public setCustomDeviceName(imei: string, name: string): void {
    // safe storage
    try {
      const raw = safeStorage.getItem(LS_CUSTOM_DEVICE_NAMES);
      const map = raw ? JSON.parse(raw) : {};
      if (name.trim()) {
        map[imei] = name.trim();
      } else {
        delete map[imei];
      }
      safeStorage.setItem(LS_CUSTOM_DEVICE_NAMES, JSON.stringify(map));
    } catch (_) {}
  }

  /** 更新账号自定义备注名 */
  public updateAccountLabel(phone: string, label: string): void {
    updateUserAccountLabel(phone, label);
  }

  /** 清空内存凭据 */
  private resetCredentials(): void {
    this.token = '';
    this.salt = '';
    this.sid = '336677';
    this.projectKey = '';
  }

  /** 某账号是否被标记为登录已失效 */
  public isAuthExpired(phone?: string): boolean {
    const p = phone || this.activePhone;
    return this.expiredAccounts.has(p);
  }

  /** 标记或清除某账号的失效状态 */
  public markAuthExpired(phone: string, expired = true): void {
    if (expired) {
      this.expiredAccounts.add(phone);
    } else {
      this.expiredAccounts.delete(phone);
    }
  }

  /** 某账号是否已持有可用凭据 */
  public hasAuth(phone?: string): boolean {
    const p = phone || this.activePhone;
    // safe storage
    try {
      let raw = safeStorage.getItem(lsAuthKey(p));
      if (!raw && PRESET_AUTH_TOKENS[p]) {
        const preset = PRESET_AUTH_TOKENS[p];
        this.saveAuth(preset.auth, preset.service, preset.profile, p);
        raw = safeStorage.getItem(lsAuthKey(p));
      }
      if (!raw) return false;
      const auth = JSON.parse(raw);
      return !!(auth && auth.token && auth.salt);
    } catch {
      return false;
    }
  }

  /** 返回全部已注册账号的运行时状态 */
  public getAccountStates(): AccountRuntimeState[] {
    const all = getAllRegisteredAccounts();
    return all.map(account => {
      const has = this.hasAuth(account.phone);
      const expired = has ? this.isAuthExpired(account.phone) : false;
      return {
        account,
        hasAuth: has,
        isExpired: expired,
        projectKey: this.readProjectKey(account.phone) || account.projectKey || '',
        active: account.phone === this.activePhone
      };
    });
  }

  /** 读取当前会话的用户 Profile */
  public getActiveProfile(): { name?: string; mobile?: string } | null {
    // safe storage
    try {
      const raw = safeStorage.getItem(lsProfileKey(this.activePhone));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private readProjectKey(phone: string): string {
    // safe storage
    return safeStorage.getItem(lsProjectKey(phone)) || '';
  }

  public writeProjectKey(phone: string, key: string): void {
    if (true) {
      safeStorage.setItem(lsProjectKey(phone), key);
    }
  }

  /** 通用存储自愈清洗器：启动时扫描并平滑迁移非 ASCII 历史脏键及空后缀截断键 */
  public sanitizeStorageKeys(): void {
    try {
      const hasNonAscii = (s: string) => /[^\x00-\x7F]/.test(s);
      let allKeys: string[] = [];

      // #ifdef MP-WEIXIN
      try {
        allKeys = uni.getStorageInfoSync().keys || [];
      } catch (_) {}
      // #endif
      // #ifndef MP-WEIXIN
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (k) allKeys.push(k);
        }
      }
      // #endif

      // 1. 非 ASCII 键名清洗与迁移
      for (const key of allKeys) {
        if (key.startsWith('airtrack_') && hasNonAscii(key)) {
          const val = safeStorage.getItem(key);
          const cleanKey = key.replace(/[^\x00-\x7F]+/g, 'master');
          if (val && !safeStorage.getItem(cleanKey)) {
            safeStorage.setItem(cleanKey, val);
          }
          safeStorage.removeItem(key);
        }
      }

      // 2. 截断产生的空后缀键清洗与迁移 (例如 airtrack_auth_, airtrack_service_, airtrack_project_, airtrack_profile_)
      const prefixRegex = /^airtrack_(auth|service|project|profile|projects_cache)_$/;
      for (const key of allKeys) {
        if (prefixRegex.test(key)) {
          const val = safeStorage.getItem(key);
          const cleanKey = key + 'master';
          if (val && !safeStorage.getItem(cleanKey)) {
            safeStorage.setItem(cleanKey, val);
          }
          safeStorage.removeItem(key);
        }
      }

      // 3. 账户注册实体表深度清洗与去重
      const rawAccounts = safeStorage.getItem('airtrack_user_accounts');
      if (rawAccounts) {
        try {
          const list = JSON.parse(rawAccounts);
          if (Array.isArray(list)) {
            const seenPhones = new Set<string>();
            const cleanList: any[] = [];
            for (const item of list) {
              if (!item) continue;
              let p = (item.phone || '').trim();
              if (!p || p === '主账号' || hasNonAscii(p)) {
                p = 'master';
                item.phone = 'master';
                if (!item.label) item.label = '官方授权主账号';
              }
              if (!seenPhones.has(p)) {
                seenPhones.add(p);
                cleanList.push(item);
              }
            }
            safeStorage.setItem('airtrack_user_accounts', JSON.stringify(cleanList));
          }
        } catch (_) {}
      }

      // 4. 活跃账号指针自愈
      const active = safeStorage.getItem(LS_ACTIVE_ACCOUNT);
      if (active && (active === '主账号' || hasNonAscii(active))) {
        safeStorage.setItem(LS_ACTIVE_ACCOUNT, 'master');
      }
    } catch (e) {
      console.warn('[Storage] sanitizeStorageKeys error', e);
    }
  }

  /** 从 localStorage 恢复当前账号凭据 */
  public loadFromStorage(): void {
    this.sanitizeStorageKeys();

    try {
      const storedActive = safeStorage.getItem(LS_ACTIVE_ACCOUNT);
      if (storedActive && storedActive.trim() && !/[^\x00-\x7F]/.test(storedActive) && storedActive.trim() !== '主账号') {
        this.activePhone = storedActive.trim();
      } else {
        const all = getAllRegisteredAccounts();
        this.activePhone = all.length > 0 && all[0].phone ? all[0].phone : 'master';
      }
    } catch { /* ignore */ }

    // 历史空后缀凭据自愈迁移（将无手机号的临时授权资产平滑归集至主账号）
    if (!safeStorage.getItem(lsAuthKey(this.activePhone)) && safeStorage.getItem('airtrack_auth_')) {
      const legacyAuth = safeStorage.getItem('airtrack_auth_');
      const legacyServ = safeStorage.getItem('airtrack_service_');
      const legacyProj = safeStorage.getItem('airtrack_project_');
      if (legacyAuth) safeStorage.setItem(lsAuthKey(this.activePhone), legacyAuth);
      if (legacyServ) safeStorage.setItem(lsServiceKey(this.activePhone), legacyServ);
      if (legacyProj) safeStorage.setItem(lsProjectKey(this.activePhone), legacyProj);
    }

    // 若当前账号尚无本地凭据，优先从预置凭据库自愈补齐
    if (!safeStorage.getItem(lsAuthKey(this.activePhone)) && PRESET_AUTH_TOKENS[this.activePhone]) {
      const preset = PRESET_AUTH_TOKENS[this.activePhone];
      this.saveAuth(preset.auth, preset.service, preset.profile, this.activePhone);
    }

    try {
      const authStr = safeStorage.getItem(lsAuthKey(this.activePhone));
      if (authStr) {
        const auth = JSON.parse(authStr);
        if (auth && auth.token && auth.salt) {
          this.token = auth.token;
          this.salt = auth.salt;
        }
      }
      const servStr = safeStorage.getItem(lsServiceKey(this.activePhone));
      if (servStr) {
        const serv = JSON.parse(servStr);
        if (serv && serv.sid) this.sid = serv.sid;
      }
      this.projectKey = this.readProjectKey(this.activePhone) || this.getActiveAccount().projectKey || '';
    } catch (e) {
      console.warn('[AirCloud] loadFromStorage error', e);
    }
  }

  /** 保存认证凭据并自动注册账号 */
  public saveAuth(auth: any, service: any, profile?: any, phone?: string): void {
    const p = phone || this.activePhone;
    // safe storage

    if (p === this.activePhone) {
      if (auth) {
        this.token = auth.token;
        this.salt = auth.salt;
      }
      if (service) this.sid = service.sid;
    }

    if (auth) {
      this.markAuthExpired(p, false);
      safeStorage.setItem(lsAuthKey(p), JSON.stringify(auth));
    }
    if (service) safeStorage.setItem(lsServiceKey(p), JSON.stringify(service));
    if (profile) safeStorage.setItem(lsProfileKey(p), JSON.stringify(profile));

    // 自动纳入已注册账号列表
    registerUserAccount({ phone: p });
  }

  /** 手动直接导入凭据（开发者与高级用户通道） */
  public manualImportAuth(phone: string, token: string, salt: string, sid: string, projectKey?: string): void {
    this.saveAuth({ token, salt }, { sid }, {}, phone);
    if (projectKey) {
      this.writeProjectKey(phone, projectKey);
    }
    this.setActiveAccount(phone);
  }

  /**
   * 接入合宙官方宿主环境通过 URL 注入的凭据会话
   * 遵循官方《网页工具规则》第 7~8 节硬性契约
   */
  public applyHostInjectedSession(session: HostInjectedSession): string {
    const tokenHash = session.token.slice(-6).toUpperCase();
    const phone = session.phone ? session.phone.trim() : `host_${tokenHash}`;
    const label = session.name ? session.name.trim() : `官方宿主 (${tokenHash})`;

    // 1. 保存真实通信凭据（严格对齐既有签名）
    this.saveAuth(
      { token: session.token, salt: session.salt },
      { sid: session.sid },
      session.name ? { name: session.name } : {},
      phone
    );

    // 2. 登记到用户账户池
    registerUserAccount({
      phone,
      label
    });

    // 3. 激活为当前账号
    this.setActiveAccount(phone);

    return phone;
  }

  /** 清除某账号登录凭据 */
  public clearAuth(phone?: string): void {
    const p = phone || this.activePhone;
    this.markAuthExpired(p, false);
    // safe storage
    safeStorage.removeItem(lsAuthKey(p));
    safeStorage.removeItem(lsServiceKey(p));
    safeStorage.removeItem(lsProfileKey(p));
    if (p === this.activePhone) {
      this.token = '';
      this.salt = '';
    }
  }

  // ============================ OAuth 登录 ============================

  /**
   * 发起官方 OAuth 授权跳转
   */
  public buildOAuthUrl(phone: string, currentHref: string): string {
    if (true) {
      safeStorage.setItem(LS_PENDING_ACCOUNT, phone);
    }

    // 确定回调地址：
    // 来源明确声明：Android 原生客户端透传 from=android，微信小程序透传 from=mp，Web/本地调试透传 from=web
    let callbackUrl = 'https://ocean1798.github.io/Air8202G-AirTrack-Pro/oauth-callback.html?from=web';

    // #ifdef MP-WEIXIN
    callbackUrl = 'https://ocean1798.github.io/Air8202G-AirTrack-Pro/oauth-callback.html?from=mp';
    // #endif

    // #ifndef MP-WEIXIN
    const isNativeAndroid = typeof window !== 'undefined' && (
      Capacitor.isNativePlatform() ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:'
    );

    if (isNativeAndroid) {
      // 原生 Android App 必须重定向至公网并显式声明 from=android 以便中转页自动拉起 deepLink
      callbackUrl = 'https://ocean1798.github.io/Air8202G-AirTrack-Pro/oauth-callback.html?from=android';
    } else if (typeof window !== 'undefined' && window.location.origin) {
      try {
        const origin = window.location.origin;
        const pathname = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        // 本地环境 (localhost/127.0.0.1) 外部浏览器无法直连 localhost，仍需使用公网中转页但标明 from=web
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          callbackUrl = 'https://ocean1798.github.io/Air8202G-AirTrack-Pro/oauth-callback.html?from=web';
        } else {
          callbackUrl = `${origin}${pathname}oauth-callback.html?from=web`;
        }
      } catch (e) {
        callbackUrl = 'https://ocean1798.github.io/Air8202G-AirTrack-Pro/oauth-callback.html?from=web';
      }
    }
    // #endif

    return `${OFFICIAL_API_CONFIG.oauthAuthorizeUrl}?return_to=${encodeURIComponent(callbackUrl)}`;
  }

  /**
   * 判断账号是否属于官方公开演示节点
   */
  public isDemoAccount(phone?: string): boolean {
    const p = phone || this.activePhone;
    return DEMO_ACCOUNTS.some(a => a.phone === p);
  }

  /**
   * 当官方演示节点遭遇外部并发占用时，自动尝试故障转移至池中下一个空闲节点
   * @returns 成功转移的新手机号，若无候选则返回 null
   */
  public tryFailoverDemoAccount(): string | null {
    if (!this.isDemoAccount(this.activePhone)) return null;
    const demoPhones = DEMO_ACCOUNTS.map(a => a.phone);
    const currentIndex = demoPhones.indexOf(this.activePhone);
    if (currentIndex === -1) return null;

    // 优先寻找池中持有已缓存有效凭据的备用节点
    for (let i = 1; i < demoPhones.length; i++) {
      const candidate = demoPhones[(currentIndex + i) % demoPhones.length];
      const authStr = typeof window !== 'undefined' && window.localStorage
        ? safeStorage.getItem(lsAuthKey(candidate))
        : null;
      if (authStr) {
        try {
          const parsed = JSON.parse(authStr);
          if (parsed && parsed.token && parsed.salt) {
            this.setActiveAccount(candidate);
            return candidate;
          }
        } catch (_) {}
      }
    }

    // 若无已存凭据，循环切到下一个候选节点以尝试拉取本地时序档案
    const nextCandidate = demoPhones[(currentIndex + 1) % demoPhones.length];
    this.setActiveAccount(nextCandidate);
    return nextCandidate;
  }

  /**
   * 从用户输入（可能为纯 Token，也可能是完整回调链接如 ...?token=xxx&...）中提取干净的 Token
   */
  public extractToken(input: string): string {
    const raw = (input || '').trim();
    if (!raw) return '';
    let candidate = raw;
    if (raw.includes('token=')) {
      try {
        const match = raw.match(/[?&#](?:oauth_)?token=([^&#]+)/);
        if (match && match[1]) {
          candidate = decodeURIComponent(match[1]).trim();
        }
      } catch (e) {}
    }
    // 严格结构断言：必须满足纯英数/下划线/中划线/点号且长度 >= 60
    if (/^[A-Za-z0-9_\-\.]{60,}$/.test(candidate)) {
      return candidate;
    }
    return '';
  }

  public consumePendingAccount(): string | null {
    // safe storage
    const p = safeStorage.getItem(LS_PENDING_ACCOUNT);
    if (p) safeStorage.removeItem(LS_PENDING_ACCOUNT);
    return p;
  }

  /** 使用 OAuth token 完成授权验证 */
  public async exchangeOAuthToken(oauthToken: string, phone?: string): Promise<{ ok: boolean; message?: string; accountPhone?: string }> {
    // 关键防冒名：只有显式传入合法的已知手机号/标识时才针对该卡片刷新，严禁拿 activePhone 兜底
    const explicitTarget = phone && phone.trim() ? phone.trim() : '';
    try {
      const url = `${OFFICIAL_API_CONFIG.oauthLoginApi}?token=${encodeURIComponent(oauthToken)}`;
      const res = await httpPlatformRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const data = await res.json();
      if (data && data.code === 0 && data.value) {
        const profile = data.value.profile || {};
        const realMobile = String(profile.mobile || profile.phone || '').trim();
        let finalPhone = '';
        if (realMobile && /^\d{11}$/.test(realMobile)) {
          finalPhone = realMobile;
        } else if (explicitTarget) {
          finalPhone = explicitTarget;
        } else {
          // 官方换票不给手机号且无显式预设时：分配独立唯一纯 ASCII 标识，决不冒名覆盖已有旧账号
          const tokenHash = data.value.auth?.token
            ? String(data.value.auth.token).slice(-6).toUpperCase()
            : Math.random().toString(36).slice(-6).toUpperCase();
          finalPhone = `master_${tokenHash}`;
        }
        if (!finalPhone || finalPhone === '') finalPhone = 'master';

        registerUserAccount({
          phone: finalPhone,
          label: ''
        });
        this.saveAuth(data.value.auth, data.value.service, data.value.profile, finalPhone);
        this.markAuthExpired(finalPhone, false);

        // 核心时序：必须先设为当前激活账号，使内存 token/salt/sid 与 activePhone 统一指向新凭据
        this.setActiveAccount(finalPhone);

        // 核心强刷：强制向云端拉取该账号专属最新的第一个 projectKey，抹除旧缓存
        await this.forceRefreshProjectKey(finalPhone);

        return { ok: true, accountPhone: finalPhone };
      }
      const errMsg = typeof data?.value === 'string' ? data.value : (data?.info || 'Token 已失效或已被消费');
      console.warn('[AirCloud] exchangeOAuthToken rejected', data?.code, data?.value);
      return { ok: false, message: errMsg };
    } catch (e: any) {
      console.error('[AirCloud] exchangeOAuthToken failed', e);
      const msg = e?.message || '网络请求失败';
      if (msg.includes('domain list') || msg.includes('fail url not')) {
        return { ok: false, message: '真机未开启调试模式：请点小程序右上角 [...] 开启调试' };
      }
      return { ok: false, message: msg };
    }
  }

  // ============================ 项目管理 ============================

  /**
   * 官方标准端点：获取我的标准模块“合宙标准模块”的项目Key (见《AirCloud接口文档.md》第 102 行)
   * 用于空项目或换票无项目时的标准权威兜底
   */
  public async getDefaultProjectKey(customCreds?: { token: string; salt: string; sid?: string }): Promise<string> {
    try {
      let resp: any;
      if (customCreds && customCreds.token) {
        resp = await this.rawPostApi('/get_my_default_project_key', {}, {
          token: customCreds.token,
          salt: customCreds.salt,
          sid: customCreds.sid || '336677'
        }, 5000);
      } else {
        resp = await this.postApi('/get_my_default_project_key', {});
      }

      if (resp && resp.code === 0 && resp.value) {
        return String(resp.value).trim();
      }
    } catch (e) {
      console.warn('[LuatClient] Failed to fetch default project key:', e);
    }
    return '';
  }

  public async listProjects(): Promise<Array<{ name: string; project_key: string }>> {
    this.loadFromStorage();
    try {
      const resp = await this.postApi('/list_my_projects', { page: 1, size: 50 });
      if (resp && resp.code === 0 && Array.isArray(resp.value)) {
        if (resp.value.length === 0) {
          // 官方默认工程密钥兜底
          const defaultKey = await this.getDefaultProjectKey();
          if (defaultKey) {
            const fallbackProjects = [{ name: '合宙标准模块', project_key: defaultKey }];
            safeStorage.setItem(LS_PROJECTS_CACHE + (this.activePhone || 'master'), JSON.stringify(fallbackProjects));
            return fallbackProjects;
          }
        }
        safeStorage.setItem(LS_PROJECTS_CACHE + (this.activePhone || 'master'), JSON.stringify(resp.value));
        return resp.value;
      }
    } catch (_) {}
    return this.getCachedProjects();
  }

  public getCachedProjects(): Array<{ name: string; project_key: string }> {
    this.loadFromStorage();
    try {
      const raw = safeStorage.getItem(LS_PROJECTS_CACHE + (this.activePhone || 'master'));
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  }

  /** 强制强刷指定账号的最新项目密钥（彻底绕过只读缓存短路） */
  public async forceRefreshProjectKey(phone?: string): Promise<string> {
    const targetPhone = phone || this.activePhone;
    try {
      // 1. 抹除该账号历史旧项目缓存
      safeStorage.removeItem(LS_PROJECTS_CACHE + (targetPhone || 'master'));
      this.writeProjectKey(targetPhone, '');
      if (targetPhone === this.activePhone) {
        this.projectKey = '';
      }

      let projects: Array<{ name: string; project_key: string }> = [];
      if (targetPhone === this.activePhone) {
        projects = await this.listProjects();
      } else {
        // 跨账号强刷：使用 targetPhone 专属凭据通过 rawPostApi 进行隔离查询，绝不串台
        const creds = this.getCredentialsForPhone(targetPhone);
        if (creds && creds.token && creds.salt) {
          const pResp = await this.rawPostApi('/list_my_projects', { page: 1, size: 50 }, creds, 5000);
          if (pResp && pResp.code === 0 && Array.isArray(pResp.value)) {
            projects = pResp.value;
          }
          if (!projects || projects.length === 0) {
            const defaultKey = await this.getDefaultProjectKey(creds);
            if (defaultKey) {
              projects = [{ name: '合宙标准模块', project_key: defaultKey }];
            }
          }
        }
      }

      if (Array.isArray(projects) && projects.length > 0) {
        const freshKey = projects[0].project_key || '';
        if (freshKey) {
          this.writeProjectKey(targetPhone, freshKey);
          if (targetPhone === this.activePhone) {
            this.projectKey = freshKey;
          }
          return freshKey;
        }
      }
    } catch (e) {
      console.warn('[AirCloud] forceRefreshProjectKey failed', e);
    }
    return '';
  }

  public async ensureProjectKey(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.projectKey) return this.projectKey;
    if (forceRefresh) {
      return this.forceRefreshProjectKey();
    }
    try {
      const projects = await this.listProjects();
      if (projects.length > 0) {
        this.projectKey = projects[0].project_key;
        this.writeProjectKey(this.activePhone, this.projectKey);
        return this.projectKey;
      }
    } catch (e) {
      const account = this.getActiveAccount();
      if (account.projectKey) {
        this.projectKey = account.projectKey;
        this.writeProjectKey(this.activePhone, this.projectKey);
      }
    }
    return this.projectKey;
  }

  // ============================ 网关请求 ============================

  public async postApi(endpoint: string, payload: Record<string, any>): Promise<any> {
    this.loadFromStorage();
    const url = `${OFFICIAL_API_CONFIG.gateway}/${endpoint.replace(/^\//, '')}`;
    const headers: Record<string, string> = {
      'authorization': this.token,
      'salt': this.salt,
      'sid': this.sid,
      'Content-Type': 'application/json'
    };

    const res = await httpPlatformRequest(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.code === 105 || (typeof json.value === 'string' && json.value.includes('auth failed'))) {
      this.markAuthExpired(this.activePhone, true);
      console.warn('[AirCloud] 登录态失效（Code 105 或 auth failed）', json.value);
    } else if (json.code === 0) {
      this.markAuthExpired(this.activePhone, false);
    }
    return json;
  }

  // ============================ 业务数据与离线缓存 ============================

  /**
   * 拉取设备清单：优先云端，云端受阻或未登录时从本地 IndexedDB 恢复
   */
  public async getDeviceList(): Promise<DeviceInfo[]> {
    const currentReqPhone = this.activePhone;
    if (!currentReqPhone) {
      return [];
    }

    // 1. 若当前未授权或离线，尝试直接加载本地已持久化档案
    if (!this.hasAuth(currentReqPhone)) {
      const cached = await db.getDeviceProfiles(currentReqPhone);
      if (cached.length > 0) {
        this.probedDeviceCounts.set(currentReqPhone, cached.length);
        return this.profilesToDeviceInfos(cached);
      }
      throw new AuthExpiredError('当前空间尚未授权');
    }

    try {
      await this.ensureProjectKey();

      let resp = await this.postApi('/list_my_devices', {
        project: this.projectKey,
        page: 1,
        size: 50
      });

      if (resp && (resp.code === 105 || (typeof resp.value === 'string' && resp.value.includes('auth failed')))) {
        this.markAuthExpired(this.activePhone, true);
        throw new AuthExpiredError('登录鉴权已失效，请重新授权');
      }

      // 自愈防线：若拉取非正常响应（如密钥失效或跨账号残留），强制强刷重试一次
      if (!(resp && resp.code === 0 && resp.value && Array.isArray(resp.value.records))) {
        const freshKey = await this.forceRefreshProjectKey(currentReqPhone);
        if (freshKey) {
          resp = await this.postApi('/list_my_devices', {
            project: freshKey,
            page: 1,
            size: 50
          });
        }
      }

      if (!(resp && resp.code === 0 && resp.value && Array.isArray(resp.value.records))) {
        throw new Error(resp && typeof resp.value === 'string' ? resp.value : '设备清单拉取失败');
      }

      const records = resp.value.records;

      const hints = this.getActiveAccount().nameHints || {};
      const devices: DeviceInfo[] = [];
      const toCache: StoredDeviceProfile[] = [];

      for (const item of records) {
        const imei: string = item.deviceid || item.deviceId;
        let latestLoc: any = null;

        try {
          const locResp = await this.postApi('/aircloud/latest_location', { client_id: imei });
          if (locResp && locResp.code === 0 && locResp.value) {
            latestLoc = locResp.value;
          }
        } catch (_) {}

        const rawLat = latestLoc ? parseFloat(latestLoc.lat) : null;
        const rawLng = latestLoc ? parseFloat(latestLoc.lng) : null;
        const hasCoord = typeof rawLat === 'number' && !isNaN(rawLat) && typeof rawLng === 'number' && !isNaN(rawLng);

        // 官方行业规范：物联网设备无常驻长连接，按最后上报时间差判定（5分钟内有数据包上报视为在线，否则为离线）
        let isOnline = false;
        let lastReportMs = 0;
        if (latestLoc?.time) {
          lastReportMs = new Date(String(latestLoc.time).replace(/-/g, '/')).getTime();
          if (!isNaN(lastReportMs)) {
            // 5 分钟（300,000ms）心跳窗口
            isOnline = (Date.now() - lastReportMs) <= 5 * 60 * 1000;
          }
        }
        if (item.status === 'online' || latestLoc?.status === 'online') {
          isOnline = true;
        }

        const customName = this.getCustomDeviceName(imei);
        const defaultName = customName || hints[imei]?.name || `终端·${imei.slice(-5)}`;
        const shortName = customName || hints[imei]?.shortName || `终端${imei.slice(-5)}`;
        const address = latestLoc?.address || '未上报物理定位';
        const lastActiveTime = latestLoc?.time || item.last_time || item.created_at || '—';

        // 兼容合宙最新定位接口的 signal 与历史 val_782 字段
        const rawCsq = latestLoc?.signal ?? latestLoc?.val_782 ?? latestLoc?.csq ?? 0;
        const csq = parseInt(String(rawCsq), 10) || 0;
        const signalLevelText = isOnline ? getSignalLevelText(csq) : "无";

        // 供电与电量换算：优先官方 percent，若无则由 val_799 毫伏值通过锂电曲线换算
        const voltageMv = latestLoc?.val_799 ? parseInt(latestLoc.val_799, 10) : 0;
        let battPct: number | undefined = undefined;
        if (latestLoc?.percent !== undefined && latestLoc.percent !== null && latestLoc.percent !== "") {
          battPct = parseInt(String(latestLoc.percent), 10);
        } else if (voltageMv > 0) {
          battPct = voltageToPercentage(voltageMv);
        }

        // 相对时间与格式化大地坐标
        const relativeTime = formatRelativeTime(lastActiveTime);
        const coordText = hasCoord ? `${rawLat!.toFixed(5)}, ${rawLng!.toFixed(5)}` : "暂无定位";

        const dev: DeviceInfo = {
          imei,
          name: defaultName,
          shortName,
          online: !!isOnline,
          lastActiveTime,
          relativeTime,
          coordText,
          battPct,
          signalLevelText,
          fixType: latestLoc?.val_512 ? "GPS" : (hasCoord ? "GPS" : "基站"),
          satCount: latestLoc?.val_515 ? parseInt(latestLoc.val_515, 10) : undefined,
          tempC: latestLoc?.val_256 ? parseFloat(latestLoc.val_256) : undefined,
          lat: hasCoord ? rawLat : null,
          lng: hasCoord ? rawLng : null,
          gcjLat: hasCoord ? rawLat : null,
          gcjLng: hasCoord ? rawLng : null,
          speed: latestLoc?.speed ? parseFloat(latestLoc.speed) : 0,
          voltageMv,
          csq,
          firmwareVersion: "Air8202G",
          address
        };
        devices.push(dev);

        toCache.push({
          imei,
          accountPhone: currentReqPhone,
          name: defaultName,
          status: isOnline ? "在线" : "离线",
          csq: `CSQ ${dev.csq}`,
          battMv: dev.voltageMv ? `${dev.voltageMv} mV` : "—",
          battPct: battPct ?? 0,
          lat: dev.lat,
          lng: dev.lng,
          latestTime: lastActiveTime,
          address,
          updatedAt: Date.now()
        });
      }

      // 写入本地持久化
      await db.putDeviceProfiles(toCache);
      this.probedDeviceCounts.set(currentReqPhone, devices.length);
      devices.sort((a, b) => String(b.lastActiveTime).localeCompare(String(a.lastActiveTime)));
      return devices;
    } catch (err) {
      // 网络或鉴权失败时，安全回退到本地离线档案
      const cached = await db.getDeviceProfiles(currentReqPhone);
      if (cached.length > 0) {
        this.probedDeviceCounts.set(currentReqPhone, cached.length);
        return this.profilesToDeviceInfos(cached);
      }
      throw err;
    }
  }

  private profilesToDeviceInfos(profiles: StoredDeviceProfile[]): DeviceInfo[] {
    return profiles.map(p => {
      const csqNum = parseInt(p.csq.replace(/\D/g, ""), 10) || 0;
      const isOnline = p.status === "在线";
      const hasCoord = typeof p.lat === "number" && typeof p.lng === "number" && !isNaN(p.lat) && !isNaN(p.lng);
      return {
        imei: p.imei,
        name: p.name,
        shortName: p.name.slice(-7),
        online: isOnline,
        lastActiveTime: p.latestTime,
        relativeTime: formatRelativeTime(p.latestTime),
        coordText: hasCoord ? `${Number(p.lat).toFixed(5)}, ${Number(p.lng).toFixed(5)}` : "暂无定位",
        battPct: p.battPct ?? (parseInt(p.battMv, 10) ? voltageToPercentage(parseInt(p.battMv, 10)) : undefined),
        signalLevelText: isOnline ? getSignalLevelText(csqNum) : "无",
        lat: p.lat,
        lng: p.lng,
        gcjLat: p.lat,
        gcjLng: p.lng,
        speed: 0,
        voltageMv: parseInt(p.battMv, 10) || 0,
        csq: csqNum,
        address: p.address || "未上报物理定位"
      };
    });
  }

  public deriveSpeedsForTrackPoints(points: StoredTrackPoint[]): StoredTrackPoint[] {
    if (!points || points.length === 0) return [];
    // 确保按时序单调递增
    const sorted = [...points].sort((a, b) => a.timestamp - b.timestamp);
    const n = sorted.length;
    if (n === 1) {
      sorted[0].speed = sorted[0].speed || 0;
      return sorted;
    }

    const rawSpeeds: number[] = new Array(n).fill(0);

    for (let i = 1; i < n; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const dt = (cur.timestamp - prev.timestamp) / 1000; // 秒

      if (dt <= 0) {
        rawSpeeds[i] = 0;
        continue;
      }

      // 扁平投影物理球面距离（米）
      const radLat = (cur.lat * Math.PI) / 180;
      const dLat = (cur.lat - prev.lat) * 111000;
      const dLng = (cur.lng - prev.lng) * 111000 * Math.cos(radLat);
      const dist = Math.sqrt(dLat * dLat + dLng * dLng);

      // 1. 静态漂移过滤：位移小于 5 米视为 GNSS 静态噪声
      if (dist < 5.0) {
        rawSpeeds[i] = 0;
        continue;
      }

      // 2. 长跨度断点保护：若时间跨度大于 600 秒（10分钟），说明中途熄火或长时间未上报
      // 若位移较大，不按漫长时间稀释，而是按合理速度区间限制
      if (dt > 600) {
        rawSpeeds[i] = Math.min(35.0, Math.max(5.0, parseFloat(((dist / Math.min(dt, 60)) * 3.6).toFixed(1))));
        continue;
      }

      // 3. 正常时间跨度速度推导
      const calcSpeed = (dist / dt) * 3.6; // km/h

      // 速度小于 2.0 km/h 视为行人微颤或静止
      if (calcSpeed < 2.0) {
        rawSpeeds[i] = 0;
      } else {
        // 限速 120 km/h，排除跨越基站的超大异常漂移噪点
        rawSpeeds[i] = Math.min(120.0, parseFloat(calcSpeed.toFixed(1)));
      }
    }

    // 起始点速度平滑对齐
    rawSpeeds[0] = rawSpeeds[1] > 0 ? parseFloat((rawSpeeds[1] * 0.6).toFixed(1)) : 0;

    // 4. 三点滑动加权平滑滤波，消除突跳噪点
    for (let i = 0; i < n; i++) {
      let smoothed = rawSpeeds[i];
      if (i > 0 && i < n - 1) {
        const p = rawSpeeds[i - 1];
        const c = rawSpeeds[i];
        const next = rawSpeeds[i + 1];
        if (c > 50 && p < 20 && next < 20) {
          smoothed = Math.max(p, next);
        } else {
          smoothed = parseFloat((p * 0.25 + c * 0.5 + next * 0.25).toFixed(1));
        }
      }
      sorted[i].speed = smoothed;
    }

    return sorted;
  }

  /**
   * 真实拉取设备历史轨迹（增量同步 + 本地时序库检索）
   */
  public async getHistoricalTrack(
    imei: string,
    scope: string = '90d',
    customStart?: string,
    customEnd?: string,
    forceCloud = true
  ): Promise<TrackPoint[]> {
    if (!this.activePhone) {
      return [];
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const { startMs, endMs, isMultiDay, startDate, endDate } = calculateScopeWindow(scope, customStart, customEnd);

    // 1. 若具有鉴权凭据，且要求强制拉取云端，先执行云端分页同步
    if (this.hasAuth() && forceCloud) {
      try {
        const fetchedStored: StoredTrackPoint[] = [];

        for (let page = 1; page <= 5; page++) {
          if (page > 1) await new Promise(r => setTimeout(r, 200));

          const resp = await this.postApi('/aircloud/location_history', {
            client_id: imei,
            start: fmt(startDate),
            end: fmt(endDate),
            page,
            size: 500
          });

          if (resp && resp.code === 105) throw new AuthExpiredError();
          if (resp && resp.code === 0 && resp.value && Array.isArray(resp.value.records)) {
            const records = resp.value.records;
            for (const p of records) {
              const lat = parseFloat(p.lat);
              const lng = parseFloat(p.lng);
              if (isNaN(lat) || isNaN(lng)) continue;
              const curMs = new Date(String(p.time).replace(/-/g, '/')).getTime();

              fetchedStored.push({
                key: `${imei}_${curMs}`,
                accountPhone: this.activePhone,
                imei,
                timestamp: curMs,
                timeStr: String(p.time),
                lat,
                lng,
                wlat: p.wlat ? parseFloat(p.wlat) : undefined,
                wlng: p.wlng ? parseFloat(p.wlng) : undefined,
                speed: p.speed ? parseFloat(p.speed) : 0,
                address: p.address
              });
            }
            const totalPages = parseInt(resp.value.pages, 10) || 1;
            if (page >= totalPages || records.length === 0) break;
          } else {
            break;
          }
        }

        if (fetchedStored.length > 0) {
          const withSpeeds = this.deriveSpeedsForTrackPoints(fetchedStored);
          await db.putTrackPoints(withSpeeds);
        }
      } catch (e) {
        if (e instanceof AuthExpiredError) throw e;
        console.warn(`[AirCloud] Incremental track fetch failed for ${imei}`, e);
      }
    }

    // 2. 从本地时序库检索出当前指定时间窗口内的全部点位
    const finalPoints = await db.getTrackPointsByRange(this.activePhone, imei, startMs, endMs);
    let withDerivedSpeeds = finalPoints;
    const allZeroSpeed = finalPoints.length >= 2 && finalPoints.every(p => !p.speed || p.speed === 0);
    if (allZeroSpeed) {
      withDerivedSpeeds = this.deriveSpeedsForTrackPoints(finalPoints);
      db.putTrackPoints(withDerivedSpeeds).catch(() => {});
    }

    return withDerivedSpeeds.map((p, idx) => ({
      index: idx,
      lat: p.lat,
      lng: p.lng,
      gcjLat: p.lat,
      gcjLng: p.lng,
      speed: p.speed || 0,
      timeStr: p.timeStr,
      timestamp: p.timestamp,
      isMultiDay
    }));
  }

  /**
   * 拉取设备传感器遥测数据 (Tag 799, 782, 1293)
   */
  public async getRealTagTelemetry(imei: string): Promise<any> {
    if (!this.hasAuth()) return null;
    try {
      const resp = await this.postApi('/aircloud/list_by_tags', {
        client_id: imei,
        tags: [OfficialTags.BATTERY_MV, OfficialTags.CSQ, OfficialTags.IMU_ACCEL],
        page: 1,
        size: 5
      });
      if (resp && resp.code === 0 && resp.value && Array.isArray(resp.value.records) && resp.value.records.length > 0) {
        return resp.value.records[0];
      }
    } catch (_) {}
    return null;
  }
}

export const apiClient = AirCloudClient.getInstance();
