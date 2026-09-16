/**
 * AirCloud Open API v5 契约与 Tag 字典枚举
 */

export enum OfficialTags {
  LATITUDE = 513,      // 纬度 (度, WGS-84) - 注意513是Lat
  LONGITUDE = 512,     // 经度 (度, WGS-84) - 注意512是Lng
  SPEED = 514,         // 航速 (km/h)
  COURSE = 518,        // 航向角 (0-360)
  ALTITUDE = 515,      // 海拔高度 (米)
  BATTERY_MV = 799,    // 电池电压 (mV, 毫伏)
  CSQ = 782,           // 4G 蜂窝信号强度 (0-31)
  IMU_ACCEL = 1293,    // 25Hz G-Sensor 三轴加速度原始包
  GNSS_TRACK = 1294,   // 10s 稠密差分 GNSS 轨迹压缩包
  TEMPERATURE = 256,   // 模组/环境温度
  VIBRATION_LVL = 700  // 震动告警灵敏度阈值 (1-5)
}

export const OFFICIAL_TAG_LIST = [
  OfficialTags.LATITUDE,
  OfficialTags.LONGITUDE,
  OfficialTags.SPEED,
  OfficialTags.BATTERY_MV,
  OfficialTags.CSQ,
  OfficialTags.IMU_ACCEL,
  OfficialTags.GNSS_TRACK
];

export interface DeviceInfo {
  imei: string;
  name: string;
  shortName: string;
  online: boolean;
  lastActiveTime: string;
  /** 未上报定位的物理设备为 null（不伪造坐标） */
  lat: number | null;
  lng: number | null;
  gcjLat: number | null;
  gcjLng: number | null;
  /** 事件标签的真实值（显示用） */
  speed: number;
  voltageMv: number;
  csq: number;
  firmwareVersion?: string;
  address?: string;
}

export interface TrackPoint {
  index: number;
  lat: number;
  lng: number;
  gcjLat: number;
  gcjLng: number;
  speed: number;
  timeStr: string;
  timestamp: number;
  isMultiDay: boolean;
}

export interface ApiResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

export interface AuthSession {
  token: string;
  salt: string;
  sid: string;
  account: string;
  expireAt: number;
}
