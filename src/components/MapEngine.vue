<template>
  <div class="relative w-full h-full bg-cyber-950 overflow-hidden">
    <!-- 地图宿主 DOM 容器 -->
    <div ref="mapContainer" class="w-full h-full"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useDeviceStore } from '../stores/device';
import { useTimelineStore } from '../stores/timeline';
import type { TrackPoint } from '../api/types';

declare const TMap: any;

const mapContainer = ref<HTMLElement | null>(null);
const deviceStore = useDeviceStore();
const timelineStore = useTimelineStore();

let mapInstance: any = null;
let trackLines: any = null;
let vehicleMarker: any = null;
let fenceCircle: any = null;

// 动态生成雷达脉冲车辆图标
function generateCarMarkerIcon(): string {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d');
  if (!ctx) return '';

  // 外层微光环
  ctx.beginPath();
  ctx.arc(24, 24, 21, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
  ctx.fill();
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 内层主体底盘
  ctx.beginPath();
  ctx.arc(24, 24, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#070d1d';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 前进航向箭头
  ctx.beginPath();
  ctx.moveTo(24, 14);
  ctx.lineTo(31, 30);
  ctx.lineTo(24, 26);
  ctx.lineTo(17, 30);
  ctx.closePath();
  ctx.fillStyle = '#00f0ff';
  ctx.fill();

  return c.toDataURL();
}

// 连续速度彩虹渐变计算
const CHROMA_STOPS = [
  { v: 0,  r: 59,  g: 130, b: 246, hex: '#3b82f6' },
  { v: 12, r: 0,   g: 240, b: 255, hex: '#00f0ff' },
  { v: 24, r: 16,  g: 185, b: 129, hex: '#10b981' },
  { v: 38, r: 234, g: 179, b: 8,   hex: '#eab308' },
  { v: 50, r: 249, g: 115, b: 22,  hex: '#f97316' },
  { v: 65, r: 244, g: 63,  b: 94,  hex: '#f43f5e' }
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

function initMap() {
  if (typeof TMap === 'undefined' || !mapContainer.value) return;

  const dev = deviceStore.activeDevice;
  const center = new TMap.LatLng(dev.gcjLat, dev.gcjLng);

  mapInstance = new TMap.Map(mapContainer.value, {
    center: center,
    zoom: 14,
    viewMode: '2D',
    mapStyleId: 'style1', // 腾讯官方极客暗黑主题
    control: {
      zoom: false,
      rotation: false,
      scale: false
    }
  });

  trackLines = new TMap.MultiPolyline({
    map: mapInstance,
    styles: {
      rainbow_style: new TMap.PolylineStyle({
        width: 6,
        borderWidth: 1,
        lineCap: 'round'
      })
    }
  });

  vehicleMarker = new TMap.MultiMarker({
    map: mapInstance,
    styles: {
      car_icon: new TMap.MarkerStyle({
        width: 48,
        height: 48,
        anchor: { x: 24, y: 24 },
        src: generateCarMarkerIcon()
      })
    },
    geometries: [
      {
        id: 'v1',
        styleId: 'car_icon',
        position: center,
        properties: { title: dev.name }
      }
    ]
  });

  fenceCircle = new TMap.MultiCircle({
    map: mapInstance,
    styles: {
      fence: new TMap.CircleStyle({
        color: 'rgba(0, 240, 255, 0.12)',
        showBorder: true,
        borderColor: '#00f0ff',
        borderWidth: 1.5
      })
    },
    geometries: [{ center: center, radius: 1000, styleId: 'fence' }]
  });

  renderTrack();
}

function renderTrack() {
  if (!trackLines || !timelineStore.trackPoints.length) return;

  let pts = timelineStore.trackPoints;
  if (timelineStore.mode === 'range') {
    const sIdx = Math.floor((timelineStore.rangeStart / 100) * (pts.length - 1));
    const eIdx = Math.floor((timelineStore.rangeEnd / 100) * (pts.length - 1));
    pts = pts.slice(sIdx, eIdx + 1);
  }

  const rainbowPaths = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const avgSpeed = (p1.speed + p2.speed) / 2;
    rainbowPaths.push({
      path: [new TMap.LatLng(p1.gcjLat, p1.gcjLng), new TMap.LatLng(p2.gcjLat, p2.gcjLng)],
      color: getContinuousSpeedRgb(avgSpeed),
      borderColor: 'rgba(7, 13, 29, 0.45)'
    });
  }

  trackLines.setGeometries([
    {
      id: 'track_rainbow',
      styleId: 'rainbow_style',
      rainbowPaths: rainbowPaths
    }
  ]);
}

// 监听当前设备变化，平滑飞渡
watch(
  () => deviceStore.activeImei,
  () => {
    if (!mapInstance) return;
    const dev = deviceStore.activeDevice;
    const center = new TMap.LatLng(dev.gcjLat, dev.gcjLng);
    mapInstance.panTo(center);
    if (vehicleMarker) {
      vehicleMarker.setGeometries([
        {
          id: 'v1',
          styleId: 'car_icon',
          position: center,
          properties: { title: dev.name }
        }
      ]);
    }
  }
);

// 监听时间轴当前点位变化，联动小车位移
watch(
  () => timelineStore.currentPoint,
  (pt: TrackPoint | null) => {
    if (!pt || !vehicleMarker) return;
    const pos = new TMap.LatLng(pt.gcjLat, pt.gcjLng);
    vehicleMarker.setGeometries([
      {
        id: 'v1',
        styleId: 'car_icon',
        position: pos,
        properties: { title: deviceStore.activeDevice.name }
      }
    ]);
  }
);

// 监听时间轴模式或选区变化，重新绘制彩虹轨迹
watch(
  [() => timelineStore.mode, () => timelineStore.rangeStart, () => timelineStore.rangeEnd, () => timelineStore.trackPoints],
  () => {
    renderTrack();
  }
);

onMounted(() => {
  if (typeof TMap === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://map.qq.com/api/gljs?v=1.exp&key=EZNBZ-VA6KW-ASMRR-3UE4S-M3QCO-EYBC6';
    script.onload = () => {
      initMap();
    };
    document.head.appendChild(script);
  } else {
    initMap();
  }
});

onUnmounted(() => {
  if (mapInstance) {
    mapInstance.destroy();
    mapInstance = null;
  }
});

defineExpose({
  recenter: () => {
    if (!mapInstance) return;
    const dev = deviceStore.activeDevice;
    mapInstance.panTo(new TMap.LatLng(dev.gcjLat, dev.gcjLng));
  }
});
</script>
