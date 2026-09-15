<template>
  <aside
    :class="[
      'drawer-transition glass-panel z-40 flex flex-col shadow-2xl select-none',
      /* 移动端 (< md): 底部三档抽屉 */
      'fixed inset-x-0 bottom-0 rounded-t-3xl border-t border-cyber-700/80',
      mobileSheetClass,
      /* 桌面端 (>= md): 右侧独立悬浮控制台 */
      'md:fixed md:inset-x-auto md:top-16 md:right-3 md:bottom-28 md:w-80 md:lg:w-96 md:rounded-2xl md:border md:border-cyber-700/60 md:z-20 md:h-auto md:max-h-none',
      isDesktopOpen ? 'md:translate-x-0 md:opacity-100' : 'md:translate-x-[115%] md:opacity-0'
    ]"
  >
    <!-- 移动端专享：顶部触摸拖拽把手药丸 (< md) -->
    <div
      class="w-full flex flex-col items-center pt-1.5 pb-0.5 cursor-pointer md:hidden active:opacity-75 touch-none"
      @click="cycleMobileSheet"
      @touchstart="onTouchStart"
      @touchend="onTouchEnd"
    >
      <div class="w-10 h-1 bg-slate-400/50 rounded-full hover:bg-cyber-primary transition-colors"></div>
    </div>

    <!-- 顶部固定车况头 (Sticky Header) -->
    <div
      class="px-3.5 py-2 border-b border-cyber-700/60 bg-cyber-900/95 flex items-center justify-between shrink-0 cursor-pointer md:cursor-default"
      @click="onHeaderClick"
    >
      <div class="flex-1">
        <div class="flex items-center space-x-2">
          <span class="text-xs font-bold text-white tracking-wide truncate max-w-[140px] sm:max-w-none">
            {{ activeDevice.name }}
          </span>
          <span class="text-[9px] font-mono text-cyber-primary bg-cyber-primary/10 border border-cyber-primary/30 px-1.5 py-0.2 rounded">
            GNSS 3D
          </span>
        </div>
        <div class="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center space-x-1.5 leading-tight">
          <span class="truncate max-w-[150px] sm:max-w-none">
            {{ activeDevice.lat.toFixed(4) }}°N, {{ activeDevice.lng.toFixed(4) }}°E
          </span>
          <span class="font-bold px-1.5 py-0.2 rounded text-[10px] bg-cyber-primary/20 text-cyber-primary">
            {{ currentSpeed }} km/h
          </span>
        </div>
      </div>

      <div class="flex items-center space-x-2">
        <!-- 一键布防按键 (P1创新) -->
        <button
          @click.stop="deviceStore.toggleArmed()"
          :class="[
            'px-2.5 py-1 rounded-xl text-[10px] font-bold transition flex items-center space-x-1',
            deviceStore.isArmed
              ? 'bg-cyber-emerald text-white shadow-glow-emerald hover:bg-emerald-600'
              : 'bg-cyber-800 text-slate-400 hover:text-white'
          ]"
        >
          <span>{{ deviceStore.isArmed ? '✓ 已设防' : '✕ 已撤防' }}</span>
        </button>

        <!-- 移动端箭头指示器 (< md) -->
        <button class="md:hidden p-1 text-slate-400 hover:text-white transition-transform">
          <span class="text-xs">{{ mobileSheetState === 'full' ? '▼' : '▲' }}</span>
        </button>
      </div>
    </div>

    <!-- 纵向平铺流式内容体 (5大模块全量平铺) -->
    <div class="flex-1 overflow-y-auto p-3 space-y-3.5 scroll-smooth overscroll-contain">
      
      <!-- 模块 1 · 3D姿态与航向拟真 -->
      <section class="glass-panel p-3 rounded-xl border border-cyber-primary/30 flex flex-col items-center justify-center shadow-lg">
        <div class="w-full flex items-center justify-between text-[11px] mb-1">
          <span class="text-slate-200 font-bold flex items-center space-x-1.5">
            <span class="text-cyber-primary">🧭</span>
            <span>3D 姿态与航向拟真</span>
          </span>
          <span class="text-[9px] font-mono text-cyber-primary bg-cyber-primary/10 px-1.5 py-0.5 rounded border border-cyber-primary/30">
            25Hz IMU
          </span>
        </div>

        <div class="relative w-32 h-32 sm:w-36 sm:h-36 my-2 flex items-center justify-center">
          <div class="w-32 h-32 sm:w-36 sm:h-36 rounded-full border-2 border-dashed border-cyan-400/40 flex items-center justify-center shadow-glow-cyan">
            <div
              class="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border border-cyber-primary/30 flex flex-col items-center justify-center bg-gradient-to-b from-cyan-950/40 via-cyber-900 to-amber-950/40 transition-transform duration-100"
              :style="{ transform: `rotate(${-roll}deg) translateY(${pitch * 1.2}px)` }"
            >
              <div class="w-full h-0.5 bg-cyber-primary shadow-glow-cyan"></div>
              <div class="text-[8px] font-mono text-cyber-primary/80 mt-0.5">HORIZON</div>
            </div>
            <div
              class="absolute w-1 h-24 sm:h-28 bg-gradient-to-t from-transparent via-rose-500 to-rose-400 rounded-full transition-transform duration-100"
              :style="{ transform: `rotate(${yaw}deg)` }"
            ></div>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 w-full text-center text-[10px] font-mono mt-1">
          <div class="bg-cyber-900 p-1.5 rounded-lg border border-cyber-700/50">
            <div class="text-slate-400">俯仰 (Pitch)</div>
            <div class="text-xs font-bold text-cyber-primary mt-0.5">{{ pitch > 0 ? '+' : '' }}{{ pitch.toFixed(1) }}°</div>
          </div>
          <div class="bg-cyber-900 p-1.5 rounded-lg border border-cyber-700/50">
            <div class="text-slate-400">横滚 (Roll)</div>
            <div class="text-xs font-bold text-cyber-emerald mt-0.5">{{ roll.toFixed(1) }}°</div>
          </div>
          <div class="bg-cyber-900 p-1.5 rounded-lg border border-cyber-700/50">
            <div class="text-slate-400">航向 (Yaw)</div>
            <div class="text-xs font-bold text-amber-400 mt-0.5">{{ yaw.toFixed(1) }}°</div>
          </div>
        </div>
      </section>

      <!-- 模块 2 · 三轴加速度动态波形 -->
      <section class="glass-panel p-3 rounded-xl border border-cyber-700/60 shadow-lg">
        <div class="flex items-center justify-between text-[11px] mb-1">
          <span class="text-slate-200 font-bold flex items-center space-x-1.5">
            <span class="text-cyber-emerald">📈</span>
            <span>三轴加速度 (Tag 1293)</span>
          </span>
          <span class="text-[9px] font-mono text-cyan-400">Z: 982mg</span>
        </div>
        <!-- 纯 CSS/SVG 模拟高性能微型波形 -->
        <div class="h-28 w-full bg-cyber-950 rounded-lg p-2 border border-cyber-700/40 flex flex-col justify-between">
          <div class="flex items-center justify-between text-[9px] font-mono text-slate-400">
            <span class="text-rose-400">● X: +142mg</span>
            <span class="text-emerald-400">● Y: -78mg</span>
            <span class="text-cyan-400">● Z: +982mg</span>
          </div>
          <div class="flex-1 flex items-center justify-center">
            <svg class="w-full h-16" viewBox="0 0 300 60" preserveAspectRatio="none">
              <path d="M0 30 Q 30 15, 60 30 T 120 30 T 180 30 T 240 30 T 300 30" fill="none" stroke="#f43f5e" stroke-width="1.5" />
              <path d="M0 35 Q 30 45, 60 35 T 120 35 T 180 35 T 240 35 T 300 35" fill="none" stroke="#10b981" stroke-width="1.5" />
              <path d="M0 15 Q 30 20, 60 15 T 120 15 T 180 15 T 240 15 T 300 15" fill="none" stroke="#00f0ff" stroke-width="2" />
            </svg>
          </div>
          <div class="text-[8px] font-mono text-slate-500 text-right">25Hz 连续滑动采样</div>
        </div>
      </section>

      <!-- 模块 3 · AirCloud Tag 字典黑匣子 -->
      <section class="glass-panel rounded-xl overflow-hidden border border-cyber-700/60 shadow-lg">
        <div class="p-2.5 bg-cyber-900/90 border-b border-cyber-700/50 flex items-center justify-between text-[11px]">
          <span class="text-slate-200 font-bold flex items-center space-x-1.5">
            <span class="text-cyber-primary">⚙</span>
            <span>AirCloud 工业级 Tag 字典</span>
          </span>
          <span class="text-[9px] font-mono text-cyber-emerald">实时校验通过</span>
        </div>
        <div class="font-mono text-[11px] divide-y divide-cyber-700/40">
          <div class="p-2.5 flex items-center justify-between bg-cyber-900/40">
            <span class="text-cyber-primary font-bold">Tag 799 (电池供电)</span>
            <span class="text-cyber-emerald font-bold">{{ activeDevice.voltageMv }} mV ({{ batteryStatus.percentage }}%)</span>
          </div>
          <div class="p-2.5 flex items-center justify-between">
            <span class="text-cyber-primary font-bold">Tag 782 (蜂窝信号)</span>
            <span class="text-cyan-300 font-bold">CSQ {{ activeDevice.csq }} (4G畅通)</span>
          </div>
          <div class="p-2.5 flex items-center justify-between bg-cyber-900/40">
            <span class="text-cyber-primary font-bold">Tag 512 / 513 (经纬度)</span>
            <span class="text-slate-200">{{ activeDevice.lat.toFixed(4) }}°N, {{ activeDevice.lng.toFixed(4) }}°E</span>
          </div>
          <div class="p-2.5 flex items-center justify-between">
            <span class="text-cyber-primary font-bold">Tag 514 (行驶航速)</span>
            <span class="text-cyber-emerald font-bold">{{ currentSpeed }} km/h</span>
          </div>
          <div class="p-2.5 flex items-center justify-between bg-cyber-900/40">
            <span class="text-cyber-primary font-bold">Tag 1294 (差分轨迹包)</span>
            <span class="text-slate-300">10s 稠密差分同步</span>
          </div>
        </div>
      </section>

      <!-- 模块 4 · 智能电子围栏防盗 -->
      <section class="glass-panel p-3 rounded-xl border border-cyber-700/60 space-y-2 shadow-lg">
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-200 font-bold flex items-center space-x-1.5">
            <span class="text-amber-400">🛡️</span>
            <span>智能电子围栏防盗</span>
          </span>
          <span class="text-[9px] font-mono text-cyber-emerald bg-cyber-emerald/10 border border-cyber-emerald/30 px-1.5 py-0.5 rounded">
            围栏内 (安全)
          </span>
        </div>
        <p class="text-[10px] text-slate-400">根据当前车辆驻留点划定 1000 米圆形电子围栏，越界将立即触发飞书与短信告警。</p>
      </section>

      <!-- 模块 5 · 行程质检与画像评分 -->
      <section class="glass-panel p-3 rounded-xl border border-cyber-700/60 space-y-2 shadow-lg">
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-200 font-bold flex items-center space-x-1.5">
            <span class="text-indigo-400">📊</span>
            <span>行程画像与评分</span>
          </span>
          <span class="text-[9px] font-mono text-slate-400">全量加权</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs font-mono">
          <div class="bg-cyber-900/80 p-2.5 rounded-lg border border-cyber-700/50">
            <div class="text-[10px] text-slate-400">总行驶里程</div>
            <div class="text-base font-black text-white mt-0.5">18.6 <span class="text-[10px] text-slate-400 font-normal">km</span></div>
          </div>
          <div class="bg-cyber-900/80 p-2.5 rounded-lg border border-cyber-700/50">
            <div class="text-[10px] text-slate-400">巡航均速</div>
            <div class="text-base font-black text-cyber-primary mt-0.5">22.4 <span class="text-[10px] text-slate-400 font-normal">km/h</span></div>
          </div>
        </div>
      </section>

      <div class="h-6"></div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useDeviceStore } from '../stores/device';
import { useTimelineStore } from '../stores/timeline';

const props = defineProps<{
  isDesktopOpen?: boolean;
}>();

const deviceStore = useDeviceStore();
const timelineStore = useTimelineStore();

const activeDevice = computed(() => deviceStore.activeDevice);
const batteryStatus = computed(() => deviceStore.batteryAnalysis);
const currentSpeed = computed(() => timelineStore.currentPoint?.speed || activeDevice.value.speed);

// 移动端三档高度状态: peek (74px) | half (48vh) | full (86vh)
const mobileSheetState = ref<'peek' | 'half' | 'full'>('peek');

const mobileSheetClass = computed(() => {
  if (mobileSheetState.value === 'peek') return 'h-[74px] overflow-hidden';
  if (mobileSheetState.value === 'half') return 'h-[48vh]';
  return 'h-[86vh]';
});

function cycleMobileSheet() {
  if (window.innerWidth >= 768) return;
  if (mobileSheetState.value === 'peek') mobileSheetState.value = 'half';
  else if (mobileSheetState.value === 'half') mobileSheetState.value = 'full';
  else mobileSheetState.value = 'peek';
}

function onHeaderClick() {
  if (window.innerWidth < 768) {
    cycleMobileSheet();
  }
}

// 触摸手势
let touchStartY = 0;
function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0].clientY;
}
function onTouchEnd(e: TouchEvent) {
  const deltaY = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(deltaY) > 30) {
    if (deltaY < -30) {
      if (mobileSheetState.value === 'peek') mobileSheetState.value = 'half';
      else if (mobileSheetState.value === 'half') mobileSheetState.value = 'full';
    } else {
      if (mobileSheetState.value === 'full') mobileSheetState.value = 'half';
      else if (mobileSheetState.value === 'half') mobileSheetState.value = 'peek';
    }
  }
}

// 3D 姿态仿真定时器
const pitch = ref(4.2);
const roll = ref(-1.5);
const yaw = ref(68.0);
let compassTimer: any = null;

onMounted(() => {
  let t = 0;
  compassTimer = setInterval(() => {
    t += 0.05;
    pitch.value = 4.2 + Math.sin(t) * 1.5;
    roll.value = -1.5 + Math.cos(t) * 1.2;
    yaw.value = 68.0 + Math.sin(t * 0.5) * 5;
  }, 100);
});

onUnmounted(() => {
  if (compassTimer) clearInterval(compassTimer);
});
</script>

<style scoped>
.drawer-transition {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>
