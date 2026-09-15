<template>
  <div class="md:hidden glass-panel w-full p-1.5 rounded-2xl flex items-center shadow-xl border border-white/10 pointer-events-auto backdrop-blur-2xl bg-cyber-900/90">
    <!-- 横向平滑滑动频道条 (头条/抖音交互规范) -->
    <div class="flex-1 overflow-x-auto no-scrollbar flex items-center space-x-1.5 pr-3 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]">
      <button
        v-for="dev in deviceStore.devices"
        :key="dev.imei"
        @click="deviceStore.setActiveDevice(dev.imei)"
        :class="[
          'shrink-0 px-2.5 py-1 rounded-xl glass-panel flex items-center space-x-1.5 transition-all active:scale-95 border',
          deviceStore.activeImei === dev.imei
            ? 'border-cyber-primary/70 bg-cyber-primary/20 text-cyber-primary shadow-glow-cyan font-bold'
            : 'border-cyber-700/60 bg-cyber-900/70 text-slate-300 hover:border-slate-500'
        ]"
      >
        <span
          :class="[
            'w-1.5 h-1.5 rounded-full',
            dev.online ? 'bg-cyber-emerald animate-pulse' : 'bg-slate-500'
          ]"
        ></span>
        <span class="text-xs whitespace-nowrap">{{ dev.shortName }}</span>
        <span
          :class="[
            'text-[9px] font-mono px-1 py-0.2 rounded font-bold border',
            dev.online ? 'bg-cyber-emerald/20 text-cyber-emerald border-cyber-emerald/30' : 'bg-slate-800 text-slate-400 border-transparent'
          ]"
        >
          {{ Math.round((dev.voltageMv - 3400) / 8) }}%
        </span>
      </button>
    </div>

    <!-- 垂直分割线 -->
    <div class="w-px h-5 bg-white/10 mx-1.5 shrink-0"></div>

    <!-- 纯头像按键 -->
    <button
      @click="$emit('open-auth')"
      class="shrink-0 relative group p-0.5 rounded-full border border-cyber-primary/50 shadow-glow-cyan hover:border-cyber-primary active:scale-95 transition-all bg-cyber-950/80"
    >
      <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600/40 via-cyber-800 to-blue-600/50 flex items-center justify-center overflow-hidden border border-white/20">
        <span class="text-xs text-cyber-primary">👤</span>
      </div>
      <span class="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-cyber-emerald border-2 border-cyber-950"></span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useDeviceStore } from '../stores/device';

defineEmits(['open-auth']);
const deviceStore = useDeviceStore();
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
