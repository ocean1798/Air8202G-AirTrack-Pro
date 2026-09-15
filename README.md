# AirTrack Pro · 合宙 Air8202G 全景时空多端交互系统

<p align="center">
  <b>基于统一 Web 架构的多端交互系统（Web 桌面控制台 · 移动端弹性抽屉 · Android APK · 微信小程序）</b>
</p>

<p align="center">
  <a href="https://ocean1798.github.io/Air8202G-AirTrack-Pro/">🌐 网页端在线体验 (GitHub Pages)</a>
</p>

---

## 📖 项目简介

**AirTrack Pro** 专为上海合宙（LuatOS）**Air8202G** 蜂窝定位模组与 4G Cat.1 物联网资产追踪场景打造。系统采用现代化全栈 Web 与跨端技术栈，彻底颠覆传统硬件原厂 Demo 生硬简陋的交互形式，提供消费级极致体验的数字孪生时空看板。

### 🌟 核心亮点：“8 大基石 + N 项创新”

1. **双模时空时间轴（跟随最新 vs 区间回放）**：
   - **跟随最新模式**：聚焦最近动态车况，实时高频刷新，隐藏冗余宏观控制器；
   - **区间回放模式**：毫秒级多倍速播放，支持任意时间戳拖拽跳跃，速度能量连续渐变彩虹波形映射。
2. **移动端与桌面端物理级隔离自适应**：
   - **移动端（< 768px）**：头条/抖音式横向滑动设备频道栏、三档弹性底部抽屉（Peek 74px / Half 48vh / Full 86vh）、悬浮回正 FAB（零物理碰撞）；
   - **桌面端（≥ 768px）**：双侧可折叠全景控制台，左侧 5 台在网真机状态矩阵，右侧纵向平铺感知仪表盘。
3. **P0 级电池健康与续航预估模型**：
   - 告别生硬的 `4080mV` 硬件电压代码，智能转换为放电百分比并根据 10s 高频定位与 5min 深度休眠测算剩余使用天数。
4. **P1 级一键智能布防与电子围栏**：
   - 结合 1000m 半径圆形电子围栏与震动唤醒阈值，打造消费级智能防盗暗锁。
5. **25Hz G-Sensor 动力学 3D 姿态拟真**：
   - 基于 Tag 1293 传感器原始包仿真地平仪与空间罗盘，呈现俯仰 (Pitch)、横滚 (Roll)、航向 (Yaw) 实时拟真。
6. **合宙官方全网 5 台真机 100% 对齐**：
   - 内置官方在网测试主账号 `18101796680` / `Hz8202`，实时对齐上海、开封、深圳、北京、广州 5 地在网硬件节点。

---

## 🛠️ 技术栈选型

- **框架内核**：Uni-app (Vue 3 + Vite 5 + TypeScript)
- **状态管理**：Pinia 2.x
- **样式引擎**：UnoCSS (Preset-Uno + Preset-Attributify)
- **地图底座**：腾讯地图 JavaScript API GL 版 (WebGL 硬件加速渲染)
- **时序波形**：HTML5 Canvas 高保真渐变渲染 + PointerCapture 工业级拖拽引擎
- **自动化交付**：GitHub Actions CI/CD 原生持续部署至 GitHub Pages

---

## 🚀 本地开发与构建

### 1. 安装依赖
```bash
pnpm install
```

### 2. 启动本地 H5 开发服务器
```bash
pnpm dev:h5
```

### 3. 生产环境构建 (H5 / Web)
```bash
pnpm build:h5
```
构建产物输出至 `dist/build/h5/`。

### 4. 微信小程序与 Android 构建
```bash
# 微信小程序构建
pnpm build:mp-weixin

# Android App 构建
pnpm build:app
```

---

## 🔑 官方体验测试账号

- **管理后台网关**：`https://api-iot.luatos.com/iot/open_api`
- **体验主账号**：`18101796680`
- **体验密码**：`Hz8202`

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 分发。
