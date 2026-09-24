/**
 * AirTrack Pro - 商业级 IoT 账号管理系统
 * 支持用户自主绑定、官方 OAuth 授权与合宙 ProjectKey 直连，无任何硬编码测试账号。
 */

import { safeStorage } from '../utils/storage';

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

/** 初始预设账号数组（已彻底物理清空，回归纯净商业白板模式） */
export const EVAL_ACCOUNTS: AccountDef[] = [];
export const OFFICIAL_ACCOUNTS = EVAL_ACCOUNTS;
export const DEMO_ACCOUNTS = EVAL_ACCOUNTS;

/** 预设业务凭据字典（已物理清空） */
export const PRESET_AUTH_TOKENS: Record<string, { auth: any; service: any; profile?: any }> = {};

const LS_USER_ACCOUNTS = 'airtrack_user_accounts';

export const DEFAULT_ACCOUNT_PHONE = '';

/** 人性化格式化手机号或账号标识显示（如 "138 0000 0000" 或 "官方授权 (PVASX7)"） */
export function formatPhone(phone: string): string {
  if (!phone) return '未命名账号';
  if (phone === 'master' || phone === '主账号') return '官方授权主账号';
  if (phone.startsWith('master_')) {
    const hash = phone.slice(7).trim().toUpperCase();
    return hash ? `官方授权 (${hash})` : '官方授权主账号';
  }
  if (/^\d{11}$/.test(phone)) {
    return `${phone.slice(0, 3)} ${phone.slice(3, 7)} ${phone.slice(7, 11)}`;
  }
  return phone;
}

export interface AccountDisplayContext {
  phone: string;
  label?: string;
  cloudProfileName?: string;
}

/** 工业级单值账号展示标题解析管道（Tier 1~7 阶梯降级，消除重复冒号拼接） */
export function getAccountDisplayTitle(ctx: AccountDisplayContext): string {
  const p = (ctx.phone || '').trim();
  const rawLbl = (ctx.label || '').trim();
  const cName = (ctx.cloudProfileName || '').trim();

  // Tier 1: 真实云端用户名 (若合宙云端或历史透出用户名)
  if (cName) return cName;

  // Tier 2: 用户自定义的非模板别名
  const isTemplateLabel =
    !rawLbl ||
    /^账号\s*\d+$/i.test(rawLbl) ||
    /^官方((主)?账号|授权(主账号)?)(\s*\(?[A-Z0-9]*\)?)?$/i.test(rawLbl) ||
    rawLbl === p;
  if (!isTemplateLabel) {
    return rawLbl;
  }

  // Tier 3: 11 位数字手机号
  if (/^\d{11}$/.test(p)) {
    return `${p.slice(0, 3)} ${p.slice(3, 7)} ${p.slice(7, 11)}`;
  }

  // Tier 4: 动态 master 指纹
  if (p.startsWith('master_')) {
    const hash = p.slice(7).trim().toUpperCase();
    return hash ? `官方授权 (${hash})` : '官方授权主账号';
  }

  // Tier 5: 静态 master
  if (p === 'master' || p === '主账号') {
    return '官方授权主账号';
  }

  // Tier 6: 其他有效字符串原文
  if (p) return p;

  // Tier 7: 空兜底
  return '未接入账号';
}

/** 读取所有已绑定的用户账号列表 */
export function getAllRegisteredAccounts(): AccountDef[] {
  try {
    const raw = safeStorage.getItem(LS_USER_ACCOUNTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        let changed = false;
        const seenPhones = new Set<string>();
        const cleanList: AccountDef[] = [];

        for (const a of parsed) {
          if (!a) continue;
          let p = (a.phone || '').trim();
          if (!p || p === '主账号' || /[^\x00-\x7F]/.test(p)) {
            p = 'master';
            changed = true;
          }
          if (seenPhones.has(p)) {
            changed = true;
            continue;
          }
          seenPhones.add(p);
          cleanList.push({
            ...a,
            phone: p,
            label: a.label || (p === 'master' ? '官方授权主账号' : '')
          });
        }

        if (changed) {
          safeStorage.setItem(LS_USER_ACCOUNTS, JSON.stringify(cleanList));
        }
        return cleanList;
      }
    }
  } catch (_) {}
  return [];
}

/** 注册/保存用户账号 */
export function registerUserAccount(account: { phone: string; label?: string; projectKey?: string; password?: string }) {
  try {
    let targetPhone = account.phone && account.phone.trim() ? account.phone.trim() : 'master';
    if (targetPhone === '主账号' || /[^\x00-\x7F]/.test(targetPhone)) {
      targetPhone = 'master';
    }
    const raw = safeStorage.getItem(LS_USER_ACCOUNTS);
    const list: AccountDef[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(a => a.phone === targetPhone || (targetPhone === 'master' && (a.phone === '主账号' || !a.phone)));
    const existing = idx >= 0 ? list[idx] : null;
    const item: AccountDef = {
      phone: targetPhone,
      password: account.password || (existing?.password || ''),
      label: account.label ? account.label.trim() : (existing?.label || (targetPhone === 'master' ? '官方授权主账号' : '')),
      projectKey: account.projectKey || (existing?.projectKey || ''),
      nameHints: existing?.nameHints || {}
    };
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...item };
    } else {
      list.unshift(item);
    }
    const seen = new Set<string>();
    const deduplicated = list.filter(a => {
      if (seen.has(a.phone)) return false;
      seen.add(a.phone);
      return true;
    });
    safeStorage.setItem(LS_USER_ACCOUNTS, JSON.stringify(deduplicated));
  } catch (_) {}
}

/** 修改用户账号自定义备注名 */
export function updateUserAccountLabel(phone: string, newLabel: string) {
  try {
    const raw = safeStorage.getItem(LS_USER_ACCOUNTS);
    const list: AccountDef[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(a => a.phone === phone);
    if (idx >= 0) {
      list[idx].label = newLabel.trim();
      safeStorage.setItem(LS_USER_ACCOUNTS, JSON.stringify(list));
    }
  } catch (_) {}
}

/** 移除已绑定的账号 */
export function unregisterUserAccount(phone: string) {
  try {
    const raw = safeStorage.getItem(LS_USER_ACCOUNTS);
    if (!raw) return;
    const list: AccountDef[] = JSON.parse(raw);
    const filtered = list.filter(a => a.phone !== phone);
    safeStorage.setItem(LS_USER_ACCOUNTS, JSON.stringify(filtered));
  } catch (_) {}
}

export function findAccount(phone: string): AccountDef | undefined {
  return getAllRegisteredAccounts().find(a => a.phone === phone);
}
