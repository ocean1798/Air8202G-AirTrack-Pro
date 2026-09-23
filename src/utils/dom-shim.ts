/**
 * AirTrack Pro - 微信小程序 JSCore 全域安全 DOM 桩 (Safe DOM Shim)
 * 仅在缺少全局变量时提供安全的降级桩，绝不强行覆盖或篡改微信开发者工具内部宿主对象
 */

export function installDomShim() {
  // #ifdef MP-WEIXIN
  const noop = () => {};
  const dummyEl: any = {
    innerText: '',
    innerHTML: '',
    value: '',
    style: {},
    dataset: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop,
    getAttribute: () => '',
    removeAttribute: noop,
    addEventListener: noop,
    removeEventListener: noop,
    focus: noop,
    blur: noop,
    scrollIntoView: noop,
    closest: () => null,
    querySelector: () => dummyEl,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 40, right: 375, bottom: 40 }),
    getContext: () => null
  };

  const locationShim: any = {
    href: 'https://ocean1798.github.io/Air8202G-AirTrack-Pro/',
    origin: 'https://ocean1798.github.io',
    protocol: 'https:',
    host: 'ocean1798.github.io',
    hostname: 'ocean1798.github.io',
    port: '',
    pathname: '/Air8202G-AirTrack-Pro/',
    search: '',
    hash: '',
    assign: noop,
    replace: noop,
    reload: noop
  };

  const historyShim: any = {
    length: 1,
    state: {},
    pushState: noop,
    replaceState: noop,
    back: noop,
    forward: noop,
    go: noop
  };

  const navigatorShim: any = {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.38',
    platform: 'iPhone'
  };

  if (typeof (globalThis as any).document === 'undefined') {
    (globalThis as any).document = {
      getElementById: () => dummyEl,
      querySelector: () => dummyEl,
      querySelectorAll: () => [],
      createElement: () => dummyEl,
      addEventListener: noop,
      removeEventListener: noop,
      body: dummyEl,
      title: 'AirTrack Pro'
    };
  }

  if (typeof (globalThis as any).window === 'undefined') {
    (globalThis as any).window = {
      innerWidth: 375,
      innerHeight: 812,
      devicePixelRatio: 2,
      addEventListener: noop,
      removeEventListener: noop,
      location: locationShim,
      history: historyShim,
      navigator: navigatorShim,
      document: (globalThis as any).document
    };
  }

  if (typeof (globalThis as any).location === 'undefined') {
    (globalThis as any).location = locationShim;
  }

  // 微信小程序 JSCore 注入标准 AbortSignal / AbortController 垫片，彻底消除 ReferenceError
  if (typeof (globalThis as any).AbortSignal === 'undefined') {
    class AbortSignalShim {
      aborted = false;
      onabort: ((ev?: any) => any) | null = null;
      private listeners: Array<() => void> = [];
      addEventListener(type: string, listener: () => void) {
        if (type === 'abort' && typeof listener === 'function') {
          this.listeners.push(listener);
        }
      }
      removeEventListener(type: string, listener: () => void) {
        if (type === 'abort') {
          this.listeners = this.listeners.filter(l => l !== listener);
        }
      }
      _triggerAbort() {
        this.aborted = true;
        if (typeof this.onabort === 'function') {
          try { this.onabort(); } catch (_) {}
        }
        for (const l of this.listeners) {
          try { l(); } catch (_) {}
        }
      }
      static abort(reason?: any): AbortSignalShim {
        const sig = new AbortSignalShim();
        sig.aborted = true;
        return sig;
      }
    }
    (globalThis as any).AbortSignal = AbortSignalShim;
  }

  if (typeof (globalThis as any).AbortController === 'undefined') {
    class AbortControllerShim {
      signal: any;
      constructor() {
        this.signal = new ((globalThis as any).AbortSignal || Object)();
      }
      abort() {
        if (this.signal && typeof this.signal._triggerAbort === 'function') {
          this.signal._triggerAbort();
        } else if (this.signal) {
          this.signal.aborted = true;
        }
      }
    }
    (globalThis as any).AbortController = AbortControllerShim;
  }

  if (typeof (globalThis as any).window !== 'undefined') {
    if (!(globalThis as any).window.AbortController) {
      (globalThis as any).window.AbortController = (globalThis as any).AbortController;
    }
    if (!(globalThis as any).window.AbortSignal) {
      (globalThis as any).window.AbortSignal = (globalThis as any).AbortSignal;
    }
  }
  // #endif
}

installDomShim();
