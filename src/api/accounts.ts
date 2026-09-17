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
  role?: string;
  isDemo?: boolean;
  projectKey?: string;
  nameHints?: Record<string, DeviceNameHint>;
}

/** 初始预置的 4 个真实硬件账号（支持零门槛直接开箱读取真实硬件资产） */
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

/** 4 个官方评测账号的预置有效业务凭据（支持零门槛直接开箱读取真实数据） */
export const PRESET_AUTH_TOKENS: Record<string, { auth: any; service: any; profile?: any }> = {
  "19036766195": {
    "auth": {
      "accessExpireAt": "2026-10-17 16:05:17",
      "nav": 112,
      "refresh": "Fu5eETTb3YqlVtr8",
      "refreshExpireAt": "2026-11-16 16:05:17",
      "salt": "fc54d5dc8da24c3a9291ae69d24ebc9f",
      "token": "vrnyDwptXVccHmQoN7mfAHH8pn3U7FiuVESgcmS1guhEqwiDxt2x4r5B9Fme7SK1Uqb13ut7quSqbiMcAPPXgDfpkj1fHMxXSKxxjyGpwMpRDtkQgzaLrCCLt3t2kbDCG9xUf91NEZgpJfSebCpLWDYc1GQRZzDURsQT91BDL9ReJ3Y8dPGHPzm9i8vnAVNyP7RScrsL7xdX6EKWYYqdj2EnS5BG2gTLLkrxooXpdpSvmTEHE5T3x3UyvtpF323kKU7MxvkQDDVCRfTzadFV6LWPTwDRf9p3UAujVkmJsmdGvxyuPugHuuDvjZbC6HFd7b2692rdm8mtPWwCJasJazs2oW464FSh7AD8YX5Er9355BbnFSVZNfjWKjcFbxtEk7jUSyzcGkH6YwUTS8Ri9QQqNVDDxFGFmFFyfqMS4DAgzpzq9KYtomLeJnbUbrHBFbDUZ8xaUc1W1LYP4ofbUcu3iPUy5nN8chT4VVFTAEvXEFJUnC61ZvNVsvZmKpH8WcXXeQkcPVuZSoZVLr8eFqx2H1ToCWLuCRsUsv1Q9YwHBWFjhq7YG5E4",
      "type": "Bearer"
    },
    "service": {
      "groupid": "20250818142846",
      "sid": "336677",
      "ctxt": "iot",
      "by": "null"
    },
    "profile": {}
  },
  "15938684042": {
    "auth": {
      "accessExpireAt": "2026-10-17 16:05:35",
      "nav": 112,
      "refresh": "Qr5USz3c7DrBQ3dY",
      "refreshExpireAt": "2026-11-16 16:05:35",
      "salt": "6e849c6282af4a47bada1da01506a74e",
      "token": "sZfzARUmtiM2VfgV6Eyp5wW7PNGK8CcMGreAdbx8urcvSPYRC5HQco93pqbmTgrhPXXhsvojb5xkErkkhcRzHfp3zKnMYwraTCQ11Nmym4vCag5GnZ31s1wfU1ntGn1CM7oU78hcGA3nNAyDkV8PQACcGkHDjRPJx6zAYoNmWeuhEhDho7Dc7wjAenFcdvbgtAeMCyd99QkhEhyxWpC71cNALSPR5HPrFDY8hyRkt9vGxeizJ3BiPwgWbhnW3CXuJbmxZgUdE12y6Gmrvw3wFjTGo3NzECkgZLJb2Sh8U9CW2PkVA3FZ9pD5WirNQMqTwRYwWGKRZ81v67wyTXSG8CKAdBgUCfzcMbFQnxztQobs6kHmaSw8S4RthYQ77XHbZ4rYQQTJdtRrb8EUGHTLiLpqegqDN8sBoyp5uC1htBVQqxkykaGtJfuqPbbBHYVyfsU26T6aRPwfLMBkTqeDhttaF8ixju4MBvf2ZVG1YQm2o3FPT4otFFqyr8KXqG6gUbxMbhLHbdwcv3jsXgyKaRHpxhrhu9U3VCbMLh2eg2hRM5TGGdM2RZAP",
      "type": "Bearer"
    },
    "service": {
      "groupid": "20250818142846",
      "sid": "336677",
      "ctxt": "iot",
      "by": "null"
    },
    "profile": {}
  },
  "13384022744": {
    "auth": {
      "accessExpireAt": "2026-10-17 16:05:55",
      "nav": 112,
      "refresh": "ty0slv950sNegxmP",
      "refreshExpireAt": "2026-11-16 16:05:55",
      "salt": "34db136cc5bb4c5f98f9f8118170d248",
      "token": "tAeFa3k_nZhsnn5KmFqsyAHiV2fnjepD9VFBGAulz-Wl0y1-rFIW53rajOlM5jJXa9_RlQlllMK3BEDPd8Zw3SDw4whPqLbE88l9gxxZhA2sb91IbjCrQMZZSMrNOyoQAlHG4DquEdkbH84WvtZkd_9sqT7bZaV_5UjADweX9CwFMBNuRhl-0Hre5pqlFtOg4YpSB7Eec9-I67_cFohCqjv_yVBYMKU12cSvfCJETjSpHG2D2_wc6z6aSFblM6rGSS28rSTJ5DbFLuvV0bfoHXZ9SUFREAA7YwMhY0NdlAgMae8nWhsJfql29oJcr-y9BGtr-O6CKXJZ6ncQleyz3z5vBeTFCRC1sNTwbYZFtV5N7Wo1D1CIartNv702iwmgzV0lspFUgOYWSkJm7vCwUJGFdHTvIUfd-YsI4Fr1W3jgqlz38uzDadJfyLPoEw0kK0ldBAq5-htZ3t5Gj6vxKShlq23gv8IOoqQ7RtoWimiaBhTSB_FFeaw4KV3O7-W_QCDBXjU-wdmFqPoWCro20g",
      "type": "Bearer"
    },
    "service": {
      "groupid": "20250818142846",
      "sid": "336677",
      "ctxt": "iot",
      "by": "null"
    },
    "profile": {}
  },
  "18101796680": {
    "auth": {
      "accessExpireAt": "2026-10-17 16:47:54",
      "nav": 112,
      "refresh": "I8361NFTFYU1JsRn",
      "refreshExpireAt": "2026-11-16 16:47:54",
      "salt": "5d3d66dd3f6640d09d832826aabe9a25",
      "token": "3f1faFB8h6o2gz82Y5X45jXCECrH3nzrkwKfkmPYmC7thgdqbqQprJ1Av1yh1bHK7gWJmMNjgs2EDgkA4mB6CKKhjQAgff3VMatfLXH23QHfD5mrU28gs4vg6YzPS9AHbxtjuap45U4KGCi3HZzRLfUZAWSpsbyVkLXiu2554ekhUnzMU98oXhqaT9r9gjwf8oju7pBYHkjZtPC2N1ojFPLqRoEvtSj7zke79c9gXM7MVW9LnZabzxfFZ9tPBxAgf1KBdzdgh3911ZmmsFWFghJGGs99HDo7NHsFUFzKr9Wn4SAdRYpGGd3TxBeRRmQSnZukxxJiA96UbvNjMiK3naVntMQHvvqixkprjGusFuBXLpT8tS1jA5ny6ofoskvsmTLhRaWJfrzM6D3jkuDbcBUyiTB7FT3gK49qvU33TgsduCxPi3cnrb9EaHAg42bK7yJYhgPf9PxmfViWL8CAndcN5Y2y2kKTMRjQL1DzqDDKvMQ9CndJLBnvQRzm9MUfcXXs6rjnhogfU",
      "type": "Bearer"
    },
    "service": {
      "groupid": "20250818142846",
      "sid": "336677",
      "ctxt": "iot",
      "by": "null"
    },
    "profile": {}
  }
};

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
    const existingIdx = list.findIndex(a => a.phone === evalAcct.phone);
    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...evalAcct,
        ...list[existingIdx],
        label: list[existingIdx].label || evalAcct.label,
        role: list[existingIdx].role || evalAcct.role
      };
    } else {
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
