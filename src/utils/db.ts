/**
 * AirTrack Pro - 本地离线时空数据库引擎 (IndexedDB)
 * 具备多端安全降级能力：在 Web/Android Webview 启用高并发时序对象库，无 IDB 时降级到 Memory/UniStorage
 */

export interface StoredTrackPoint {
  /** 复合主键: `${imei}_${timestamp}`，彻底避免云端缺省 id 的主键报错 */
  key: string;
  accountPhone: string;
  imei: string;
  timestamp: number;
  timeStr: string;
  lat: number;
  lng: number;
  wlat?: number;
  wlng?: number;
  speed: number;
  address?: string;
}

export interface StoredDeviceProfile {
  imei: string;
  accountPhone: string;
  name: string;
  status: string;
  csq: string;
  battMv: string;
  battPct: number;
  lat: number | null;
  lng: number | null;
  latestTime: string;
  address: string;
  updatedAt: number;
}

const DB_NAME = 'AirTrackDB_v1';
const DB_VERSION = 4;
const STORE_TRACKS = 'track_points';
const STORE_DEVICES = 'device_profiles';

export const SEED_DEVICE_PROFILES: StoredDeviceProfile[] = [];
export const SEED_TRACK_POINTS: StoredTrackPoint[] = [];

class AirTrackDatabase {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryTracks: Map<string, StoredTrackPoint> = new Map();
  private memoryDevices: Map<string, StoredDeviceProfile> = new Map();

  private isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (!this.isSupported()) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;

          // 1. 轨迹时序表：若升级至版本2，重建轨迹表以彻底清除历史模拟假数据
          if (e.oldVersion < 2 && db.objectStoreNames.contains(STORE_TRACKS)) {
            db.deleteObjectStore(STORE_TRACKS);
          }

          if (!db.objectStoreNames.contains(STORE_TRACKS)) {
            const store = db.createObjectStore(STORE_TRACKS, { keyPath: 'key' });
            store.createIndex('idx_tenant_device_time', ['accountPhone', 'imei', 'timestamp'], { unique: false });
            store.createIndex('idx_imei_time', ['imei', 'timestamp'], { unique: false });
            store.createIndex('idx_imei', 'imei', { unique: false });
          }

          // 2. 设备档案快照表
          if (!db.objectStoreNames.contains(STORE_DEVICES)) {
            const devStore = db.createObjectStore(STORE_DEVICES, { keyPath: 'imei' });
            devStore.createIndex('idx_account', 'accountPhone', { unique: false });
          }

          // 3. 升级清理：自动剔除已下线的历史硬编码设备 864317087173038
          if (e.oldVersion < 3 && db.objectStoreNames.contains(STORE_DEVICES)) {
            try {
              const tx = (e.target as IDBOpenDBRequest).transaction;
              if (tx) {
                const devStore = tx.objectStore(STORE_DEVICES);
                devStore.delete('864317087173038');
              }
            } catch (_) {}
          }

          // 4. 版本4升级：定向自愈清洗因探针单例踩踏导致的种子设备归属混乱，保留用户自定义设备快照
          if (e.oldVersion < 4 && db.objectStoreNames.contains(STORE_DEVICES)) {
            try {
              const tx = (e.target as IDBOpenDBRequest).transaction;
              if (tx) {
                const devStore = tx.objectStore(STORE_DEVICES);
                // 仅对已知官方 8 台种子设备执行覆盖纠正归属
                for (const seed of SEED_DEVICE_PROFILES) {
                  devStore.put(seed);
                }
                devStore.delete('864317087173038');
              }
            } catch (_) {}
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = (err) => {
          console.warn('[AirTrackDB] IndexedDB open error, falling back to memory', err);
          resolve(null);
        };
      } catch (err) {
        console.warn('[AirTrackDB] IndexedDB init exception', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /** 批量存入轨迹点 */
  public async putTrackPoints(points: StoredTrackPoint[]): Promise<number> {
    if (!points || points.length === 0) return 0;
    const db = await this.getDB();

    if (!db) {
      for (const p of points) {
        this.memoryTracks.set(p.key, p);
      }
      return points.length;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_TRACKS, 'readwrite');
        const store = tx.objectStore(STORE_TRACKS);

        let count = 0;
        for (const p of points) {
          if (!p.key) p.key = `${p.imei}_${p.timestamp}`;
          store.put(p);
          count++;
        }

        tx.oncomplete = () => resolve(count);
        tx.onerror = (err) => {
          console.warn('[AirTrackDB] putTrackPoints transaction error', err);
          resolve(count);
        };
      } catch (e) {
        console.warn('[AirTrackDB] putTrackPoints failed', e);
        resolve(0);
      }
    });
  }

  /**
   * 按时间段查询指定设备的离线历史轨迹
   */
  public async getTrackPointsByRange(
    accountPhone: string,
    imei: string,
    startMs: number,
    endMs: number
  ): Promise<StoredTrackPoint[]> {
    const db = await this.getDB();

    if (!db) {
      const results: StoredTrackPoint[] = [];
      for (const p of this.memoryTracks.values()) {
        if ((!p.accountPhone || p.accountPhone === accountPhone) && p.imei === imei && p.timestamp >= startMs && p.timestamp <= endMs) {
          results.push(p);
        }
      }
      if (results.length > 0) return results.sort((a, b) => a.timestamp - b.timestamp);

      const seeds = SEED_TRACK_POINTS.filter((p) => (!p.accountPhone || p.accountPhone === accountPhone) && p.imei === imei && p.timestamp >= startMs && p.timestamp <= endMs);
      return seeds;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_TRACKS, 'readonly');
        const store = tx.objectStore(STORE_TRACKS);

        // 使用 idx_imei_time 索引做范围检索
        const index = store.index('idx_imei_time');
        const range = IDBKeyRange.bound([imei, startMs], [imei, endMs]);
        const req = index.openCursor(range);
        const list: StoredTrackPoint[] = [];

        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const v = cursor.value;
            // 租户归属强断言：确保点位严格属于当前查询账号
            const belongsToAccount = !v.accountPhone || v.accountPhone === accountPhone;
            // 排除历史合成测试种子特征点
            const isSynthetic = (Math.abs(v.lat - 31.1480) < 0.001 && Math.abs(v.lng - 121.5280) < 0.001) ||
                                (Math.abs(v.lat - 34.8050) < 0.001 && Math.abs(v.lng - 114.3200) < 0.001);
            if (belongsToAccount && !isSynthetic) {
              list.push(v);
            }
            cursor.continue();
          } else {
            if (list.length > 0) {
              resolve(list);
            } else {
              resolve([]);
            }
          }
        };

        req.onerror = () => {
          resolve([]);
        };
      } catch (e) {
        console.warn('[AirTrackDB] getTrackPointsByRange exception', e);
        const seeds = SEED_TRACK_POINTS.filter((p) => (!p.accountPhone || p.accountPhone === accountPhone) && p.imei === imei && p.timestamp >= startMs && p.timestamp <= endMs);
        resolve(seeds);
      }
    });
  }

  /**
   * 保存设备档案快照（持久化离线数据）
   */
  public async putDeviceProfiles(devices: StoredDeviceProfile[]): Promise<void> {
    if (!devices || devices.length === 0) return;
    const db = await this.getDB();

    if (!db) {
      devices.forEach((d) => this.memoryDevices.set(d.imei, d));
      try {
        if (typeof uni !== 'undefined' && uni.setStorageSync) {
          uni.setStorageSync(`airtrack_devs_${devices[0].accountPhone}`, JSON.stringify(devices));
        }
      } catch (_) {}
      return;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_DEVICES, 'readwrite');
        const store = tx.objectStore(STORE_DEVICES);
        for (const dev of devices) {
          store.put(dev);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  /**
   * 读取指定账号名下已缓存的设备列表
   */
  public async getDeviceProfiles(accountPhone: string): Promise<StoredDeviceProfile[]> {
    const db = await this.getDB();

    if (!db) {
      try {
        if (typeof uni !== 'undefined' && uni.getStorageSync) {
          const raw = uni.getStorageSync(`airtrack_devs_${accountPhone}`);
          if (raw) return JSON.parse(raw);
        }
      } catch (_) {}
      return Array.from(this.memoryDevices.values()).filter((d) => d.accountPhone === accountPhone);
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_DEVICES, 'readonly');
        const store = tx.objectStore(STORE_DEVICES);
        const index = store.index('idx_account');
        const req = index.getAll(IDBKeyRange.only(accountPhone));

        req.onsuccess = () => {
          let res = req.result || [];
          // 彻底过滤已下线的 864317087173038 并进行账号归属二次断言
          res = res.filter((d: any) => d.imei !== '864317087173038' && d.accountPhone === accountPhone);
          if (res.length > 0) {
            resolve(res);
          } else {
            // 首次离线冷启动：若存在该空间的预置物理设备种子，自动写入本地并返回
            const seeds = SEED_DEVICE_PROFILES.filter(d => d.accountPhone === accountPhone);
            if (seeds.length > 0) {
              this.putDeviceProfiles(seeds).catch(() => {});
              resolve(seeds);
            } else {
              resolve([]);
            }
          }
        };
        req.onerror = () => {
          const seeds = SEED_DEVICE_PROFILES.filter(d => d.accountPhone === accountPhone);
          resolve(seeds);
        };
      } catch (_) {
        const seeds = SEED_DEVICE_PROFILES.filter(d => d.accountPhone === accountPhone);
        resolve(seeds);
      }
    });
  }
}

export const db = new AirTrackDatabase();
