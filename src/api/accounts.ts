/**
 * 合宙 AirCloud 官方评测多账号注册表
 *
 * 说明：
 * - 4 个账号共用统一出厂密码 Hz8202，均为合宙官方开放的评测账号。
 * - projectKey 为各账号「合宙标准模块」项目的真实 Key（已通过 /list_my_projects 核实）。
 * - nameHints 仅提供人类可读的展示别名；经纬度、信号、地址、时间等一切数值
 *   均 100% 来自 AirCloud 云端接口，不做任何本地捏造。
 */

export interface DeviceNameHint {
  name: string;
  shortName: string;
}

export interface AccountDef {
  phone: string;
  password: string;
  label: string;
  role: string;
  projectKey: string;
  /** 展示别名提示（仅命名，不含任何遥测数值） */
  nameHints: Record<string, DeviceNameHint>;
}

export const OFFICIAL_ACCOUNTS: AccountDef[] = [
  {
    phone: '18101796680',
    password: 'Hz8202',
    label: '账号一',
    role: '开封 / 西安 真机集群',
    projectKey: 'q0eilWQpyjZGFZFS6PFmREsRjUXoButr',
    nameHints: {
      '864317087172311': { name: '8202G·开封旗舰机', shortName: '开封旗舰机' },
      '864317087172121': { name: '8202G·开封测试机', shortName: '开封测试机' },
      '864317087173012': { name: '8202G·西安测试机', shortName: '西安测试机' },
      '864317087172782': { name: '8202G·待定位终端', shortName: '待定位终端' }
    }
  },
  {
    phone: '19036766195',
    password: 'Hz8202',
    label: '账号二',
    role: '上海浦东 真机集群',
    projectKey: 'ggV1VA89GUTQBMgqKszpSN6E2ZuQG5va',
    nameHints: {
      '864317087172071': { name: '8202G·浦东浦三路机', shortName: '浦东浦三路' },
      '864317083931439': { name: '8202G·浦东秀沿路机', shortName: '浦东秀沿路' }
    }
  },
  {
    phone: '15938684042',
    password: 'Hz8202',
    label: '账号三',
    role: '上海浦东 真机',
    projectKey: 'zmdfxP8TTUk6jBZoguWeQgSaEK6fiZu9',
    nameHints: {
      '864317087172741': { name: '8202G·浦东浦三路机', shortName: '浦东浦三路' }
    }
  },
  {
    phone: '13384022744',
    password: 'Hz8202',
    label: '账号四',
    role: '上海浦东 真机',
    projectKey: 'c3SeanQXjxiBvHYHZIDgi9FM6yBZj09s',
    nameHints: {
      '864317087172683': { name: '8202G·浦东浦三路机', shortName: '浦东浦三路' }
    }
  }
];

export const DEFAULT_ACCOUNT_PHONE = OFFICIAL_ACCOUNTS[0].phone;

export function findAccount(phone: string): AccountDef | undefined {
  return OFFICIAL_ACCOUNTS.find(a => a.phone === phone);
}
