<template>
  <div class="relative w-screen h-screen overflow-hidden bg-cyber-950 text-slate-100 font-sans antialiased select-none">
    
    <!-- 1. 全景地图底座 -->
    <MapEngine ref="mapRef" class="absolute inset-0 z-0" />

    <!-- 2. 顶部双模隔离导航 Bar -->
    <header class="absolute top-2 left-2 right-2 md:top-3 md:left-3 md:right-3 z-30 pointer-events-none">
      <!-- 移动端专享 (< md) -->
      <DeviceBarMobile @open-auth="showAuthModal = true" />
      
      <!-- 桌面端专享 (>= md) -->
      <HeaderDesktop
        @open-auth="showAuthModal = true"
        @recenter="handleRecenter"
        @toggle-dock="isDesktopDockOpen = !isDesktopDockOpen"
        @toggle-inspector="isDesktopInspectorOpen = !isDesktopInspectorOpen"
      />
    </header>

    <!-- 3. 桌面端左侧设备泊位坞 (hidden md:flex) -->
    <DeviceDockDesktop :is-open="isDesktopDockOpen" />

    <!-- 4. 移动端专享：悬浮回正 FAB (md:hidden，零碰撞定位于 bottom-[172px]) -->
    <div class="md:hidden fixed right-3 z-30 transition-all duration-300 bottom-[172px] pointer-events-auto">
      <button
        @click="handleRecenter"
        title="镜头平滑聚焦回当前车辆位置"
        class="w-10 h-10 rounded-2xl glass-panel border border-cyber-primary/60 text-cyber-primary flex items-center justify-center shadow-fab-shadow hover:bg-cyber-primary/20 hover:scale-105 active:scale-90 transition-all backdrop-blur-xl bg-cyber-900/90 text-sm"
      >
        🎯
      </button>
    </div>

    <!-- 5. 核心自适应感知面板 (移动端底部弹性三档抽屉 vs 桌面端右侧控制台) -->
    <InspectorDrawer :is-desktop-open="isDesktopInspectorOpen" />

    <!-- 6. 底部自适应时间轴控制台 -->
    <div
      class="
        fixed bottom-[82px] left-2 right-2 z-20 flex flex-col items-center pointer-events-none transition-all duration-300
        md:fixed md:bottom-3 md:left-3 md:right-3 md:max-w-5xl md:mx-auto md:z-20
      "
    >
      <TimelineHud />
    </div>

    <!-- 7. 官方评测账号管理弹层 -->
    <AuthModal :is-open="showAuthModal" @close="showAuthModal = false" />

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useDeviceStore } from '../../stores/device';
import { useTimelineStore } from '../../stores/timeline';
import MapEngine from '../../components/MapEngine.vue';
import TimelineHud from '../../components/TimelineHud.vue';
import InspectorDrawer from '../../components/InspectorDrawer.vue';
import DeviceBarMobile from '../../components/DeviceBarMobile.vue';
import DeviceDockDesktop from '../../components/DeviceDockDesktop.vue';
import HeaderDesktop from '../../components/HeaderDesktop.vue';
import AuthModal from '../../components/AuthModal.vue';

const deviceStore = useDeviceStore();
const timelineStore = useTimelineStore();

const mapRef = ref<any>(null);
const showAuthModal = ref(false);
const isDesktopDockOpen = ref(true);
const isDesktopInspectorOpen = ref(true);

function handleRecenter() {
  if (mapRef.value?.recenter) {
    mapRef.value.recenter();
  }
}

onMounted(async () => {
  // 初始化拉取设备列表与初始轨迹
  await deviceStore.fetchDevices();
  if (deviceStore.activeDevice) {
    await timelineStore.loadTrackData(deviceStore.activeDevice.imei, 'recent_window');
  }
});
</script>

<style>
/* 全局暗黑背景与滚动条精简 */
html, body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: #030712;
  overflow: hidden;
}

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: rgba(7, 13, 29, 0.4); }
::-webkit-scrollbar-thumb { background: rgba(0, 240, 255, 0.25); border-radius: 99px; }
::-webkit-scrollbar-thumb:hover { background: #00f0ff; }
</style>
