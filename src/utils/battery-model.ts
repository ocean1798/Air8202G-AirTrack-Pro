/**
 * 创新功能 P0: 电池健康管家与剩余续航天数预估数学模型
 * 解决硬件原始电压 Tag 799 (毫伏) 对普通用户不直观的痛点
 */

export interface BatteryStatus {
  voltageMv: number;
  percentage: number;
  estimatedDays: number;
  levelText: string;
  isLow: boolean;
  colorHex: string;
}

// 18500 / 18650 锂电池放电曲线参考阶梯点 (mV -> %)
const VOLTAGE_STOPS: [number, number][] = [
  [4200, 100],
  [4050, 90],
  [3950, 80],
  [3850, 65],
  [3750, 45],
  [3650, 25],
  [3500, 10],
  [3400, 0]
];

/**
 * 将毫伏电压 (Tag 799) 映射为标准百分比 (0 ~ 100%)
 */
export function voltageToPercentage(mv: number): number {
  if (mv >= 4200) return 100;
  if (mv <= 3400) return 0;

  for (let i = 0; i < VOLTAGE_STOPS.length - 1; i++) {
    const [vHigh, pHigh] = VOLTAGE_STOPS[i];
    const [vLow, pLow] = VOLTAGE_STOPS[i + 1];
    if (mv <= vHigh && mv >= vLow) {
      const ratio = (mv - vLow) / (vHigh - vLow);
      return Math.round(pLow + ratio * (pHigh - pLow));
    }
  }
  return 50;
}

/**
 * 估算剩余续航天数
 * 电池额定容量约 1500mAh (18500锂电)
 * 混合模式测算：每日行驶 1 小时 (10s高频上报，耗电约 65mAh) + 静止待机 23 小时 (5min休眠心跳，耗电约 4.6mAh)
 * 综合综合日均耗电约 70mAh
 */
export function estimateRemainingDays(percentage: number): number {
  const nominalCapacity = 1500; // mAh
  const remainingCapacity = (percentage / 100) * nominalCapacity;
  const avgDailyConsumption = 35; // 针对 Air8202G 超低功耗固件，日均约 35mAh
  const days = Math.round(remainingCapacity / avgDailyConsumption);
  return Math.max(0, days);
}

/**
 * 全景电池健康状态计算
 */
export function analyzeBattery(voltageMv: number): BatteryStatus {
  const pct = voltageToPercentage(voltageMv);
  const days = estimateRemainingDays(pct);

  let colorHex = '#10b981'; // 正常绿色
  let levelText = '充足';
  let isLow = false;

  if (pct <= 20) {
    colorHex = '#f43f5e'; // 红色低电警告
    levelText = '电量极低';
    isLow = true;
  } else if (pct <= 45) {
    colorHex = '#f59e0b'; // 黄色提醒
    levelText = '中等';
  }

  return {
    voltageMv,
    percentage: pct,
    estimatedDays: days,
    levelText,
    isLow,
    colorHex
  };
}
