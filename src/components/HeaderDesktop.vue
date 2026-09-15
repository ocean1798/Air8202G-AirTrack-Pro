<template>
  <div class="hidden md:flex items-center justify-between w-full pointer-events-none">
    <!-- 桌面端左侧：品牌标牌 -->
    <div class="glass-panel px-3.5 py-2 rounded-2xl flex items-center space-x-3 pointer-events-auto border border-cyber-700/60 shadow-lg">
      <div class="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500/30 to-blue-600/40 border border-cyber-primary/50 flex items-center justify-center shadow-glow-cyan">
        <span class="text-cyber-primary text-xs">🛰️</span>
      </div>
      <div>
        <div class="flex items-center space-x-1.5">
          <span class="font-bold text-xs tracking-wider text-white">AirTrack Pro</span>
          <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyber-primary/20 text-cyber-primary border border-cyber-primary/40 font-bold">Web 控制台</span>
        </div>
        <div class="text-[10px] text-slate-400 font-mono flex items-center space-x-2">
          <span class="text-slate-200">{{ deviceStore.activeDevice.name }} ({{ deviceStore.activeDevice.online ? '在线' : '待机' }})</span>
          <span class="text-cyber-emerald">● 4G蜂窝畅通</span>
        </div>
      </div>
    </div>

    <!-- 桌面端右侧控制簇 -->
    <div class="flex items-center space-x-2 pointer-events-auto">
      <!-- 官方测试账号明文胶囊 -->
      <button
        @click="$emit('open-auth')"
        class="glass-panel px-3 py-1.5 rounded-2xl text-xs font-mono text-cyber-primary border border-cyber-primary/40 hover:bg-cyber-primary/15 transition flex items-center space-x-1.5 shadow-glow-cyan"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-cyber-primary animate-pulse"></span>
        <span class="text-slate-400">评测账号:</span>
        <span class="font-bold text-white tracking-wider">18101796680</span>
      </button>

      <!-- 镜头回正按键 -->
      <button
        @click="$emit('recenter')"
        title="镜头聚焦当前车辆"
        class="glass-panel p-2.5 rounded-2xl text-slate-300 hover:text-cyber-primary hover:border-cyber-primary transition shadow-lg active:scale-90"
      >
        <span>🎯</span>
      </button>

      <!-- 左侧设备坞折叠键 -->
      <button
        @click="$emit('toggle-dock')"
        title="折叠/展开左侧设备坞"
        class="glass-panel p-2.5 rounded-2xl text-slate-300 hover:text-cyber-primary hover:border-cyber-primary transition shadow-lg"
      >
        <span>📑</span>
      </button>

      <!-- 右侧感知面板折叠键 -->
      <button
        @click="$emit('toggle-inspector')"
        title="折叠/展开右侧感知面板"
        class="glass-panel p-2.5 rounded-2xl text-slate-300 hover:text-cyber-primary hover:border-cyber-primary transition shadow-lg"
      >
        <span>📊</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDeviceStore } from '../stores/device';

defineEmits(['open-auth', 'recenter', 'toggle-dock', 'toggle-inspector']);
const deviceStore = useDeviceStore();
</script>
