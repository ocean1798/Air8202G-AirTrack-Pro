/**
 * 智能限流调度器 (RateLimiter)
 * 严格执行合宙官方 AirCloud Open API v5 对单个设备至少 15 秒的轮询间隔保护
 * 彻底杜绝 HTTP 429 (Too Many Requests) 触发导致的设备临时封禁
 */

export class DeviceRateLimiter {
  private static instance: DeviceRateLimiter;
  // 记录每个设备的最后请求时间戳 (毫秒)
  private lastRequestMap: Map<string, number> = new Map();
  // 设备最新响应缓存 (支持在冷却时间内快速返回)
  private cacheMap: Map<string, { data: any; timestamp: number }> = new Map();

  // 默认保护冷却周期: 15 秒
  private readonly cooldownMs = 15000;

  public static getInstance(): DeviceRateLimiter {
    if (!DeviceRateLimiter.instance) {
      DeviceRateLimiter.instance = new DeviceRateLimiter();
    }
    return DeviceRateLimiter.instance;
  }

  /**
   * 检查设备是否处于冷却期
   * @param imei 设备唯一识别码
   * @returns { canRequest: boolean, waitMs: number }
   */
  public checkCooldown(imei: string): { canRequest: boolean; waitMs: number } {
    const last = this.lastRequestMap.get(imei) || 0;
    const now = Date.now();
    const elapsed = now - last;

    if (elapsed >= this.cooldownMs) {
      return { canRequest: true, waitMs: 0 };
    }
    return { canRequest: false, waitMs: this.cooldownMs - elapsed };
  }

  /**
   * 记录设备请求成功并刷新冷却时间
   */
  public markRequest(imei: string, data?: any): void {
    const now = Date.now();
    this.lastRequestMap.set(imei, now);
    if (data) {
      this.cacheMap.set(imei, { data, timestamp: now });
    }
  }

  /**
   * 获取设备在冷却期内的最新有效缓存
   */
  public getCachedData<T = any>(imei: string): T | null {
    const item = this.cacheMap.get(imei);
    if (!item) return null;
    return item.data as T;
  }

  /**
   * 清除特定设备或全部限流记录
   */
  public reset(imei?: string): void {
    if (imei) {
      this.lastRequestMap.delete(imei);
      this.cacheMap.delete(imei);
    } else {
      this.lastRequestMap.clear();
      this.cacheMap.clear();
    }
  }
}
