/**
 * AirTrack Pro - 合宙 IoT 账号管理中心
 * 管理用户绑定的真实合宙账号，提供官方评测凭据辅助填入。
 */

export interface DeviceNameHint {
  name: string;
  shortName: string;
}

export interface AccountDef {
  phone: string;
  password?: string;
  label?: string;
  projectKey?: string;
  nameHints?: Record<string, DeviceNameHint>;
}

/** 官方用于活动评测与接口调试的 4 个真实硬件账号（公用评测凭据） */
export const EVAL_ACCOUNTS: AccountDef[] = [
  {
    phone: '18101796680',
    password: 'Hz8202',
    label: '',
    projectKey: 'q0eilWQpyjZGFZFS6PFmREsRjUXoButr',
    nameHints: {
      '864317087172311': { name: '设备 72311', shortName: '72311' },
      '864317087172121': { name: '设备 72121', shortName: '72121' },
      '864317087173012': { name: '设备 73012', shortName: '73012' },
      '864317087172782': { name: '设备 72782', shortName: '72782' }
    }
  },
  {
    phone: '19036766195',
    password: 'Hz8202',
    label: '',
    projectKey: 'ggV1VA89GUTQBMgqKszpSN6E2ZuQG5va',
    nameHints: {
      '864317087172071': { name: '设备 72071', shortName: '72071' },
      '864317083931439': { name: '设备 31439', shortName: '31439' }
    }
  },
  {
    phone: '15938684042',
    password: 'Hz8202',
    label: '',
    projectKey: 'zmdfxP8TTUk6jBZoguWeQgSaEK6fiZu9',
    nameHints: {
      '864317087172741': { name: '设备 72741', shortName: '72741' }
    }
  },
  {
    phone: '13384022744',
    password: 'Hz8202',
    label: '',
    projectKey: 'c3SeanQXjxiBvHYHZIDgi9FM6yBZj09s',
    nameHints: {
      '864317087172683': { name: '设备 72683', shortName: '72683' }
    }
  }
];

// 兼容旧引用
export const OFFICIAL_ACCOUNTS = EVAL_ACCOUNTS;
export const DEMO_ACCOUNTS = EVAL_ACCOUNTS;

const LS_USER_ACCOUNTS = 'airtrack_user_accounts';

export const DEFAULT_ACCOUNT_PHONE = EVAL_ACCOUNTS[0].phone;

/** 读取所有已保存的账号列表 */
export function getAllRegisteredAccounts(): AccountDef[] {
  let userAccounts: AccountDef[] = [];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(LS_USER_ACCOUNTS);
      if (raw) userAccounts = JSON.parse(raw);
    }
  } catch (_) {}

  // 若用户尚未绑定任何账号，将官方评测账号提供为可用选项
  if (userAccounts.length === 0) {
    return [...EVAL_ACCOUNTS];
  }

  const list = [...userAccounts];
  for (const evalAcct of EVAL_ACCOUNTS) {
    if (!list.some(a => a.phone === evalAcct.phone)) {
      list.push(evalAcct);
    }
  }
  return list;
}

/** 注册/保存用户账号 */
export function registerUserAccount(account: { phone: string; label?: string; projectKey?: string; password?: string }) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const raw = localStorage.getItem(LS_USER_ACCOUNTS);
    const list: AccountDef[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(a => a.phone === account.phone);
    const item: AccountDef = {
      phone: account.phone,
      password: account.password || '',
      label: account.label ? account.label.trim() : (idx >= 0 && list[idx].label ? list[idx].label : ''),
      projectKey: account.projectKey || '',
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
