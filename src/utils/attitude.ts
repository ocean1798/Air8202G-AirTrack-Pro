import type { AttitudeSample, AttitudeFrame } from '../api/types';

/**
 * 欧拉角 3D 向量类型
 */
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface Point2D {
  x: number;
  y: number;
}

/**
 * 纯数学 3D 旋转与透视投影计算
 */
function rotateAndProject(p: Vec3, rollDeg: number, pitchDeg: number, headingDeg: number, cx: number, cy: number, fov: number = 180): Point2D {
  const rad = Math.PI / 180;
  const r = rollDeg * rad;
  const pRad = pitchDeg * rad;
  const y = headingDeg * rad;

  // 1. Roll 绕 X 轴旋转
  const x1 = p.x;
  const y1 = p.y * Math.cos(r) - p.z * Math.sin(r);
  const z1 = p.y * Math.sin(r) + p.z * Math.cos(r);

  // 2. Pitch 绕 Y 轴旋转
  const x2 = x1 * Math.cos(pRad) + z1 * Math.sin(pRad);
  const y2 = y1;
  const z2 = -x1 * Math.sin(pRad) + z1 * Math.cos(pRad);

  // 3. Yaw (Heading) 绕 Z 轴旋转
  const x3 = x2 * Math.cos(y) - y2 * Math.sin(y);
  const y3 = x2 * Math.sin(y) + y2 * Math.cos(y);
  const z3 = z2;

  // 4. 观察相机透视投影 (Camera Z 偏移 130)
  const cameraZ = 130;
  const scale = fov / (cameraZ + z3);

  return {
    x: cx + x3 * scale,
    y: cy - y3 * scale // 屏幕 Y 轴向下，故取反
  };
}

/**
 * 生成 3D 正方体及三正交轴破体发射的 SVG Data-URI
 * 100% 纯数学字符串生成，支持 Web、Android、微信小程序无差别渲染
 */
export function buildCubeSvgDataUri(roll: number, pitch: number, heading: number, size: number = 112): string {
  const cx = size / 2;
  const cy = size / 2;
  const d = 11; // 等边正方体边长参数
  const axisLen = 44; // 破体发射的正交轴长度

  // 8 个立方体顶点
  const rawVertices: Vec3[] = [
    { x: -d, y: -d, z: -d },
    { x:  d, y: -d, z: -d },
    { x:  d, y:  d, z: -d },
    { x: -d, y:  d, z: -d },
    { x: -d, y: -d, z:  d },
    { x:  d, y: -d, z:  d },
    { x:  d, y:  d, z:  d },
    { x: -d, y:  d, z:  d }
  ];

  // 12 条棱连接关系
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  // 投影顶点
  const pVertices = rawVertices.map(v => rotateAndProject(v, roll, pitch, heading, cx, cy));

  // 正方体 12 条棱 SVG
  let edgesSvg = '';
  for (const [s, e] of edges) {
    const p1 = pVertices[s];
    const p2 = pVertices[e];
    edgesSvg += `<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="#00f0ff" stroke-width="1.2" stroke-opacity="0.65" />`;
  }

  // 中心原点
  const pCenter = rotateAndProject({ x: 0, y: 0, z: 0 }, roll, pitch, heading, cx, cy);

  // 三正交轴末端与箭头
  // X 轴: 红色 (Roll)
  const pX = rotateAndProject({ x: axisLen, y: 0, z: 0 }, roll, pitch, heading, cx, cy);
  // Y 轴: 绿色 (Pitch)
  const pY = rotateAndProject({ x: 0, y: axisLen, z: 0 }, roll, pitch, heading, cx, cy);
  // Z 轴: 青色 (Yaw/Heading)
  const pZ = rotateAndProject({ x: 0, y: 0, z: axisLen }, roll, pitch, heading, cx, cy);

  function createArrowSvg(pStart: Point2D, pEnd: Point2D, color: string, label: string): string {
    const angle = Math.atan2(pEnd.y - pStart.y, pEnd.x - pStart.x);
    const headLen = 7;
    const a1 = angle - Math.PI / 5.5;
    const a2 = angle + Math.PI / 5.5;

    const xArrow1 = pEnd.x - headLen * Math.cos(a1);
    const yArrow1 = pEnd.y - headLen * Math.sin(a1);
    const xArrow2 = pEnd.x - headLen * Math.cos(a2);
    const yArrow2 = pEnd.y - headLen * Math.sin(a2);

    const labelDist = 9;
    const lx = pEnd.x + labelDist * Math.cos(angle);
    const ly = pEnd.y + labelDist * Math.sin(angle) + 3;

    return `
      <line x1="${pStart.x.toFixed(1)}" y1="${pStart.y.toFixed(1)}" x2="${pEnd.x.toFixed(1)}" y2="${pEnd.y.toFixed(1)}" stroke="${color}" stroke-width="2.4" stroke-linecap="round" />
      <polygon points="${pEnd.x.toFixed(1)},${pEnd.y.toFixed(1)} ${xArrow1.toFixed(1)},${yArrow1.toFixed(1)} ${xArrow2.toFixed(1)},${yArrow2.toFixed(1)}" fill="${color}" />
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="${color}" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">${label}</text>
    `;
  }

  const axesSvg = `
    ${createArrowSvg(pCenter, pX, '#f43f5e', 'X')}
    ${createArrowSvg(pCenter, pY, '#10b981', 'Y')}
    ${createArrowSvg(pCenter, pZ, '#00f0ff', 'Z')}
    <circle cx="${pCenter.x.toFixed(1)}" cy="${pCenter.y.toFixed(1)}" r="2.5" fill="#ffffff" />
  `;

  const svgXml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    ${edgesSvg}
    ${axesSvg}
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgXml)}`;
}

/**
 * 基于宏观轨迹生成 20 点高频动力学受力与姿态拟真样本 (50ms 采样)
 */
export function generateAttitudeSamples(
  baseTimeStr: string,
  baseSpeed: number,
  baseHeading: number,
  baseRoll: number = 0,
  basePitch: number = 0
): AttitudeSample[] {
  const samples: AttitudeSample[] = [];
  const baseDate = new Date((baseTimeStr || '').replace(/-/g, '/'));
  const validDate = isNaN(baseDate.getTime()) ? new Date() : baseDate;

  // 动力学平滑扰动参数
  const speedRatio = Math.min(1.0, baseSpeed / 60);

  for (let i = 0; i < 20; i++) {
    const offsetMs = i * 50;
    const curDate = new Date(validDate.getTime() + offsetMs);
    const hh = String(curDate.getHours()).padStart(2, '0');
    const mm = String(curDate.getMinutes()).padStart(2, '0');
    const ss = String(curDate.getSeconds()).padStart(2, '0');
    const mss = String(offsetMs).padStart(3, '0');
    const timeStr = `${hh}:${mm}:${ss}.${mss}`;

    // 微观扰动波形 (高频路面受力动力学)
    const t = i / 20 * Math.PI * 2;
    const ax = Number(((Math.sin(t * 1.5) * 0.18 * speedRatio) + (baseRoll / 90 * 0.4)).toFixed(3));
    const ay = Number(((Math.cos(t * 2) * 0.12 * speedRatio) + (basePitch / 90 * 0.3)).toFixed(3));
    const az = Number((0.98 + (Math.sin(t * 3) * 0.08 * speedRatio)).toFixed(3));

    const roll = Number((baseRoll + Math.sin(t) * 2.5 * speedRatio).toFixed(1));
    const pitch = Number((basePitch + Math.cos(t * 1.2) * 1.8 * speedRatio).toFixed(1));
    const heading = Number(((baseHeading + (i * 0.15)) % 360).toFixed(1));

    samples.push({
      offsetMs,
      timeStr,
      ax,
      ay,
      az,
      roll,
      pitch,
      heading
    });
  }

  return samples;
}

/**
 * 生成三轴加速度连续受力波形的 SVG Data-URI
 * 支持 Web、Android、微信小程序多端纯净同构
 */
export function buildWaveformSvgDataUri(
  samples: AttitudeSample[],
  activeIndex: number = 0,
  width: number = 320,
  height: number = 80
): string {
  if (!samples || samples.length === 0) {
    const emptySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(emptySvg)}`;
  }

  const paddingX = 12;
  const paddingY = 10;
  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;
  const n = samples.length;

  // 三轴受力范围映射: -1.5g ~ +1.5g
  function mapY(gVal: number): number {
    const clamped = Math.max(-1.5, Math.min(1.5, gVal));
    const normalized = (clamped - (-1.5)) / 3.0; // 0 ~ 1
    return paddingY + innerH * (1 - normalized);
  }

  function mapX(i: number): number {
    return paddingX + (n > 1 ? (i / (n - 1)) * innerW : 0);
  }

  let ptsX = '';
  let ptsY = '';
  let ptsZ = '';

  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const px = mapX(i).toFixed(1);
    ptsX += `${px},${mapY(s.ax).toFixed(1)} `;
    ptsY += `${px},${mapY(s.ay).toFixed(1)} `;
    ptsZ += `${px},${mapY(s.az).toFixed(1)} `;
  }

  // 高亮微调游标
  const curIdx = Math.max(0, Math.min(n - 1, activeIndex));
  const curX = mapX(curIdx).toFixed(1);
  const curY_Z = mapY(samples[curIdx].az).toFixed(1);

  const svgXml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <!-- 背景水平参考中线 (0g 零受力线) -->
    <line x1="${paddingX}" y1="${(paddingY + innerH / 2).toFixed(1)}" x2="${(width - paddingX)}" y2="${(paddingY + innerH / 2).toFixed(1)}" stroke="#1e293b" stroke-width="1" stroke-dasharray="3,3" />

    <!-- X 轴受力连续折线 (红色) -->
    <polyline points="${ptsX.trim()}" fill="none" stroke="#f43f5e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Y 轴受力连续折线 (绿色) -->
    <polyline points="${ptsY.trim()}" fill="none" stroke="#10b981" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Z 轴受力连续折线 (青色) -->
    <polyline points="${ptsZ.trim()}" fill="none" stroke="#00f0ff" stroke-width="2.0" stroke-linecap="round" stroke-linejoin="round" />

    <!-- 当前微调采样点垂直高亮指示游标线 -->
    <line x1="${curX}" y1="0" x2="${curX}" y2="${height}" stroke="#00f0ff" stroke-width="1.5" stroke-opacity="0.9" />

    <!-- 游标焦点发光圆点 -->
    <circle cx="${curX}" cy="${curY_Z}" r="3.5" fill="#ffffff" stroke="#00f0ff" stroke-width="2" />
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgXml)}`;
}
