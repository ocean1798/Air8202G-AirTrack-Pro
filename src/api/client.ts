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
import type { AccountDef } from './accounts';
import { db, type StoredTrackPoint, type StoredDeviceProfile } from '../utils/db';
import { voltageToPercentage } from '../utils/battery-model';

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

  public getProbedDeviceCount(phone: string): number | undefined {
    return this.probedDeviceCounts.get(phone);
  }

  /**
   * 独立凭据获取辅助方法：获取指定手机号独立凭据，避免单例污染
   */
  public getCredentialsForPhone(phone: string): { token: string; salt: string; sid: string; projectKey: string } | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    let token = '';
    let salt = '';
    let sid = '336677';
    let projectKey = this.readProjectKey(phone) || '';

    try {
      const authStr = window.localStorage.getItem(lsAuthKey(phone));
      if (authStr) {
        const auth = JSON.parse(authStr);
        if (auth?.token && auth?.salt) {
          token = auth.token;
          salt = auth.salt;
        }
      }
      const servStr = window.localStorage.getItem(lsServiceKey(phone));
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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
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

      const dResp = await this.rawPostApi('/list_my_devices', {
        project: projectKey,
        page: 1,
        size: 50
      }, creds, 5000);

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
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LS_ACTIVE_ACCOUNT, phone);
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
    if (typeof window === 'undefined' || !window.localStorage) return '';
    try {
      const raw = localStorage.getItem(LS_CUSTOM_DEVICE_NAMES);
      if (raw) {
        const map = JSON.parse(raw);
        return map[imei] || '';
      }
    } catch (_) {}
    return '';
  }

  /** 设置用户本地自定义设备名称 */
  public setCustomDeviceName(imei: string, name: string): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(LS_CUSTOM_DEVICE_NAMES);
      const map = raw ? JSON.parse(raw) : {};
      if (name.trim()) {
        map[imei] = name.trim();
      } else {
        delete map[imei];
      }
      localStorage.setItem(LS_CUSTOM_DEVICE_NAMES, JSON.stringify(map));
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
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      let raw = window.localStorage.getItem(lsAuthKey(p));
      if (!raw && PRESET_AUTH_TOKENS[p]) {
        const preset = PRESET_AUTH_TOKENS[p];
        this.saveAuth(preset.auth, preset.service, preset.profile, p);
        raw = window.localStorage.getItem(lsAuthKey(p));
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
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(lsProfileKey(this.activePhone));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private readProjectKey(phone: string): string {
    if (typeof window === 'undefined' || !window.localStorage) return '';
    return window.localStorage.getItem(lsProjectKey(phone)) || '';
  }

  public writeProjectKey(phone: string, key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(lsProjectKey(phone), key);
    }
  }

  /** 从 localStorage 恢复当前账号凭据 */
  public loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const storedActive = window.localStorage.getItem(LS_ACTIVE_ACCOUNT);
      if (storedActive) {
        this.activePhone = storedActive;
      }
    } catch { /* ignore */ }

    // 若当前账号尚无本地凭据，优先从预置凭据库自愈补齐
    if (!window.localStorage.getItem(lsAuthKey(this.activePhone)) && PRESET_AUTH_TOKENS[this.activePhone]) {
      const preset = PRESET_AUTH_TOKENS[this.activePhone];
      this.saveAuth(preset.auth, preset.service, preset.profile, this.activePhone);
    }

    try {
      const authStr = window.localStorage.getItem(lsAuthKey(this.activePhone));
      if (authStr) {
        const auth = JSON.parse(authStr);
        if (auth && auth.token && auth.salt) {
          this.token = auth.token;
          this.salt = auth.salt;
        }
      }
      const servStr = window.localStorage.getItem(lsServiceKey(this.activePhone));
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
    if (typeof window === 'undefined' || !window.localStorage) return;

    if (p === this.activePhone) {
      if (auth) {
        this.token = auth.token;
        this.salt = auth.salt;
      }
      if (service) this.sid = service.sid;
    }

    if (auth) {
      this.markAuthExpired(p, false);
      window.localStorage.setItem(lsAuthKey(p), JSON.stringify(auth));
    }
    if (service) window.localStorage.setItem(lsServiceKey(p), JSON.stringify(service));
    if (profile) window.localStorage.setItem(lsProfileKey(p), JSON.stringify(profile));

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

  /** 清除某账号登录凭据 */
  public clearAuth(phone?: string): void {
    const p = phone || this.activePhone;
    this.markAuthExpired(p, false);
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(lsAuthKey(p));
    window.localStorage.removeItem(lsServiceKey(p));
    window.localStorage.removeItem(lsProfileKey(p));
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
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LS_PENDING_ACCOUNT, phone);
    }

    // 精确判定：Capacitor 原生平台、本地回环、或者非标准 http/https 协议环境
    const isNativeOrLocal = typeof window !== 'undefined' && (
      Capacitor.isNativePlatform() ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      !window.location.protocol.startsWith('http')
    );

    // 确定回调地址：
    // 原生 App 与本地环境必须重定向至已部署的公网高可用中转页
    // 严禁将 http://localhost 传给外部浏览器作为回调，否则 Android 外部浏览器访问本机将报 ERR_CONNECTION_REFUSED
    let callbackUrl = 'https://ocean1798.github.io/Air8202G-AirTrack-Pro/oauth-callback.html';
    if (!isNativeOrLocal && typeof window !== 'undefined' && window.location.origin) {
      try {
        const origin = window.location.origin;
        const pathname = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        callbackUrl = `${origin}${pathname}oauth-callback.html`;
      } catch (e) {
        callbackUrl = 'https://ocean1798.github.io/Air8202G-AirTrack-Pro/oauth-callback.html';
      }
    }

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
        ? window.localStorage.getItem(lsAuthKey(candidate))
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
    if (raw.includes('token=')) {
      try {
        const match = raw.match(/[?&#]token=([^&#]+)/);
        if (match && match[1]) {
          return decodeURIComponent(match[1]);
        }
      } catch (e) {}
    }
    return raw;
  }

  public consumePendingAccount(): string | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const p = window.localStorage.getItem(LS_PENDING_ACCOUNT);
    if (p) window.localStorage.removeItem(LS_PENDING_ACCOUNT);
    return p;
  }

  /** 使用 OAuth token 完成授权验证 */
  public async exchangeOAuthToken(oauthToken: string, phone?: string): Promise<boolean> {
    const target = phone || this.activePhone;
    try {
      const url = `${OFFICIAL_API_CONFIG.oauthLoginApi}?token=${encodeURIComponent(oauthToken)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      const data = await res.json();
      if (data && data.code === 0 && data.value) {
        const profile = data.value.profile || {};
        const realMobile = String(profile.mobile || profile.phone || profile.user || target || '').trim();
        const finalPhone = realMobile && /^\d{11}$/.test(realMobile) ? realMobile : target;
        registerUserAccount({ phone: finalPhone });
        this.saveAuth(data.value.auth, data.value.service, data.value.profile, finalPhone);
        this.markAuthExpired(finalPhone, false);
        if (finalPhone !== this.activePhone) {
          this.setActiveAccount(finalPhone);
        }
        await this.ensureProjectKey();
        return true;
      }
      console.warn('[AirCloud] exchangeOAuthToken rejected', data?.code, data?.value);
    } catch (e) {
      console.error('[AirCloud] exchangeOAuthToken failed', e);
    }
    return false;
  }

  // ============================ 项目管理 ============================

  public async listProjects(): Promise<Array<{ name: string; project_key: string }>> {
    try {
      const resp = await this.postApi('/list_my_projects', { page: 1, size: 50 });
      if (resp && resp.code === 0 && Array.isArray(resp.value)) {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(LS_PROJECTS_CACHE + this.activePhone, JSON.stringify(resp.value));
        }
        return resp.value;
      }
    } catch (_) {}
    return this.getCachedProjects();
  }

  public getCachedProjects(): Array<{ name: string; project_key: string }> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(LS_PROJECTS_CACHE + this.activePhone);
        if (raw) return JSON.parse(raw);
      }
    } catch (_) {}
    return [];
  }

  public async ensureProjectKey(): Promise<string> {
    if (this.projectKey) return this.projectKey;
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

    const res = await fetch(url, {
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

      const resp = await this.postApi('/list_my_devices', {
        project: this.projectKey,
        page: 1,
        size: 50
      });

      if (resp && (resp.code === 105 || (typeof resp.value === 'string' && resp.value.includes('auth failed')))) {
        this.markAuthExpired(this.activePhone, true);
        throw new AuthExpiredError('登录鉴权已失效，请重新授权');
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

  /**
   * public deriveSpeedsForTrackPoints(points: StoredTrackPoint[]): StoredTrackPoint[] {
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
