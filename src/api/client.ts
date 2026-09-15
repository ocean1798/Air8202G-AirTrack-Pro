/**
 * AirCloud Open API v5 统一客户端（多账号版）
 *
 * 设计要点：
 * 1. 100% 对接合宙官方真实网关，绝不捏造设备、绝不合成虚假轨迹。
 * 2. 支持 4 个官方评测账号独立登录态与一键切换，凭据按账号隔离存储。
 * 3. 官方 OAuth 回调 token 自动换票并写入「触发登录的那个账号」命名空间。
 * 4. 网关返回 code 105（顶号 / 未登录）时显式抛出，由 UI 引导重新授权。
 */

import type { DeviceInfo, TrackPoint } from './types';
import { OfficialTags } from './types';
import { DeviceRateLimiter } from './rate-limiter';
import { OFFICIAL_ACCOUNTS, DEFAULT_ACCOUNT_PHONE, findAccount } from './accounts';
import type { AccountDef } from './accounts';

export { OFFICIAL_ACCOUNTS, DEFAULT_ACCOUNT_PHONE, findAccount };
export type { AccountDef };

export const OFFICIAL_API_CONFIG = {
  gateway: 'https://api-iot.luatos.com/iot/open_api',
  oauthAuthorizeUrl: 'https://api-iot.luatos.com/iam/luat_oauth/authorize',
  oauthLoginApi: 'https://api-iot.luatos.com/iam/luat_oauth/v2/login'
};

/** 网关鉴权失败 / 会话被顶号 */
export class AuthExpiredError extends Error {
  constructor(message = '合宙云端登录态已失效（可能在其他设备重复登录）') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

const LS_ACTIVE_ACCOUNT = 'airtrack_active_account';
const LS_PENDING_ACCOUNT = 'airtrack_pending_account';
const lsAuthKey = (phone: string) => `airtrack_auth_${phone}`;
const lsServiceKey = (phone: string) => `airtrack_service_${phone}`;
const lsProfileKey = (phone: string) => `airtrack_profile_${phone}`;
const lsProjectKey = (phone: string) => `airtrack_project_${phone}`;

export interface AccountRuntimeState {
  account: AccountDef;
  hasAuth: boolean;
  projectKey: string;
  active: boolean;
}

export class AirCloudClient {
  private static instance: AirCloudClient;
  private rateLimiter: DeviceRateLimiter;
  private token = '';
  private salt = '';
  private sid = '336677';
  private projectKey = '';
  private activePhone = DEFAULT_ACCOUNT_PHONE;

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

  // ============================ 账号会话 ============================

  /** 读取当前激活账号 */
  public getActiveAccount(): AccountDef {
    return findAccount(this.activePhone) || OFFICIAL_ACCOUNTS[0];
  }

  public getActivePhone(): string {
    return this.activePhone;
  }

  /**
   * 切换激活账号：立即加载该账号自己的凭据与项目 Key
   */
  public setActiveAccount(phone: string): void {
    if (!findAccount(phone)) return;
    this.activePhone = phone;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LS_ACTIVE_ACCOUNT, phone);
    }
    this.resetCredentials();
    this.loadFromStorage();
  }

  /** 清空内存凭据（避免串号） */
  private resetCredentials(): void {
    this.token = '';
    this.salt = '';
    this.sid = '336677';
    this.projectKey = '';
  }

  /** 某账号是否已持有可用凭据 */
  public hasAuth(phone?: string): boolean {
    const p = phone || this.activePhone;
    if (typeof window === 'undefined' || !window.localStorage) return false;
    try {
      const raw = window.localStorage.getItem(lsAuthKey(p));
      if (!raw) return false;
      const auth = JSON.parse(raw);
      return !!(auth && auth.token && auth.salt);
    } catch {
      return false;
    }
  }

  /** 返回全部账号的运行时状态（供切换面板渲染） */
  public getAccountStates(): AccountRuntimeState[] {
    return OFFICIAL_ACCOUNTS.map(account => ({
      account,
      hasAuth: this.hasAuth(account.phone),
      projectKey: this.readProjectKey(account.phone) || account.projectKey,
      active: account.phone === this.activePhone
    }));
  }

  /** 读取当前激活会话的账号档案（用于顶部展示） */
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

  private writeProjectKey(phone: string, key: string): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(lsProjectKey(phone), key);
    }
  }

  /** 从 localStorage 恢复当前激活账号的动态凭据 */
  public loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const storedActive = window.localStorage.getItem(LS_ACTIVE_ACCOUNT);
      if (storedActive && findAccount(storedActive)) {
        this.activePhone = storedActive;
      }
    } catch { /* ignore */ }

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
      this.projectKey = this.readProjectKey(this.activePhone) || this.getActiveAccount().projectKey;
    } catch (e) {
      console.warn('[AirCloud] loadFromStorage error', e);
    }
  }

  /**
   * 保存认证信息到「指定账号」的独立命名空间
   */
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

    if (auth) window.localStorage.setItem(lsAuthKey(p), JSON.stringify(auth));
    if (service) window.localStorage.setItem(lsServiceKey(p), JSON.stringify(service));
    if (profile) window.localStorage.setItem(lsProfileKey(p), JSON.stringify(profile));
  }

  /** 清除某账号登录态 */
  public clearAuth(phone?: string): void {
    const p = phone || this.activePhone;
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
   * 发起官方 OAuth 授权：记录待登录账号，回跳地址为本应用当前地址
   */
  public buildOAuthUrl(phone: string, currentHref: string): string {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LS_PENDING_ACCOUNT, phone);
    }
    const clean = currentHref.split('#')[0].split('?')[0];
    return `${OFFICIAL_API_CONFIG.oauthAuthorizeUrl}?return_to=${encodeURIComponent(clean)}`;
  }

  /** 取出并消费「待登录账号」 */
  public consumePendingAccount(): string | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const p = window.localStorage.getItem(LS_PENDING_ACCOUNT);
    if (p) window.localStorage.removeItem(LS_PENDING_ACCOUNT);
    return p;
  }

  /**
   * 使用 OAuth 回调 token 换取业务凭据（写入指定账号命名空间）
   */
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
        this.saveAuth(data.value.auth, data.value.service, data.value.profile, target);
        if (target !== this.activePhone) {
          this.setActiveAccount(target);
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

  /**
   * 真实拉取账号下的项目清单 (/list_my_projects)
   */
  public async listProjects(): Promise<Array<{ name: string; project_key: string }>> {
    const resp = await this.postApi('/list_my_projects', { page: 1, size: 50 });
    if (resp && resp.code === 0 && Array.isArray(resp.value)) {
      return resp.value;
    }
    return [];
  }

  /**
   * 确保当前账号持有有效 projectKey（缺省时向云端发现并缓存）
   */
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

  /**
   * 底层真实 HTTP POST 网关请求
   */
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
    if (json.code === 105) {
      console.warn('[AirCloud] 登录态失效（Code 105）', json.value);
    }
    return json;
  }

  // ============================ 业务数据 ============================

  /**
   * 真实拉取当前账号下设备清单及其最新物理定位
   */
  public async getDeviceList(): Promise<DeviceInfo[]> {
    await this.ensureProjectKey();

    if (!this.hasAuth()) {
      throw new AuthExpiredError('当前账号尚未授权登录');
    }

    const resp = await this.postApi('/list_my_devices', {
      project: this.projectKey,
      page: 1,
      size: 50
    });

    if (resp && resp.code === 105) {
      throw new AuthExpiredError();
    }

    if (!(resp && resp.code === 0 && resp.value && Array.isArray(resp.value.records))) {
      throw new Error(resp && typeof resp.value === 'string' ? resp.value : '云端设备清单获取失败');
    }

    const hints = this.getActiveAccount().nameHints || {};
    const devices: DeviceInfo[] = [];

    for (const item of resp.value.records) {
      const imei: string = item.deviceid || item.deviceId;
      let latestLoc: any = null;
      try {
        const locResp = await this.postApi('/aircloud/latest_location', { client_id: imei });
        if (locResp && locResp.code === 0 && locResp.value && typeof locResp.value === 'object') {
          latestLoc = locResp.value;
        }
      } catch { /* 单设备定位失败不影响其他设备 */ }

      const hint = hints[imei];
      const lat = latestLoc?.lat ? parseFloat(latestLoc.lat) : null;
      const lng = latestLoc?.lng ? parseFloat(latestLoc.lng) : null;

      devices.push({
        imei,
        name: hint?.name || `8202G·终端${imei.slice(-4)}`,
        shortName: hint?.shortName || `终端${imei.slice(-4)}`,
        online: latestLoc !== null,
        lastActiveTime: latestLoc?.time || '—',
        lat: lat as any,
        lng: lng as any,
        gcjLat: lat as any,
        gcjLng: lng as any,
        speed: 0,
        voltageMv: 0,
        csq: latestLoc?.signal ? parseInt(latestLoc.signal, 10) : 0,
        firmwareVersion: 'Air8202G',
        address: latestLoc?.address || '未上报物理定位'
      });
    }

    // 按最新上报时间倒序，最近活跃的设备排在最前
    devices.sort((a, b) => String(b.lastActiveTime).localeCompare(String(a.lastActiveTime)));
    return devices;
  }

  /**
   * 真实拉取设备历史轨迹 (/aircloud/location_history)
   * 严格执行合宙官方 15 秒单设备轮询间隔保护，冷却期内直接复用真实缓存
   */
  public async getHistoricalTrack(imei: string, scope: string = '90d'): Promise<TrackPoint[]> {
    const cacheKey = `${this.activePhone}:${imei}:${scope}`;

    // 15 秒工业级冷却保护（防 429）
    const cooldown = this.rateLimiter.checkCooldown(cacheKey);
    if (!cooldown.canRequest) {
      const cached = this.rateLimiter.getCachedData<TrackPoint[]>(cacheKey);
      if (cached) return cached;
      return [];
    }

    if (!this.hasAuth()) return [];

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const endDate = new Date(now);
    const startDate = new Date(now);
    if (scope === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (scope === 'yesterday') {
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 0);
    } else if (scope === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else {
      startDate.setDate(startDate.getDate() - 90);
    }

    try {
      const resp = await this.postApi('/aircloud/location_history', {
        client_id: imei,
        start: fmt(startDate),
        end: fmt(endDate),
        page: 1,
        size: 100
      });

      if (resp && resp.code === 105) {
        throw new AuthExpiredError();
      }

      if (resp && resp.code === 0 && resp.value && Array.isArray(resp.value.records) && resp.value.records.length > 0) {
        const rawPoints = resp.value.records;
        const isMultiDay = (endDate.getTime() - startDate.getTime()) > 86400000;

        rawPoints.sort((a: any, b: any) =>
          new Date(String(a.time).replace(/-/g, '/')).getTime() - new Date(String(b.time).replace(/-/g, '/')).getTime()
        );

        const track: TrackPoint[] = rawPoints.map((p: any, idx: number) => {
          const lat = parseFloat(p.lat);
          const lng = parseFloat(p.lng);
          const curMs = new Date(String(p.time).replace(/-/g, '/')).getTime();

          // 物理真实速度：优先取上报值，缺失时按位移差 / 时间差物理推导
          let speed = p.speed ? parseFloat(p.speed) : 0;
          if (speed === 0 && idx > 0) {
            const prev = rawPoints[idx - 1];
            const prevMs = new Date(String(prev.time).replace(/-/g, '/')).getTime();
            const dt = (curMs - prevMs) / 1000;
            if (dt > 0 && dt < 300) {
              const dLat = (lat - parseFloat(prev.lat)) * 111000;
              const dLng = (lng - parseFloat(prev.lng)) * 111000 * Math.cos(lat * Math.PI / 180);
              const dist = Math.sqrt(dLat * dLat + dLng * dLng);
              speed = Math.min(120, parseFloat(((dist / dt) * 3.6).toFixed(1)));
            }
          }

          return {
            index: idx,
            lat,
            lng,
            gcjLat: lat,
            gcjLng: lng,
            speed,
            timeStr: String(p.time),
            timestamp: curMs,
            isMultiDay
          };
        });

        this.rateLimiter.markRequest(cacheKey, track);
        return track;
      }

      // 无轨迹也标记请求，避免同一时间窗反复打网关
      this.rateLimiter.markRequest(cacheKey);
    } catch (e) {
      if (e instanceof AuthExpiredError) throw e;
      console.warn(`[AirCloud] Real track fetch failed for ${imei}`, e);
    }

    return [];
  }

  /**
   * 真实拉取设备 Tag 遥测数据 (Tag 799 电池, Tag 782 CSQ, Tag 1293 IMU加速度)
   */
  public async getRealTagTelemetry(imei: string): Promise<any> {
    if (!this.hasAuth()) return null;
    try {
      const resp = await this.postApi('/aircloud/list_by_tags', {
        client_id: imei,
        tags: [
          OfficialTags.LATITUDE,
          OfficialTags.LONGITUDE,
          OfficialTags.SPEED,
          OfficialTags.CSQ,
          OfficialTags.BATTERY_MV,
          OfficialTags.IMU_ACCEL
        ],
        page: 1,
        size: 5
      });
      if (resp && resp.code === 0 && resp.value?.records?.length > 0) {
        return resp.value.records[0];
      }
    } catch (e) {
      console.warn(`[AirCloud] Tag telemetry failed for ${imei}`, e);
    }
    return null;
  }
}

export const apiClient = new AirCloudClient();
