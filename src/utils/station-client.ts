/**
 * AirTrack Pro - 本地桌面守护站适配客户端 (Desktop Station Client)
 * 自动嗅探 127.0.0.1:28202 本地守护服务：
 * - 连通时：升级为「桌面工作站增强模式」，享用 7×24h 围栏守护与 SQLite 本地永久仓储；
 * - 未连通时（GitHub Pages、Android APK、微信小程序）：零报错毫秒级降级为纯前端模式。
 */

const STATION_BASE_URL = 'http://127.0.0.1:28202';
const STATION_WS_URL = 'ws://127.0.0.1:28202/ws/live';

export interface StationStatus {
  online: boolean;
  uptime_sec: number;
  total_devices: number;
  online_devices: number;
  total_fences: number;
  recent_alerts: number;
  storage_path: string;
}

export interface StationFence {
  id?: string;
  name: string;
  fence_type: 'circle' | 'polygon';
  radius?: number;
  center_lat?: number;
  center_lng?: number;
  points?: Array<{ lat: number; lng: number }>;
  is_active?: boolean;
}

export interface StationAlert {
  id: string;
  fence_id: string;
  fence_name?: string;
  imei: string;
  device_name?: string;
  alert_type: 'BREACH_EXIT' | 'BREACH_ENTER';
  lat: number;
  lng: number;
  speed: number;
  message: string;
  created_at: number;
  is_read: number;
}

class DesktopStationClient {
  private static instance: DesktopStationClient;
  public isConnected: boolean = false;
  public status: StationStatus | null = null;
  private ws: WebSocket | null = null;
  private listeners: Array<(event: any) => void> = [];

  private constructor() {}

  public static getInstance(): DesktopStationClient {
    if (!DesktopStationClient.instance) {
      DesktopStationClient.instance = new DesktopStationClient();
    }
    return DesktopStationClient.instance;
  }

  /**
   * 启动时快速嗅探本地 28202 端口
   */
  public async probe(): Promise<boolean> {
    if (typeof window === 'undefined' || typeof window.fetch === 'undefined') {
      this.isConnected = false;
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 350); // 350ms 快速超时

      const resp = await fetch(`${STATION_BASE_URL}/api/ping`, {
        signal: controller.signal,
        mode: 'cors'
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 'ok') {
          this.isConnected = true;
          this.fetchStatus();
          this.connectWS();
          console.log('🟢 [AirTrack] 成功接入 AirTrack Pro Desktop Station 桌面独立守护站');
          return true;
        }
      }
    } catch {
      // 静默捕获错误，平滑降级
    }

    this.isConnected = false;
    return false;
  }

  public async fetchStatus(): Promise<StationStatus | null> {
    if (!this.isConnected) return null;
    try {
      const resp = await fetch(`${STATION_BASE_URL}/api/status`);
      if (resp.ok) {
        this.status = await resp.json();
        return this.status;
      }
    } catch {
      this.isConnected = false;
    }
    return null;
  }

  public async fetchDevices(): Promise<any[]> {
    if (!this.isConnected) return [];
    try {
      const resp = await fetch(`${STATION_BASE_URL}/api/devices`);
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.warn('[Station] fetchDevices failed', e);
    }
    return [];
  }

  public async fetchFences(): Promise<StationFence[]> {
    if (!this.isConnected) return [];
    try {
      const resp = await fetch(`${STATION_BASE_URL}/api/fences`);
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.warn('[Station] fetchFences failed', e);
    }
    return [];
  }

  public async saveFence(fence: StationFence): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const resp = await fetch(`${STATION_BASE_URL}/api/fences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fence)
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  public async deleteFence(fenceId: string): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const resp = await fetch(`${STATION_BASE_URL}/api/fences/${fenceId}`, {
        method: 'DELETE'
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  public async fetchAlerts(limit: number = 20): Promise<StationAlert[]> {
    if (!this.isConnected) return [];
    try {
      const resp = await fetch(`${STATION_BASE_URL}/api/alerts?limit=${limit}`);
      if (resp.ok) {
        return await resp.json();
      }
    } catch {
      return [];
    }
    return [];
  }

  public async fetchHistory(imei: string, start?: number, end?: number, limit: number = 2000): Promise<any[]> {
    if (!this.isConnected) return [];
    try {
      const q = new URLSearchParams({ imei, limit: String(limit) });
      if (start) q.append('start', String(start));
      if (end) q.append('end', String(end));
      const resp = await fetch(`${STATION_BASE_URL}/api/history?${q.toString()}`);
      if (resp.ok) {
        return await resp.json();
      }
    } catch (e) {
      console.warn('[Station] fetchHistory error', e);
    }
    return [];
  }

  public async triggerSync(): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const resp = await fetch(`${STATION_BASE_URL}/api/sync`, { method: 'POST' });
      return resp.ok;
    } catch {
      return false;
    }
  }

  public subscribe(listener: (event: any) => void) {
    this.listeners.push(listener);
  }

  public unsubscribe(listener: (event: any) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private connectWS() {
    if (typeof WebSocket === 'undefined') return;
    try {
      this.ws = new WebSocket(STATION_WS_URL);
      this.ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          this.listeners.forEach(fn => fn(payload));
        } catch {}
      };
      this.ws.onclose = () => {
        this.ws = null;
      };
    } catch {}
  }
}

export const stationClient = DesktopStationClient.getInstance();
