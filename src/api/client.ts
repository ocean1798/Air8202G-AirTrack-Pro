/**
 * AirTrack Pro - 商业级 IoT 客户端与时空数据中枢
 *
 * 核心特性：
 * 1. 100% 对接合宙官方真实网关，真实物理坐标与路网移动轨迹。
 * 2. 离线时空缓存：基于 IndexedDB (`AirTrackDB_v1`) 持久化设备档案与历史轨迹点。
 * 3. 本地优先检索：切换时段优先从本地毫秒级重绘，云端静默受控增量同步。
 * 4. 商业化多账号管理：支持任意合宙账号安全授权与多项目自动适配。
 */

import type { DeviceInfo, TrackPoint } from './types';
import { OfficialTags } from './types';
import { DeviceRateLimiter } from './rate-limiter';
import {
  getAllRegisteredAccounts,
  findAccount,
  registerUserAccount,
  unregisterUserAccount,
  DEFAULT_ACCOUNT_PHONE
} from './accounts';
import type { AccountDef } from './accounts';
import { db, type StoredTrackPoint, type StoredDeviceProfile } from '../utils/db';

export { getAllRegisteredAccounts, DEFAULT_ACCOUNT_PHONE, findAccount };
export type { AccountDef };

export const OFFICIAL_API_CONFIG = {
  gateway: 'https://api-iot.luatos.com/iot/open_api',
  oauthAuthorizeUrl: 'https://api-iot.luatos.com/iam/luat_oauth/authorize',
  oauthLoginApi: 'https://api-iot.luatos.com/iam/luat_oauth/v2/login'
};

/** 网关鉴权失败 / 会话被顶号 */
export class AuthExpiredError extends Error {
  constructor(message = '合宙云端会话已断开（可能在其他设备重复登录）') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

const LS_ACTIVE_ACCOUNT = 'airtrack_active_account';
const LS_PENDING_ACCOUNT = 'airtrack_pending_account';
const LS_PROJECTS_CACHE = 'airtrack_projects_cache_';
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

  // ============================ 账号管理 ============================

  /** 读取当前激活账号 */
  public getActiveAccount(): AccountDef {
    return findAccount(this.activePhone) || {
      phone: this.activePhone,
      label: `账号 ${this.activePhone.slice(-4)}`,
      role: '用户私有空间',
      projectKey: this.projectKey
    };
  }

  public getActivePhone(): string {
    return this.activePhone;
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

  /** 清空内存凭据 */
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

  /** 返回全部已注册账号的运行时状态 */
  public getAccountStates(): AccountRuntimeState[] {
    const all = getAllRegisteredAccounts();
    return all.map(account => ({
      account,
      hasAuth: this.hasAuth(account.phone),
      projectKey: this.readProjectKey(account.phone) || account.projectKey || '',
      active: account.phone === this.activePhone
    }));
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

    if (auth) window.localStorage.setItem(lsAuthKey(p), JSON.stringify(auth));
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
    const clean = currentHref.split('#')[0].split('?')[0];
    return `${OFFICIAL_API_CONFIG.oauthAuthorizeUrl}?return_to=${encodeURIComponent(clean)}`;
  }

  public consumePendingAccount(): string | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const p = window.localStorage.getItem(LS_PENDING_ACCOUNT);
    if (p) window.localStorage.removeItem(LS_PENDING_ACCOUNT);
    return p;
  }

  /** 使用 OAuth token 换票 */
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
    if (json.code === 105) {
      console.warn('[AirCloud] 登录态失效（Code 105）', json.value);
    }
    return json;
  }

  // ============================ 业务数据与离线缓存 ============================

  /**
   * 拉取设备清单：优先云端，云端受阻或未登录时从本地 IndexedDB 恢复
   */
  public async getDeviceList(): Promise<DeviceInfo[]> {
    // 1. 若当前未授权或离线，尝试直接加载本地已持久化档案
    if (!this.hasAuth()) {
      const cached = await db.getDeviceProfiles(this.activePhone);
      if (cached.length > 0) {
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

      if (resp && resp.code === 105) {
        throw new AuthExpiredError();
      }

      if (!(resp && resp.code === 0 && resp.value && Array.isArray(resp.value.records))) {
        throw new Error(resp && typeof resp.value === 'string' ? resp.value : '设备清单拉取失败');
      }

      const hints = this.getActiveAccount().nameHints || {};
      const devices: DeviceInfo[] = [];
      const toCache: StoredDeviceProfile[] = [];

      for (const item of resp.value.records) {
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

        const isOnline = item.status === 'online' || (latestLoc && latestLoc.status === 'online');
        const defaultName = hints[imei]?.name || `车载终端·${imei.slice(-5)}`;
        const shortName = hints[imei]?.shortName || `终端${imei.slice(-5)}`;
        const address = latestLoc?.address || '未上报物理定位';
        const lastActiveTime = latestLoc?.time || item.last_time || item.created_at || '—';

        const dev: DeviceInfo = {
          imei,
          name: defaultName,
          shortName,
          online: !!isOnline,
          lastActiveTime,
          lat: hasCoord ? rawLat : null,
          lng: hasCoord ? rawLng : null,
          gcjLat: hasCoord ? rawLat : null,
          gcjLng: hasCoord ? rawLng : null,
          speed: latestLoc?.speed ? parseFloat(latestLoc.speed) : 0,
          voltageMv: latestLoc?.val_799 ? parseInt(latestLoc.val_799, 10) : 0,
          csq: latestLoc?.val_782 ? parseInt(latestLoc.val_782, 10) : (latestLoc?.csq ? parseInt(latestLoc.csq, 10) : 0),
          firmwareVersion: 'Air8202G',
          address
        };
        devices.push(dev);

        toCache.push({
          imei,
          accountPhone: this.activePhone,
          name: defaultName,
          status: isOnline ? '在线' : (hasCoord ? '驻留' : '离线'),
          csq: `CSQ ${dev.csq}`,
          battMv: dev.voltageMv ? `${dev.voltageMv} mV` : '—',
          battPct: dev.voltageMv ? Math.min(100, Math.max(0, Math.round(((dev.voltageMv - 2000) / 1000) * 100))) : 0,
          lat: dev.lat,
          lng: dev.lng,
          latestTime: lastActiveTime,
          address,
          updatedAt: Date.now()
        });
      }

      // 写入本地持久化
      await db.putDeviceProfiles(toCache);
      devices.sort((a, b) => String(b.lastActiveTime).localeCompare(String(a.lastActiveTime)));
      return devices;
    } catch (err) {
      // 网络或鉴权失败时，安全回退到本地离线档案
      const cached = await db.getDeviceProfiles(this.activePhone);
      if (cached.length > 0) {
        return this.profilesToDeviceInfos(cached);
      }
      throw err;
    }
  }

  private profilesToDeviceInfos(profiles: StoredDeviceProfile[]): DeviceInfo[] {
    return profiles.map(p => ({
      imei: p.imei,
      name: p.name,
      shortName: p.name.slice(-7),
      online: p.status === '在线',
      lastActiveTime: p.latestTime,
      lat: p.lat,
      lng: p.lng,
      gcjLat: p.lat,
      gcjLng: p.lng,
      speed: 0,
      voltageMv: parseInt(p.battMv, 10) || 0,
      csq: parseInt(p.csq.replace(/\D/g, ''), 10) || 0,
      address: p.address
    }));
  }

  /**
   * 真实拉取设备历史轨迹（本地优先 + 受控增量同步）
   */
  public async getHistoricalTrack(
    imei: string,
    scope: string = '90d',
    customStart?: string,
    customEnd?: string,
    forceCloud = false
  ): Promise<TrackPoint[]> {
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    let startDate: Date;
    let endDate: Date = new Date();

    if (scope === 'custom' && customStart && customEnd) {
      startDate = new Date(customStart + 'T00:00:00');
      endDate = new Date(customEnd + 'T23:59:59');
    } else if (scope === 'today' || scope === 'recent_window') {
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
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
    }

    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const isMultiDay = (endMs - startMs) > 86400000;

    // 1. 本地优先：若已存在缓存且不强制刷新，毫秒级直接返回
    if (!forceCloud) {
      const cached = await db.getTrackPointsByRange(this.activePhone, imei, startMs, endMs);
      if (cached && cached.length > 0) {
        return cached.map((p, idx) => ({
          index: idx,
          lat: p.lat,
          lng: p.lng,
          gcjLat: p.lat,
          gcjLng: p.lng,
          speed: p.speed,
          timeStr: p.timeStr,
          timestamp: p.timestamp,
          isMultiDay
        }));
      }
    }

    // 2. 未授权时直接返回本地点位
    if (!this.hasAuth()) {
      const cached = await db.getTrackPointsByRange(this.activePhone, imei, startMs, endMs);
      return cached.map((p, idx) => ({
        index: idx,
        lat: p.lat,
        lng: p.lng,
        gcjLat: p.lat,
        gcjLng: p.lng,
        speed: p.speed,
        timeStr: p.timeStr,
        timestamp: p.timestamp,
        isMultiDay
      }));
    }

    // 3. 受控向云端增量拉取（单次最多 2 页，带 300ms 延时保护避免 429）
    try {
      const fetchedStored: StoredTrackPoint[] = [];

      for (let page = 1; page <= 2; page++) {
        if (page > 1) await new Promise(r => setTimeout(r, 300));

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
          if (page >= totalPages) break;
        } else {
          break;
        }
      }

      if (fetchedStored.length > 0) {
        await db.putTrackPoints(fetchedStored);
      }
    } catch (e) {
      if (e instanceof AuthExpiredError) throw e;
      console.warn(`[AirCloud] Incremental track fetch failed for ${imei}`, e);
    }

    // 4. 从本地时序库检索出最终完整的有序点位集合
    const finalPoints = await db.getTrackPointsByRange(this.activePhone, imei, startMs, endMs);
    finalPoints.sort((a, b) => a.timestamp - b.timestamp);

    // 计算相邻点速度推导（若原始速度缺失）
    return finalPoints.map((p, idx) => {
      let speed = p.speed;
      if (speed === 0 && idx > 0) {
        const prev = finalPoints[idx - 1];
        const dt = (p.timestamp - prev.timestamp) / 1000;
        if (dt > 0 && dt < 300) {
          const dLat = (p.lat - prev.lat) * 111000;
          const dLng = (p.lng - prev.lng) * 111000 * Math.cos(p.lat * Math.PI / 180);
          const dist = Math.sqrt(dLat * dLat + dLng * dLng);
          // 仅当物理位移大于 GNSS 漂移阈值时推算速度
          if (dist > 15) {
            speed = Math.min(140, parseFloat(((dist / dt) * 3.6).toFixed(1)));
          }
        }
      }

      return {
        index: idx,
        lat: p.lat,
        lng: p.lng,
        gcjLat: p.lat,
        gcjLng: p.lng,
        speed,
        timeStr: p.timeStr,
        timestamp: p.timestamp,
        isMultiDay
      };
    });
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
