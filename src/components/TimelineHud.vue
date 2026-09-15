<template>
  <div class="w-full flex flex-col items-center pointer-events-none">
    
    <!-- 宏观历史跨度配置弹层 -->
    <div
      v-if="showDatePopover && timelineStore.mode === 'range'"
      class="w-full max-w-xl glass-panel p-3.5 sm:p-4 rounded-2xl border border-cyber-primary/40 shadow-popover-shadow mb-2 pointer-events-auto transition-all backdrop-blur-2xl"
    >
      <div class="flex items-center justify-between pb-2 border-b border-white/10">
        <div class="flex items-center space-x-1.5 text-xs font-bold text-white">
          <span class="text-cyber-primary font-mono">⚡</span>
          <span>历史轨迹时空跨度 (AirCloud)</span>
        </div>
        <button @click="showDatePopover = false" class="text-slate-400 hover:text-white p-1">
          ✕
        </button>
      </div>

      <div class="mt-2.5">
        <div class="text-[10px] font-mono text-slate-400 mb-1">快速跨度:</div>
        <div class="grid grid-cols-3 sm:grid-cols-6 gap-1 text-[11px] font-mono">
          <button
            v-for="item in macroPresets"
            :key="item.key"
            @click="selectMacro(item.key)"
            :class="[
              'py-1 rounded-lg transition border',
              timelineStore.scope === item.key
                ? 'bg-cyber-primary/20 text-cyber-primary border-cyber-primary/40 font-bold'
                : 'bg-cyber-900 text-slate-300 border-white/5 hover:border-slate-500'
            ]"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- 超薄一体化时间轴胶囊 (高度 74px) -->
    <div class="w-full glass-panel px-3 py-2 rounded-2xl flex flex-col pointer-events-auto border border-white/10 shadow-2xl space-y-1.5 bg-gradient-to-b from-cyber-900/95 via-cyber-900/90 to-cyber-950/95">
      
      <!-- 纯净速度山脉轨道区 -->
      <div class="relative w-full">
        <div
          ref="trackContainer"
          class="relative w-full h-9 sm:h-10 bg-cyber-950 rounded-xl border border-white/10 overflow-visible cursor-crosshair flex items-center shadow-inner touch-none select-none"
          @mousemove="onTrackMouseMove"
          @click="onTrackClick"
          @mouseleave="onTrackMouseLeave"
        >
          <!-- Canvas 速度连续彩虹波形 -->
          <canvas ref="waveCanvas" class="absolute inset-0 w-full h-full rounded-xl pointer-events-none"></canvas>

          <!-- 刻度线背景 -->
          <div class="absolute inset-0 opacity-20 pointer-events-none rounded-xl" style="background: repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0, rgba(255,255,255,0.08) 1px, transparent 1px, transparent 2.5%);"></div>
          <div class="absolute inset-0 opacity-30 pointer-events-none rounded-xl" style="background: repeating-linear-gradient(90deg, rgba(0,240,255,0.25) 0, rgba(0,240,255,0.25) 1px, transparent 1px, transparent 25%);"></div>

          <!-- 区间模式左右遮罩 -->
          <div
            v-if="timelineStore.mode === 'range'"
            class="absolute top-0 bottom-0 left-0 bg-cyber-950/80 backdrop-blur-[1px] rounded-l-xl pointer-events-none z-10"
            :style="{ width: timelineStore.rangeStart + '%' }"
          ></div>
          <div
            v-if="timelineStore.mode === 'range'"
            class="absolute top-0 bottom-0 right-0 bg-cyber-950/80 backdrop-blur-[1px] rounded-r-xl pointer-events-none z-10"
            :style="{ width: (100 - timelineStore.rangeEnd) + '%' }"
          ></div>

          <!-- 区间模式通透双把手光带 -->
          <div
            v-if="timelineStore.mode === 'range'"
            class="absolute top-0 bottom-0 z-10"
            :style="{ left: timelineStore.rangeStart + '%', width: (timelineStore.rangeEnd - timelineStore.rangeStart) + '%' }"
          >
            <!-- 选区通透主体 -->
            <div
              class="w-full h-full border-t-2 border-b-2 border-cyber-primary shadow-[0_0_16px_rgba(0,240,255,0.3)] flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-cyan-400/[0.04] transition-colors touch-none"
              @pointerdown="onPointerDown('body', $event)"
            ></div>

            <!-- 左把手 -->
            <div
              class="absolute -top-2 -bottom-2 -left-4 w-8 cursor-ew-resize flex items-center justify-center touch-none z-30"
              @pointerdown="onPointerDown('left', $event)"
            >
              <div class="w-2 h-6 sm:h-7 bg-gradient-to-r from-cyan-400 to-cyan-300 rounded-md shadow-handle-glow border border-white/80 pointer-events-none flex items-center justify-center">
                <div class="w-0.5 h-3 rounded-full bg-cyber-950"></div>
              </div>
              <div v-show="activeDrag === 'left' || activeDrag === 'body'" class="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-cyber-950/95 border border-cyan-400 rounded text-[9px] font-mono font-bold text-cyan-300 shadow-xl pointer-events-none whitespace-nowrap z-40 backdrop-blur-md">
                {{ formatRangeTime(timelineStore.rangeStart) }}
              </div>
            </div>

            <!-- 右把手 -->
            <div
              class="absolute -top-2 -bottom-2 -right-4 w-8 cursor-ew-resize flex items-center justify-center touch-none z-30"
              @pointerdown="onPointerDown('right', $event)"
            >
              <div class="w-2 h-6 sm:h-7 bg-gradient-to-r from-cyan-300 to-cyan-400 rounded-md shadow-handle-glow border border-white/80 pointer-events-none flex items-center justify-center">
                <div class="w-0.5 h-3 rounded-full bg-cyber-950"></div>
              </div>
              <div v-show="activeDrag === 'right' || activeDrag === 'body'" class="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-cyber-950/95 border border-cyan-400 rounded text-[9px] font-mono font-bold text-cyan-300 shadow-xl pointer-events-none whitespace-nowrap z-40 backdrop-blur-md">
                {{ formatRangeTime(timelineStore.rangeEnd) }}
              </div>
            </div>
          </div>

          <!-- 提交指针 (Playhead) -->
          <div
            class="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
            :style="{ left: timelineStore.committedPlayhead + '%', boxShadow: '0 0 10px #ffffff, 0 0 20px rgba(0,240,255,0.85)' }"
          >
            <div class="w-3.5 h-3.5 bg-white rounded-full absolute -top-1.5 -left-1.5 flex items-center justify-center border-2 border-cyber-950 shadow-glow-cyan">
              <div class="w-1.5 h-1.5 rounded-full bg-cyber-primary"></div>
            </div>
          </div>

          <!-- 悬浮微光探针 (Hover Needle) -->
          <div
            v-show="timelineStore.isHovering && !activeDrag"
            class="absolute top-0 bottom-0 w-[2px] z-20 pointer-events-none"
            :style="{
              left: timelineStore.hoverPlayhead + '%',
              backgroundImage: 'linear-gradient(to bottom, #00f0ff 60%, rgba(255,255,255,0) 0%)',
              backgroundSize: '1.5px 8px',
              backgroundRepeat: 'repeat-y'
            }"
          >
            <div class="w-3 h-3 bg-cyber-primary rounded-full absolute -top-1.5 -left-[5px] shadow-[0_0_12px_#00f0ff] flex items-center justify-center">
              <div class="w-1 h-1 bg-white rounded-full"></div>
            </div>
            <div v-if="timelineStore.hoverPoint" class="absolute -top-8 -translate-x-1/2 px-2 py-0.5 bg-cyber-900/95 border border-cyan-400 rounded-lg text-[9px] sm:text-[10px] font-mono font-bold text-white shadow-xl pointer-events-none whitespace-nowrap backdrop-blur-md flex items-center space-x-1 z-40">
              <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <span class="text-cyan-300">{{ timelineStore.hoverPoint.timeStr.slice(11, 19) }}</span>
              <span class="text-slate-500">|</span>
              <span class="text-emerald-400">{{ timelineStore.hoverPoint.speed }} km/h</span>
            </div>
          </div>

        </div>

        <!-- 刻度文本 -->
        <div class="flex items-center justify-between text-[8px] sm:text-[9px] font-mono text-slate-400 mt-1 px-1">
          <span>{{ scaleStart }}</span>
          <span>{{ scaleMid1 }}</span>
          <span class="hidden sm:inline">{{ scaleMid2 }}</span>
          <span>{{ scaleMid3 }}</span>
          <span class="text-cyber-primary font-bold flex items-center space-x-1">
            <span>{{ scaleEnd }}</span>
            <span class="w-1 h-1 rounded-full bg-cyber-primary animate-ping"></span>
          </span>
        </div>
      </div>

      <!-- 单行一体化控制栏 -->
      <div class="flex items-center justify-between flex-wrap gap-1.5 pt-1 border-t border-white/5 text-xs font-mono">
        
        <!-- 双模切换器 -->
        <div class="flex items-center bg-cyber-950/90 rounded-xl border border-white/10 p-0.5 shadow-inner">
          <button
            @click="timelineStore.setMode('live')"
            :class="[
              'px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center space-x-1',
              timelineStore.mode === 'live'
                ? 'text-cyber-primary bg-cyber-primary/15 border border-cyber-primary/30 shadow-glow-cyan'
                : 'text-slate-400 hover:text-white'
            ]"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse"></span>
            <span>跟随最新</span>
          </button>

          <button
            @click="timelineStore.setMode('range')"
            :class="[
              'px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all flex items-center space-x-1',
              timelineStore.mode === 'range'
                ? 'text-cyber-primary bg-cyber-primary/15 border border-cyber-primary/30 shadow-glow-cyan'
                : 'text-slate-400 hover:text-white'
            ]"
          >
            <span>区间回放</span>
          </button>

          <div v-if="timelineStore.mode === 'range'" class="h-3.5 w-px bg-white/10 mx-1"></div>

          <button
            v-if="timelineStore.mode === 'range'"
            @click="showDatePopover = !showDatePopover"
            class="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-[11px] text-slate-200 hover:text-cyber-primary transition flex items-center space-x-1"
          >
            <span class="text-cyber-primary">📅</span>
            <span class="font-bold">{{ currentScopeLabel }}</span>
            <span class="text-[9px] text-slate-400">▼</span>
          </button>
        </div>

        <!-- 播放控制簇 (区间模式展示) -->
        <div v-if="timelineStore.mode === 'range'" class="flex items-center space-x-1.5">
          <div class="flex items-center bg-cyber-950/90 p-0.5 rounded-xl border border-white/10">
            <button
              @click="timelineStore.togglePlayback()"
              class="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 transition flex items-center space-x-1 shadow-glow-emerald"
            >
              <span>{{ timelineStore.isPlaying ? '暂停' : '播放' }}</span>
            </button>
            <button
              @click="timelineStore.setPlaySpeed(1)"
              :class="['px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px]', timelineStore.playSpeed === 1 ? 'bg-cyber-primary/20 text-cyber-primary font-bold' : 'text-slate-400 hover:text-white']"
            >
              1x
            </button>
            <button
              @click="timelineStore.setPlaySpeed(5)"
              :class="['px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px]', timelineStore.playSpeed === 5 ? 'bg-cyber-primary/20 text-cyber-primary font-bold' : 'text-slate-400 hover:text-white']"
            >
              5x
            </button>
          </div>
        </div>

        <!-- 右侧当前时空状态 -->
        <div class="flex items-center space-x-1 sm:space-x-2 text-[10px] sm:text-[11px]">
          <template v-if="timelineStore.mode === 'live'">
            <div class="flex items-center space-x-1">
              <span class="w-1.5 h-1.5 rounded-full bg-cyber-emerald"></span>
              <span class="text-cyber-emerald font-bold hidden sm:inline">实时锁定</span>
            </div>
            <span class="text-white font-bold">{{ timelineStore.currentPoint?.timeStr.slice(11, 19) || '14:00:00' }}</span>
            <span class="text-slate-500">·</span>
            <span class="text-cyber-primary font-bold">{{ timelineStore.currentPoint?.speed || 0 }} km/h</span>
          </template>

          <template v-else>
            <span class="text-white font-bold">{{ timelineStore.currentPoint?.timeStr.slice(11, 16) || '07-27 17:58' }}</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyber-primary/20 border border-cyber-primary/40 text-cyber-primary">
              {{ timelineStore.currentPoint?.speed || 0 }} km/h
            </span>
          </template>
        </div>

      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useTimelineStore } from '../stores/timeline';
import { useDeviceStore } from '../stores/device';

const timelineStore = useTimelineStore();
const deviceStore = useDeviceStore();

const trackContainer = ref<HTMLElement | null>(null);
const waveCanvas = ref<HTMLCanvasElement | null>(null);
const showDatePopover = ref(false);

const macroPresets = [
  { key: 'today', label: '今日' },
  { key: 'yesterday', label: '昨日' },
  { key: '3d', label: '近3天' },
  { key: '7d', label: '近7天' },
  { key: '30d', label: '近1月' },
  { key: '90d', label: '近1季' }
];

const currentScopeLabel = computed(() => {
  const hit = macroPresets.find(m => m.key === timelineStore.scope);
  return hit ? hit.label : '近1季';
});

const scaleStart = computed(() => timelineStore.trackPoints[0]?.timeStr.slice(11, 16) || '08:00');
const scaleMid1 = computed(() => timelineStore.trackPoints[25]?.timeStr.slice(11, 16) || '09:30');
const scaleMid2 = computed(() => timelineStore.trackPoints[50]?.timeStr.slice(11, 16) || '11:00');
const scaleMid3 = computed(() => timelineStore.trackPoints[75]?.timeStr.slice(11, 16) || '12:30');
const scaleEnd = computed(() => (timelineStore.trackPoints[99]?.timeStr.slice(11, 16) || '14:00') + ' (最新)');

function formatRangeTime(percent: number): string {
  const pts = timelineStore.trackPoints;
  if (!pts.length) return '';
  const idx = Math.min(Math.floor((percent / 100) * (pts.length - 1)), pts.length - 1);
  return pts[idx].timeStr.slice(5, 16);
}

function selectMacro(key: string) {
  timelineStore.loadTrackData(deviceStore.activeImei, key);
  showDatePopover.value = false;
}

// 连续速度彩虹渐变计算
const CHROMA_STOPS = [
  { v: 0,  r: 59,  g: 130, b: 246 },
  { v: 12, r: 0,   g: 240, b: 255 },
  { v: 24, r: 16,  g: 185, b: 129 },
  { v: 38, r: 234, g: 179, b: 8 },
  { v: 50, r: 249, g: 115, b: 22 },
  { v: 65, r: 244, g: 63,  b: 94 }
];

function getContinuousSpeedRgb(speed: number): string {
  if (speed <= CHROMA_STOPS[0].v) return `rgb(${CHROMA_STOPS[0].r},${CHROMA_STOPS[0].g},${CHROMA_STOPS[0].b})`;
  const last = CHROMA_STOPS[CHROMA_STOPS.length - 1];
  if (speed >= last.v) return `rgb(${last.r},${last.g},${last.b})`;

  for (let i = 0; i < CHROMA_STOPS.length - 1; i++) {
    const s1 = CHROMA_STOPS[i];
    const s2 = CHROMA_STOPS[i + 1];
    if (speed >= s1.v && speed <= s2.v) {
      const t = (speed - s1.v) / (s2.v - s1.v);
      const r = Math.round(s1.r + (s2.r - s1.r) * t);
      const g = Math.round(s1.g + (s2.g - s1.g) * t);
      const b = Math.round(s1.b + (s2.b - s1.b) * t);
      return `rgb(${r},${g},${b})`;
    }
  }
  return 'rgb(0, 240, 255)';
}

function drawWave() {
  const canvas = waveCanvas.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  ctx.fillStyle = '#060a17';
  ctx.fillRect(0, 0, w, h);

  const pts = timelineStore.trackPoints;
  if (!pts.length) return;

  const canvasPoints = [];
  const BASELINE_H = 3;
  const MAX_WAVE_H = h - 5;

  for (let i = 0; i < pts.length; i++) {
    const x = (i / (pts.length - 1)) * w;
    const sp = pts[i].speed;
    const waveH = BASELINE_H + (sp / 65) * (MAX_WAVE_H - BASELINE_H);
    canvasPoints.push({ x, y: h - waveH, speed: sp });
  }

  const speedGradient = ctx.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i < pts.length; i++) {
    speedGradient.addColorStop(i / (pts.length - 1), getContinuousSpeedRgb(pts[i].speed));
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(canvasPoints[0].x, canvasPoints[0].y);
  for (let i = 0; i < canvasPoints.length - 1; i++) {
    const xc = (canvasPoints[i].x + canvasPoints[i + 1].x) / 2;
    const yc = (canvasPoints[i].y + canvasPoints[i + 1].y) / 2;
    ctx.quadraticCurveTo(canvasPoints[i].x, canvasPoints[i].y, xc, yc);
  }
  ctx.lineTo(canvasPoints[canvasPoints.length - 1].x, canvasPoints[canvasPoints.length - 1].y);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = speedGradient;
  ctx.globalAlpha = 0.88;
  ctx.fill();
  ctx.restore();

  // 顶部发光微光轮廓线
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(canvasPoints[0].x, canvasPoints[0].y);
  for (let i = 0; i < canvasPoints.length - 1; i++) {
    const xc = (canvasPoints[i].x + canvasPoints[i + 1].x) / 2;
    const yc = (canvasPoints[i].y + canvasPoints[i + 1].y) / 2;
    ctx.quadraticCurveTo(canvasPoints[i].x, canvasPoints[i].y, xc, yc);
  }
  ctx.lineTo(canvasPoints[canvasPoints.length - 1].x, canvasPoints[canvasPoints.length - 1].y);
  ctx.strokeStyle = '#ffffff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 4;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// 拖拽引擎
let activeDrag: 'left' | 'right' | 'body' | null = null;
let activePointerId: number | null = null;
let startX = 0;
let initStart = 0;
let initEnd = 0;

function onPointerDown(type: 'left' | 'right' | 'body', e: PointerEvent) {
  e.stopPropagation();
  e.preventDefault();
  activeDrag = type;
  activePointerId = e.pointerId;
  startX = e.clientX;
  initStart = timelineStore.rangeStart;
  initEnd = timelineStore.rangeEnd;

  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch (err) {}

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(e: PointerEvent) {
  if (!activeDrag || e.pointerId !== activePointerId || !trackContainer.value) return;
  const rect = trackContainer.value.getBoundingClientRect();
  const delta = ((e.clientX - startX) / rect.width) * 100;

  if (activeDrag === 'left') {
    timelineStore.setRange(initStart + delta, timelineStore.rangeEnd);
  } else if (activeDrag === 'right') {
    timelineStore.setRange(timelineStore.rangeStart, initEnd + delta);
  } else if (activeDrag === 'body') {
    const span = initEnd - initStart;
    let s = initStart + delta;
    let end = initEnd + delta;
    if (s < 0) { s = 0; end = span; }
    if (end > 100) { end = 100; s = 100 - span; }
    timelineStore.setRange(s, end);
  }
}

function onPointerUp(e: PointerEvent) {
  if (!activeDrag) return;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  activeDrag = null;
  activePointerId = null;
}

function onTrackMouseMove(e: MouseEvent) {
  if (activeDrag || !trackContainer.value) return;
  const rect = trackContainer.value.getBoundingClientRect();
  const p = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  timelineStore.setHover(true, p);
}

function onTrackClick(e: MouseEvent) {
  if (activeDrag || !trackContainer.value) return;
  const rect = trackContainer.value.getBoundingClientRect();
  const p = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  timelineStore.setCommittedPlayhead(p);
  timelineStore.setHover(false, p);
}

function onTrackMouseLeave() {
  if (!activeDrag) {
    timelineStore.setHover(false, 0);
  }
}

watch(() => timelineStore.trackPoints, () => {
  drawWave();
});

onMounted(() => {
  drawWave();
  window.addEventListener('resize', drawWave);
});
</script>
