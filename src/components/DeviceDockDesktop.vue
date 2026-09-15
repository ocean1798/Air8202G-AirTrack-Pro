<template>
  <aside
    :class="[
      'hidden md:flex drawer-transition fixed top-16 left-3 bottom-28 w-72 md:w-80 glass-panel rounded-2xl border border-cyber-700/60 z-20 flex-col pointer-events-auto shadow-2xl select-none',
      isOpen ? 'translate-x-0 opacity-100' : '-translate-x-[115%] opacity-0 pointer-events-none'
    ]"
  >
    <div class="p-3 border-b border-cyber-700/50 flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <span class="text-cyber-primary text-xs">🚀</span>
        <span class="text-xs font-bold text-slate-200">在网感知节点</span>
      </div>
      <span class="text-[10px] font-mono text-slate-400 bg-cyber-900 px-2 py-0.5 rounded border border-cyber-700">
        共 {{ deviceStore.devices.length }} 台
      </span>
    </div>

    <div class="flex-1 overflow-y-auto p-2 space-y-2">
      <div
        v-for="dev in deviceStore.devices"
        :key="dev.imei"
        @click="deviceStore.setActiveDevice(dev.imei)"
        :class="[
          'p-3 rounded-xl cursor-pointer transition-all border',
          deviceStore.activeImei === dev.imei
            ? 'border-cyber-primary/60 bg-cyber-primary/10 hover:border-cyber-primary'
            : 'border-cyber-700/50 bg-cyber-900/40 hover:border-slate-500'
        ]"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-1.5">
            <span
              :class="[
                'w-2 h-2 rounded-full',
                dev.online ? 'bg-cyber-emerald animate-pulse' : 'bg-slate-500'
              ]"
            ></span>
            <span class="text-xs font-bold text-white">{{ dev.name }}</span>
          </div>
          <span
            :class="[
              'text-[9px] font-mono px-1.5 py-0.5 rounded border',
              dev.online ? 'text-cyber-emerald bg-cyber-emerald/15 border-cyber-emerald/30' : 'text-slate-400 bg-slate-800 border-transparent'
            ]"
          >
            {{ dev.online ? '在线' : '待机' }}
          </span>
        </div>

        <div class="text-[10px] font-mono text-slate-400 mt-1">IMEI: {{ dev.imei }}</div>
        <div class="text-[10px] text-slate-300 mt-1 truncate">{{ dev.address || '正在获取定位街道...' }}</div>

        <div class="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
          <span class="text-cyber-emerald font-bold">{{ dev.voltageMv }}mV</span>
          <span class="text-cyber-primary bg-cyber-primary/10 px-1.5 py-0.5 rounded border border-cyber-primary/20">
            预估 ~{{ Math.round((dev.voltageMv - 3400) / 16) }}天
          </span>
          <span class="text-slate-400">CSQ {{ dev.csq }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useDeviceStore } from '../stores/device';

defineProps<{
  isOpen: boolean;
}>();

const deviceStore = useDeviceStore();
</script>

<style scoped>
.drawer-transition {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
