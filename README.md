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

## 本地地图回归

当前地图路径、页面状态与外部边界的唯一设计入口是 [系统架构](../../specs/system-architecture-design.md)；本轮范围见 [0022 任务](../../changes/0022-修复-地图回归与测试接线/tasks.md)。这些链接供完整工作区使用，单独克隆工程时需同时取得所属 Project 文档。

需要 Python 3.12、`tests/requirements.txt` 指定的 Playwright 和对应 Chromium，以及已有 Node/pnpm 工程依赖。缺依赖时命令会失败，不会跳过必测项；环境安装应按所在环境的授权执行：

```bash
python -m pip install -r tests/requirements.txt
python -m playwright install chromium
```

在一个终端启动专用回环服务（端口被占用即失败，不连接已有未知服务），另一个终端执行测试：

```bash
pnpm dev:h5 --host 127.0.0.1 --port 5187 --strictPort
# Bash
AIRTRACK_TEST_URL=http://127.0.0.1:5187/ pnpm test
```

PowerShell 对应设置为 `$env:AIRTRACK_TEST_URL='http://127.0.0.1:5187/'`，然后执行 `pnpm test`。`pnpm test:map` 是同一入口。需要保留截图时，将 `AIRTRACK_EVIDENCE_DIR` 显式设为本次 Change 的 `evidence` 子目录；默认不在工程根写截图。`UNI_OUTPUT_DIR` 可指定本次专属临时目录，避免覆盖既有构建产物。使用完毕只关闭自己启动的服务。

四项必测覆盖静止驻留的可见状态与真实 Canvas 像素、静止→移动→静止切换、重复绘制不叠加，以及 393×852、360×800 视口的控件可见性和几何避让。测试使用独立临时浏览器上下文，正常关闭空账户弹窗，经实际刷新/设备选择控件消费合成 API 方法结果；不连接真实账户、合宙接口、守护站或腾讯计费服务。腾讯 SDK 由小型 SVG/DOM 替身代替，其他外部 CDN 也被隔离；应用自带 UnoCSS/CSS 和 Canvas 不替换。因此结果只支持本地 UI、布局及 SDK 调用层，不证明腾讯真实控件/WebGL、地图取数、安卓/微信或硬件端到端行为。替身缺少必测控件也会失败，不能用跳过冒充几何通过。

2026-09-20 Lead 核对[腾讯原生 GLJS 的 MapOptions/Map 手册](https://lbs.qq.com/webApi/javascriptGL/glDoc/docIndexMap#2)：控制可见性的字段是 `showControl`（默认 true），Map 提供 `getControl` / `removeControl`，未列 `control.zoom/rotation`。替身据此前者决定默认控件及移除，控件采用供应用 CSS 核对的合成流式布局，不能外推真实腾讯控件尺寸和位置。首轮误按 `control.*` 隐藏控件所产生的四个红灯属于替身语义错误，旧日志保留，不能作为生产缺陷依据。真实 SDK 本期未联网运行。

0022 当前候选仍有红灯，不能作为通过的构建门禁交付：两视口的缩放替身与顶部栏重叠。运行时 CSSOM 证实，页面的避让规则带 Vue `data-v-*` 局部作用域条件，外部动态控件没有该属性，规则不命中；缩放替身的 40×80 尺寸来自工程 `proto-tailwind.css`，不是为了通过而改写的 SDK 尺寸。此结果支持应用样式与动态节点的衔接缺口，尚不证明真实腾讯控件的具体遮挡情况。保留正常失败及隔离反例，后续生产修复需另定范围；本期未修改 `src`。对应运行和诊断见 [0022 证据](../../changes/0022-修复-地图回归与测试接线/evidence/developer-verification.md)。

本地命令和 CI 使用同一 `unittest` 入口及必测清单；断言失败、异常、零发现、少必测项、全部或部分 skip 均返回非零。GitHub Pages 和 Android 构建 job 都依赖回归成功，未启动真实发布。用于核对失败出口的隔离命令如下，三种 runner 样本以及各业务反例都应返回非零：

```bash
pnpm run test --gate-probe empty
pnpm run test --gate-probe all-skipped
pnpm run test --gate-probe partial-skipped
# 同样需要 AIRTRACK_TEST_URL，仅改变本次临时浏览器中的驻留图元
pnpm run test --fault missing-dwell
pnpm run test --fault thin-band
pnpm run test --fault missing-watermark
pnpm run test --fault offscreen-control
```

带参数必须使用 `pnpm run test ...`，避免 pnpm 9 将参数按自己的选项解析。驻留检查同时核实际 Canvas 绘出的状态文本、中心文字像素，以及能量带相对轨道高度；`thin-band` 把它替换为 2px 底线，`missing-watermark` 只擦去文字区域，均须使正常断言失败。布局检查还核控件完整处于当前视口，`offscreen-control` 把定位按钮移出右边界，不能凭“仍存在且不重叠”通过。故障只改新浏览器上下文，关闭后消失。

业务反例必须对照同版本正常运行的对应断言，不能仅凭整体非零断定其有效。旧 Change 脚本保留为历史材料，不纳入本入口；无本次运行证据时，不继承旧“100% PASS”结论。

## 🔑 官方体验测试账号

- **管理后台网关**：`https://api-iot.luatos.com/iot/open_api`
- **体验主账号**：`18101796680`
- **体验密码**：`Hz8202`

---

## 📄 开源许可证

本项目基于 [MIT 许可证](LICENSE) 分发。
