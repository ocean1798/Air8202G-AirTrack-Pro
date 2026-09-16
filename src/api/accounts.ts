/**
 * AirTrack Pro - 多账号与工作空间注册中心
 * 支持用户自主添加任意合宙 IoT 账号，并内置官方演示网络（Demo Network）供即时体验
 */

export interface DeviceNameHint {
  name: string;
  shortName: string;
}

export interface AccountDef {
  phone: string;
  password?: string;
  label?: string;
  role?: string;
  projectKey?: string;
  isDemo?: boolean;
  nameHints?: Record<string, DeviceNameHint>;
}

export const DEMO_ACCOUNTS: AccountDef[] = [
  {
    phone: '18101796680',
    password: 'Hz8202',
    label: '演示空间 01',
    role: '开封 / 西安 示范车队',
    projectKey: 'q0eilWQpyjZGFZFS6PFmREsRjUXoButr',
    isDemo: true,
    nameHints: {
      '864317087172311': { name: '车载追踪器·72311', shortName: '车载72311' },
      '864317087172121': { name: '物联终端·72121', shortName: '终端72121' },
      '864317087173012': { name: '智慧定位·73012', shortName: '定位73012' },
      '864317087172782': { name: '待定位终端·72782', shortName: '待定72782' }
    }
  },
  {
    phone: '19036766195',
    password: 'Hz8202',
    label: '演示空间 02',
    role: '上海浦东 车载冷链',
    projectKey: 'ggV1VA89GUTQBMgqKszpSN6E2ZuQG5va',
    isDemo: true,
    nameHints: {
      '864317087172071': { name: '冷链监控·72071', shortName: '冷链72071' },
      '864317083931439': { name: '物流车载·31439', shortName: '物流31439' }
    }
  },
  {
    phone: '15938684042',
    password: 'Hz8202',
    label: '演示空间 03',
    role: '上海浦东 外勤巡检',
    projectKey: 'zmdfxP8TTUk6jBZoguWeQgSaEK6fiZu9',
    isDemo: true,
    nameHints: {
      '864317087172741': { name: '外勤车载·72741', shortName: '外勤72741' }
    }
  },
  {
    phone: '13384022744',
    password: 'Hz8202',
    label: '演示空间 04',
    role: '跨省干线 物流监控',
    projectKey: 'c3SeanQXjxiBvHYHZIDgi9FM6yBZj09s',
    isDemo: true,
    nameHints: {
      '864317087172683': { name: '长途车载·72683', shortName: '长途72683' }
    }
  }
];

// 兼容旧引用
export const OFFICIAL_ACCOUNTS = DEMO_ACCOUNTS;

const LS_USER_ACCOUNTS = 'airtrack_user_accounts';

export const DEFAULT_ACCOUNT_PHONE = DEMO_ACCOUNTS[0].phone;

/** 读取所有已注册账号（用户账号 + 演示账号） */
export function getAllRegisteredAccounts(): AccountDef[] {
  let userAccounts: AccountDef[] = [];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(LS_USER_ACCOUNTS);
      if (raw) userAccounts = JSON.parse(raw);
    }
  } catch (_) {}

  // 用户自主添加的账号在前，演示账号在后
  const list = [...userAccounts];
  for (const demo of DEMO_ACCOUNTS) {
    if (!list.some(a => a.phone === demo.phone)) {
      list.push(demo);
    }
  }
  return list;
}

/** 注册/保存新用户账号 */
export function registerUserAccount(account: { phone: string; label?: string; projectKey?: string }) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const raw = localStorage.getItem(LS_USER_ACCOUNTS);
    const list: AccountDef[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(a => a.phone === account.phone);
    const item: AccountDef = {
      phone: account.phone,
      label: account.label ? account.label.trim() : (idx >= 0 && list[idx].label ? list[idx].label : ''),
      role: '',
      projectKey: account.projectKey || '',
      isDemo: false,
      nameHints: {}
    };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item };
    } else {
      list.unshift(item);
    }
    localStorage.setItem(LS_USER_ACCOUNTS, JSON.stringify(list));
  } catch (_) {}
}

/** 修改用户账号自定义备注名 */
export function updateUserAccountLabel(phone: string, newLabel: string) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const raw = localStorage.getItem(LS_USER_ACCOUNTS);
    const list: AccountDef[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(a => a.phone === phone);
    if (idx >= 0) {
      list[idx].label = newLabel.trim();
      localStorage.setItem(LS_USER_ACCOUNTS, JSON.stringify(list));
    }
  } catch (_) {}
}

/** 移除已保存的账号 */
export function unregisterUserAccount(phone: string) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const raw = localStorage.getItem(LS_USER_ACCOUNTS);
    if (!raw) return;
    const list: AccountDef[] = JSON.parse(raw);
    const filtered = list.filter(a => a.phone !== phone);
    localStorage.setItem(LS_USER_ACCOUNTS, JSON.stringify(filtered));
  } catch (_) {}
}

export function findAccount(phone: string): AccountDef | undefined {
  return getAllRegisteredAccounts().find(a => a.phone === phone);
}
