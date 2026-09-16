<template>
  <div class="relative w-screen h-screen overflow-hidden bg-cyber-950 text-slate-100 font-sans antialiased select-none">
    
    <!-- ==================== 1. 全景腾讯 WebGL 地图底座 ==================== -->
    <div id="main-map" class="absolute inset-0 w-full h-full z-0 bg-cyber-950"></div>

    <!-- ==================== 2. 顶部轻量浮动 Bar (响应式双模严格隔离) ==================== -->
    <header class="absolute top-2 left-2 right-2 md:top-3 md:left-3 md:right-3 z-30 pointer-events-none">
      
      <!-- 2.1 移动端独占顶部 Bar (< md 严格呈现，>= md 彻底隐藏) -->
      <div class="md:hidden glass-panel w-full p-1.5 rounded-2xl flex items-center shadow-xl border border-white/10 pointer-events-auto backdrop-blur-2xl bg-cyber-900/90">
        
        <!-- 移动端专享：头条/抖音式多设备横向滑动频道栏（真实设备动态渲染） -->
        <div class="flex-1 overflow-x-auto no-scrollbar flex items-center space-x-1.5 pr-3 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]" id="mobile-device-channel-bar">

          <div v-for="d in deviceList" :key="d.imei"
               role="button"
               @click="selectDeviceTab(d.imei)"
               :id="'mob-tab-dev-' + d.imei"
               :class="mobileTabClass(d)">
            <span :class="activeDeviceId === d.imei ? 'w-2 h-2 rounded-full bg-cyber-emerald animate-pulse-cyan' : (d.online ? 'w-1.5 h-1.5 rounded-full bg-cyber-emerald' : 'w-1.5 h-1.5 rounded-full bg-slate-500')"></span>
            <span :class="activeDeviceId === d.imei ? 'text-xs font-bold text-white whitespace-nowrap' : 'text-xs font-medium whitespace-nowrap'">{{ d.shortName }}</span>
            <span :class="signalBadgeClass(d)">{{ signalBadgeText(d) }}</span>
          </div>

          <div v-if="!deviceList.length" class="shrink-0 px-3 py-1 text-xs text-slate-400">
            {{ deviceLoading ? '正在同步云端设备…' : '当前空间无设备' }}
          </div>

        </div>

        <!-- 移动端专享：分隔竖线 -->
        <div class="w-px h-5 bg-white/10 mx-1.5 shrink-0"></div>

        <!-- 移动端专享：纯用户头像 (不带电话号码) -->
        <div role="button" @click="toggleOfficialModal()" title="IoT工作空间与账号管理" class="shrink-0 relative group p-0.5 rounded-full border border-cyber-primary/50 shadow-glow-cyan hover:border-cyber-primary active:scale-95 transition-all bg-cyber-950/80">
          <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600/40 via-cyber-800 to-blue-600/50 flex items-center justify-center overflow-hidden border border-white/20">
            <i data-lucide="user" class="w-3.5 h-3.5 text-cyber-primary"></i>
          </div>
          <span class="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-cyber-emerald border-2 border-cyber-950"></span>
        </div>

      </div>

      <!-- 2.2 桌面 Web 端独占顶部 Bar (>= md 严格完整呈现) -->
      <div class="hidden md:flex items-center justify-between w-full pointer-events-none">
        
        <!-- 桌面端左侧：品牌与在网状态完整标牌 -->
        <div class="glass-panel px-3.5 py-2 rounded-2xl flex items-center space-x-3 pointer-events-auto border border-cyber-700/60 shadow-lg">
          <div class="w-7 h-7 rounded-xl bg-gradient-to-tr from-cyan-500/30 to-blue-600/40 border border-cyber-primary/50 flex items-center justify-center shadow-glow-cyan">
            <i data-lucide="satellite" class="w-4 h-4 text-cyber-primary"></i>
          </div>
          <div>
            <div class="flex items-center space-x-1.5">
              <span class="font-bold text-xs tracking-wider text-white">AirTrack Pro</span>
              <span class="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyber-primary/20 text-cyber-primary border border-cyber-primary/40 font-bold">Web 控制台</span>
            </div>
            <div class="text-[10px] text-slate-400 font-mono flex items-center space-x-2">
              <span id="desktop-top-device-name" class="text-slate-200">{{ activeDeviceId && deviceList.length ? (deviceList[0].name + ' 等 ' + deviceList.length + ' 台') : '等待云端同步' }}</span>
              <span class="text-cyber-emerald">● 4G蜂窝畅通</span>
            </div>
          </div>
        </div>

        <!-- 桌面端右侧控制簇：完整工作空间号码 + 顶部定位回正 + 左右侧边栏控制键 -->
        <div class="flex items-center space-x-2 pointer-events-auto">
          
          <!-- 桌面端：工作空间多账号切换胶囊 -->
          <div role="button" @click="toggleOfficialModal()" title="切换IoT工作空间" class="glass-panel px-3 py-1.5 rounded-2xl text-xs font-mono text-cyber-primary border border-cyber-primary/40 hover:bg-cyber-primary/15 transition flex items-center space-x-1.5 shadow-glow-cyan">
            <span :class="activeAccountHasAuth ? 'w-1.5 h-1.5 rounded-full bg-cyber-primary animate-pulse-cyan' : 'w-1.5 h-1.5 rounded-full bg-amber-400'"></span>
            <span class="text-slate-400">{{ activeAccountLabel }}:</span>
            <span class="font-bold text-white tracking-wider">{{ activeAccountPhone }}</span>
            <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400"></i>
          </div>

          <!-- 桌面端顶部回中键 -->
          <div role="button" @click="recenterVehicle()" title="镜头平滑聚焦回当前车辆" class="glass-panel p-2.5 rounded-2xl text-slate-300 hover:text-cyber-primary hover:border-cyber-primary transition shadow-lg active:scale-90">
            <i data-lucide="crosshair" class="w-4 h-4"></i>
          </div>

          <!-- 桌面端左侧设备坞折叠键 -->
          <div role="button" @click="toggleDeviceDock()" id="btn-dock" title="展开/收起左侧在网设备坞" class="glass-panel p-2.5 rounded-2xl text-slate-300 hover:text-cyber-primary hover:border-cyber-primary transition shadow-lg">
            <i data-lucide="layers" class="w-4 h-4"></i>
          </div>

          <!-- 桌面端右侧感知面板折叠键 -->
          <div role="button" @click="toggleInspectorDrawer()" id="btn-inspector" title="展开/收起右侧感知面板" class="glass-panel p-2.5 rounded-2xl text-slate-300 hover:text-cyber-primary hover:border-cyber-primary transition shadow-lg">
            <i data-lucide="panel-right" class="w-4 h-4"></i>
          </div>

        </div>

      </div>
    </header>

    <!-- ==================== 3. 桌面端独占：左侧在网设备泊位坞 (hidden md:flex) ==================== -->
    <aside id="device-dock" class="hidden md:flex drawer-transition fixed top-16 left-3 bottom-28 w-72 md:w-80 glass-panel rounded-2xl border border-cyber-700/60 z-20 flex-col pointer-events-auto shadow-2xl">
      <div class="p-3 border-b border-cyber-700/50 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <i data-lucide="navigation-2" class="w-3.5 h-3.5 text-cyber-primary"></i>
          <span class="text-xs font-bold text-slate-200">在网感知节点</span>
        </div>
        <span class="text-[10px] font-mono text-slate-400 bg-cyber-900 px-2 py-0.5 rounded border border-cyber-700">共 {{ deviceList.length }} 台设备</span>
      </div>

      <div class="flex-1 overflow-y-auto p-2 space-y-2" id="desktop-device-card-list">

        <div v-for="d in deviceList" :key="d.imei"
             @click="selectDeviceTab(d.imei)"
             :id="'card-desk-' + d.imei"
             :class="desktopCardClass(d)">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-1.5">
              <span :class="activeDeviceId === d.imei ? 'w-2 h-2 rounded-full bg-cyber-emerald animate-pulse-cyan' : (d.online ? 'w-2 h-2 rounded-full bg-cyber-emerald' : 'w-2 h-2 rounded-full bg-slate-500')"></span>
              <span :class="activeDeviceId === d.imei ? 'text-xs font-bold text-white' : 'text-xs font-bold text-slate-300'">{{ d.name }}</span>
            </div>
            <span :class="d.online ? 'text-[9px] font-mono text-cyber-emerald bg-cyber-emerald/15 px-1.5 py-0.5 rounded border border-cyber-emerald/30' : 'text-[9px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded'">
              {{ d.online ? '在线' : '无定位' }}
            </span>
          </div>
          <div :class="activeDeviceId === d.imei ? 'text-[10px] font-mono text-slate-400 mt-1' : 'text-[10px] font-mono text-slate-500 mt-1'">IMEI: {{ d.imei }}</div>
          <div :class="activeDeviceId === d.imei ? 'text-[10px] text-slate-300 mt-1 truncate' : 'text-[10px] text-slate-400 mt-1 truncate'" :title="d.address">{{ d.address }}</div>
          <div class="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span :class="activeDeviceId === d.imei ? 'text-cyber-emerald font-bold' : ''">{{ d.lastActiveTime }}</span>
            <span class="text-slate-400">CSQ {{ d.csq }}</span>
          </div>
        </div>

        <div v-if="!deviceList.length" class="px-2 py-4 text-[11px] text-slate-400 leading-relaxed">
          <template v-if="deviceLoading">正在从合宙云端同步该空间设备…</template>
          <template v-else-if="!activeAccountHasAuth">
            当前工作空间未授权登录。<br />
            <span class="text-cyber-primary cursor-pointer underline" @click="redirectToOfficialOAuth()">点击前往合宙官方 OAuth 授权</span>
          </template>
          <template v-else-if="authError" class="text-amber-400">
            <span class="text-amber-400">{{ authError }}</span>
          </template>
          <template v-else>当前空间名下暂无已绑定设备。</template>
        </div>

      </div>
    </aside>

    <!-- ==================== 4. 移动端独占：右下角悬浮回正 FAB (< md) ==================== -->
    <div class="md:hidden fixed right-3 z-30 transition-all duration-300 bottom-[205px] pointer-events-auto">
      <div role="button" @click="recenterVehicle()" title="镜头平滑聚焦回当前车辆位置" class="w-10 h-10 rounded-2xl glass-panel border border-cyber-primary/60 text-cyber-primary flex items-center justify-center shadow-fab-shadow hover:bg-cyber-primary/20 hover:scale-105 active:scale-90 transition-all backdrop-blur-xl group bg-cyber-900/90">
        <i data-lucide="crosshair" class="w-5 h-5 text-cyber-primary group-hover:rotate-45 transition-transform"></i>
      </div>
    </div>

    <!-- ==================== 5. 核心：【双端双模感知面板】 ==================== -->
    <aside id="inspector-drawer" class="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-cyber-700/80 glass-panel shadow-sheet-shadow flex flex-col drawer-transition sheet-peek md:fixed md:inset-x-auto md:top-16 md:right-3 md:bottom-28 md:w-80 md:lg:w-96 md:rounded-2xl md:border md:border-cyber-700/60 md:z-20 md:shadow-2xl md:h-auto md:max-h-none">
      
      <!-- 移动端把手 -->
      <div id="sheet-drag-handle" class="w-full flex flex-col items-center pt-1.5 pb-0.5 cursor-pointer md:hidden active:opacity-75 touch-none">
        <div class="w-10 h-1 bg-slate-400/50 rounded-full hover:bg-cyber-primary transition-colors"></div>
      </div>

      <!-- 顶部固定车况头 -->
      <div id="sheet-header-bar" class="px-3.5 py-2 border-b border-cyber-700/60 bg-cyber-900/95 flex items-center justify-between shrink-0 cursor-pointer md:cursor-default select-none">
        <div class="flex-1">
          <div class="flex items-center space-x-2">
            <span class="text-xs font-bold text-white tracking-wide truncate max-w-[140px] sm:max-w-none" id="drawer-vehicle-name">8202G·开封旗舰机</span>
            <span class="text-[9px] font-mono text-cyber-primary bg-cyber-primary/10 border border-cyber-primary/30 px-1.5 py-0.2 rounded" id="drawer-gnss-badge">GNSS 3D</span>
          </div>
          <div class="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center space-x-1.5 leading-tight">
            <span id="drawer-coord-text" class="truncate max-w-[150px] sm:max-w-none">34.7944°N, 114.3350°E</span>
            <span class="font-bold px-1.5 py-0.2 rounded text-[10px] text-cyber-primary bg-cyber-primary/10 border border-cyber-primary/30 transition-colors" id="drawer-speed-badge">0 km/h</span>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <div role="button" @click.stop="toggleQuickArm()" id="btn-quick-arm" class="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-cyber-emerald text-white hover:bg-emerald-600 transition flex items-center space-x-1 shadow-glow-emerald">
            <i data-lucide="shield-check" class="w-3 h-3"></i>
            <span id="quick-arm-text">已设防</span>
          </div>

          <div role="button" id="btn-sheet-chevron" class="md:hidden p-1 text-slate-400 hover:text-white transition-transform">
            <i data-lucide="chevron-up" class="w-4 h-4" id="icon-sheet-chevron"></i>
          </div>
        </div>
      </div>

      <!-- 纵向平铺流式内容体 -->
      <div class="flex-1 overflow-y-auto p-3 space-y-3.5 scroll-smooth overscroll-contain">
        
        <!-- 模块 1 · 3D姿态与航向拟真 -->
        <section class="glass-panel p-3 rounded-xl border border-cyber-primary/30 flex flex-col items-center justify-center shadow-lg">
          <div class="w-full flex items-center justify-between text-[11px] mb-1">
            <span class="text-slate-200 font-bold flex items-center space-x-1.5">
              <i data-lucide="compass" class="w-3.5 h-3.5 text-cyber-primary"></i>
              <span>3D 姿态与航向拟真</span>
            </span>
            <span class="text-[9px] font-mono text-cyber-primary bg-cyber-primary/10 px-1.5 py-0.5 rounded border border-cyber-primary/30">25Hz IMU</span>
          </div>

          <div class="relative w-32 h-32 sm:w-36 sm:h-36 my-2 flex items-center justify-center">
            <div class="compass-ring w-32 h-32 sm:w-36 sm:h-36 flex items-center justify-center shadow-glow-cyan">
              <div id="horizon-disc" class="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border border-cyber-primary/30 flex flex-col items-center justify-center bg-gradient-to-b from-cyan-950/40 via-cyber-900 to-amber-950/40 transition-transform duration-100">
                <div class="w-full h-0.5 bg-cyber-primary shadow-glow-cyan"></div>
                <div class="text-[8px] font-mono text-cyber-primary/80 mt-0.5">HORIZON</div>
              </div>
              <div id="yaw-pointer" class="absolute w-1 h-24 sm:h-28 bg-gradient-to-t from-transparent via-rose-500 to-rose-400 rounded-full transition-transform duration-100"></div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 w-full text-center text-[10px] font-mono mt-1">
            <div class="bg-cyber-900 p-1.5 rounded-lg border border-cyber-700/50">
              <div class="text-slate-400">俯仰 (Pitch)</div>
              <div class="text-xs font-bold text-cyber-primary mt-0.5" id="val-pitch">+4.2°</div>
            </div>
            <div class="bg-cyber-900 p-1.5 rounded-lg border border-cyber-700/50">
              <div class="text-slate-400">横滚 (Roll)</div>
              <div class="text-xs font-bold text-cyber-emerald mt-0.5" id="val-roll">-1.5°</div>
            </div>
            <div class="bg-cyber-900 p-1.5 rounded-lg border border-cyber-700/50">
              <div class="text-slate-400">航向 (Yaw)</div>
              <div class="text-xs font-bold text-cyber-amber mt-0.5" id="val-yaw">68.0°</div>
            </div>
          </div>
        </section>

        <!-- 模块 2 · 三轴加速度动态波形 -->
        <section class="glass-panel p-3 rounded-xl border border-cyber-700/60 shadow-lg">
          <div class="flex items-center justify-between text-[11px] mb-1">
            <span class="text-slate-200 font-bold flex items-center space-x-1.5">
              <i data-lucide="activity" class="w-3.5 h-3.5 text-cyber-emerald"></i>
              <span>三轴加速度波形 (Tag 1293)</span>
            </span>
            <span class="text-[9px] font-mono text-cyan-400">Z: 982mg</span>
          </div>
          <div id="chart-accel" class="w-full h-32 sm:h-36"></div>
        </section>

        <!-- 模块 3 · 工业级 Tag 遥测黑匣子明细 -->
        <section class="glass-panel rounded-xl overflow-hidden border border-cyber-700/60 shadow-lg">
          <div class="p-2.5 bg-cyber-900/90 border-b border-cyber-700/50 flex items-center justify-between text-[11px]">
            <span class="text-slate-200 font-bold flex items-center space-x-1.5">
              <i data-lucide="cpu" class="w-3.5 h-3.5 text-cyber-primary"></i>
              <span>AirCloud 工业级 Tag 字典</span>
            </span>
            <span class="text-[9px] font-mono text-cyber-emerald">实时校验通过</span>
          </div>
          <div class="font-mono text-[11px] divide-y divide-cyber-700/40">
            <div class="p-2.5 flex items-center justify-between bg-cyber-900/40">
              <span class="text-cyber-primary font-bold">Tag 799 (电池供电)</span>
              <span class="text-cyber-emerald font-bold" id="tel-tag-batt">4080 mV (92%)</span>
            </div>
            <div class="p-2.5 flex items-center justify-between">
              <span class="text-cyber-primary font-bold">Tag 782 (蜂窝信号)</span>
              <span class="text-cyan-300 font-bold" id="tel-tag-csq">CSQ 31 (4G满格)</span>
            </div>
            <div class="p-2.5 flex items-center justify-between bg-cyber-900/40">
              <span class="text-cyber-primary font-bold">Tag 512 / 513 (经纬度)</span>
              <span class="text-slate-200" id="tel-tag-coords">31.2407°N, 121.4888°E</span>
            </div>
            <div class="p-2.5 flex items-center justify-between">
              <span class="text-cyber-primary font-bold">Tag 514 (行驶航速)</span>
              <span class="text-cyber-emerald font-bold" id="tel-tag-speed">18.2 km/h</span>
            </div>
            <div class="p-2.5 flex items-center justify-between bg-cyber-900/40">
              <span class="text-cyber-primary font-bold">Tag 1294 (差分轨迹包)</span>
              <span class="text-slate-300">10s 稠密差分同步</span>
            </div>
          </div>
        </section>

        <!-- 模块 4 · 智能电子围栏控制 -->
        <section class="glass-panel p-3 rounded-xl border border-cyber-700/60 space-y-2.5 shadow-lg">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-200 font-bold flex items-center space-x-1.5">
              <i data-lucide="shield-alert" class="w-3.5 h-3.5 text-cyber-amber"></i>
              <span>智能电子围栏防盗</span>
            </span>
            <span class="text-[9px] font-mono text-cyber-emerald bg-cyber-emerald/10 border border-cyber-emerald/30 px-1.5 py-0.5 rounded">围栏内 (安全)</span>
          </div>
          <p class="text-[10px] text-slate-400">已根据当前驻留锚点设定半径 1000 米安全圈，越界将立即触发飞书与短信告警。</p>
          <div class="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] font-mono">
            <span class="text-slate-400">震动防盗灵敏度:</span>
            <span class="text-cyber-primary font-bold">中级 (0.5g)</span>
          </div>
        </section>

        <!-- 模块 5 · 时空行程质检与数据画像 -->
        <section class="glass-panel p-3 rounded-xl border border-cyber-700/60 space-y-2 shadow-lg">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-200 font-bold flex items-center space-x-1.5">
              <i data-lucide="file-bar-chart" class="w-3.5 h-3.5 text-cyber-indigo"></i>
              <span>行程质量与画像评分</span>
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
            <div class="bg-cyber-900/80 p-2.5 rounded-lg border border-cyber-700/50">
              <div class="text-[10px] text-slate-400">怠速驻留累计</div>
              <div class="text-base font-black text-amber-400 mt-0.5">12.5 <span class="text-[10px] text-slate-400 font-normal">min</span></div>
            </div>
            <div class="bg-cyber-900/80 p-2.5 rounded-lg border border-cyber-700/50">
              <div class="text-[10px] text-slate-400">驾驶评分</div>
              <div class="text-base font-black text-cyber-emerald mt-0.5">96.8 <span class="text-[10px] text-slate-400 font-normal">分</span></div>
            </div>
          </div>
        </section>

        <!-- 底部防遮挡垫片 -->
        <div class="h-6"></div>
      </div>
    </aside>

    <!-- ==================== 6. 底部核心：【双端自适应时间轴控制台】 ==================== -->
    <div id="timeline-hud-wrapper" class="fixed bottom-[82px] left-2 right-2 z-20 flex flex-col items-center pointer-events-none transition-all duration-300 md:fixed md:bottom-3 md:left-3 md:right-3 md:max-w-5xl md:mx-auto md:z-20">
      
      <!-- 6.0 宏观历史跨度配置弹层 -->
      <div id="date-range-popover" class="w-full max-w-xl glass-panel p-3.5 sm:p-4 rounded-2xl border border-cyber-primary/40 shadow-popover-shadow mb-2 hidden pointer-events-auto transition-all backdrop-blur-2xl">
        <div class="flex items-center justify-between pb-2 border-b border-white/10">
          <div class="flex items-center space-x-1.5 text-xs font-bold text-white">
            <i data-lucide="calendar-range" class="w-3.5 h-3.5 text-cyber-primary"></i>
            <span>历史轨迹时空跨度 (AirCloud)</span>
          </div>
          <div role="button" @click="toggleDateRangePopover()" class="text-slate-400 hover:text-white p-1">
            <i data-lucide="x" class="w-4 h-4"></i>
          </div>
        </div>

        <div class="mt-2.5">
          <div class="text-[10px] font-mono text-slate-400 mb-1">快速跨度:</div>
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-1 text-[11px] font-mono">
            <div role="button" @click="selectMacroPreset('today')" id="macro-btn-today" class="macro-chip py-1 rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-slate-500 transition">今日</div>
            <div role="button" @click="selectMacroPreset('yesterday')" id="macro-btn-yesterday" class="macro-chip py-1 rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-slate-500 transition">昨日</div>
            <div role="button" @click="selectMacroPreset('3d')" id="macro-btn-3d" class="macro-chip py-1 rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-slate-500 transition">近3天</div>
            <div role="button" @click="selectMacroPreset('7d')" id="macro-btn-7d" class="macro-chip py-1 rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-slate-500 transition">近7天</div>
            <div role="button" @click="selectMacroPreset('30d')" id="macro-btn-30d" class="macro-chip py-1 rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-slate-500 transition">近1月</div>
            <div role="button" @click="selectMacroPreset('90d')" id="macro-btn-90d" class="macro-chip py-1 rounded-lg bg-cyber-primary/20 text-cyber-primary border border-cyber-primary/40 font-bold transition">近1季</div>
          </div>
        </div>

        <div class="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
          <div class="flex items-center space-x-1 text-[11px]">
            <input type="date" v-model="customDateStart" id="input-date-start" class="bg-cyber-950 border border-cyber-700/80 rounded px-1.5 py-0.5 text-slate-200 text-[10px] focus:border-cyber-primary focus:outline-none">
            <span class="text-slate-500">-</span>
            <input type="date" v-model="customDateEnd" id="input-date-end" class="bg-cyber-950 border border-cyber-700/80 rounded px-1.5 py-0.5 text-slate-200 text-[10px] focus:border-cyber-primary focus:outline-none">
          </div>
          <div role="button" @click="applyCustomDateRange()" class="px-3 py-1 rounded-xl bg-cyber-primary text-cyber-950 font-bold text-xs hover:bg-cyan-300 transition shadow-glow-cyan flex items-center space-x-1 cursor-pointer">
            <i data-lucide="search" class="w-3 h-3"></i>
            <span>加载</span>
          </div>
        </div>
      </div>

      <!-- 6.1 超薄一体化控制容器 (高度 74px) -->
      <div id="timeline-hud-capsule" class="w-full glass-panel px-3 py-2 rounded-2xl flex flex-col pointer-events-auto border border-white/10 shadow-2xl space-y-1.5 bg-gradient-to-b from-cyber-900/95 via-cyber-900/90 to-cyber-950/95">
        
        <!-- 纯净速度山脉轨道区 -->
        <div class="relative w-full">
          
          <div id="timeline-track-container" class="relative w-full h-9 sm:h-10 bg-cyber-950 rounded-xl border border-white/10 overflow-visible cursor-crosshair flex items-center shadow-inner touch-none">
            
            <canvas id="speed-wave-canvas" class="absolute inset-0 w-full h-full rounded-xl pointer-events-none"></canvas>

            <div class="absolute inset-0 timeline-ticks pointer-events-none rounded-xl opacity-20"></div>
            <div class="absolute inset-0 timeline-ticks-major pointer-events-none rounded-xl opacity-30"></div>

            <div id="mask-left" class="absolute top-0 bottom-0 left-0 bg-cyber-950/80 backdrop-blur-[1px] rounded-l-xl pointer-events-none z-10 hidden" style="width: 15%;"></div>
            <div id="mask-right" class="absolute top-0 bottom-0 right-0 bg-cyber-950/80 backdrop-blur-[1px] rounded-r-xl pointer-events-none z-10 hidden" style="width: 25%;"></div>

            <div id="range-capsule" class="absolute top-0 bottom-0 z-10 hidden" style="left: 15%; width: 60%;">
              <div id="range-body" class="w-full h-full border-t-2 border-b-2 border-cyber-primary shadow-[0_0_16px_rgba(0,240,255,0.3)] flex items-center justify-center cursor-grab active:cursor-grabbing hover:bg-cyan-400/[0.04] transition-colors touch-none">
              </div>

              <div id="handle-left-hitbox" class="handle-hit-zone handle-hit-zone-left">
                <div class="w-2 h-6 sm:h-7 bg-gradient-to-r from-cyan-400 to-cyan-300 rounded-md flex items-center justify-center shadow-handle-glow border border-white/80 pointer-events-none">
                  <div class="w-0.5 h-3 rounded-full bg-cyber-950"></div>
                </div>
                <div id="drag-bubble-left" class="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-cyber-950/95 border border-cyan-400 rounded text-[9px] font-mono font-bold text-cyan-300 shadow-xl pointer-events-none whitespace-nowrap hidden z-40 backdrop-blur-md">
                  07-16 18:27
                </div>
              </div>

              <div id="handle-right-hitbox" class="handle-hit-zone handle-hit-zone-right">
                <div class="w-2 h-6 sm:h-7 bg-gradient-to-r from-cyan-300 to-cyan-400 rounded-md flex items-center justify-center shadow-handle-glow border border-white/80 pointer-events-none">
                  <div class="w-0.5 h-3 rounded-full bg-cyber-950"></div>
                </div>
                <div id="drag-bubble-right" class="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-cyber-950/95 border border-cyan-400 rounded text-[9px] font-mono font-bold text-cyan-300 shadow-xl pointer-events-none whitespace-nowrap hidden z-40 backdrop-blur-md">
                  07-27 17:58
                </div>
              </div>
            </div>

            <div id="playhead-needle" class="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none playhead-needle" style="left: 100%;">
              <div class="w-3.5 h-3.5 bg-white rounded-full absolute -top-1.5 -left-1.5 shadow-glow-cyan flex items-center justify-center border-2 border-cyber-950">
                <div class="w-1.5 h-1.5 rounded-full bg-cyber-primary transition-colors" id="playhead-inner-dot"></div>
              </div>
            </div>

            <div id="hover-needle" class="absolute top-0 bottom-0 w-[2px] hover-needle-dashed z-20 pointer-events-none hidden" style="left: 50%;">
              <div class="w-3 h-3 bg-cyber-primary rounded-full absolute -top-1.5 -left-[5px] shadow-[0_0_12px_#00f0ff] flex items-center justify-center">
                <div class="w-1 h-1 bg-white rounded-full"></div>
              </div>
              <div id="hover-bubble" class="absolute -top-8 -translate-x-1/2 px-2 py-0.5 bg-cyber-900/95 border border-cyan-400 rounded-lg text-[9px] sm:text-[10px] font-mono font-bold text-white shadow-xl pointer-events-none whitespace-nowrap backdrop-blur-md flex items-center space-x-1 z-40">
                <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                <span id="hover-bubble-time" class="text-cyan-300">12:07:00</span>
                <span class="text-slate-500">|</span>
                <span id="hover-bubble-speed" class="text-emerald-400">58.3 km/h</span>
              </div>
            </div>

          </div>

          <div class="flex items-center justify-between text-[8px] sm:text-[9px] font-mono text-slate-400 mt-1 px-1">
            <span id="scale-tick-start">08:00</span>
            <span id="scale-tick-1">09:30</span>
            <span id="scale-tick-2" class="hidden sm:inline">11:00</span>
            <span id="scale-tick-3">12:30</span>
            <span id="scale-tick-end" class="text-cyber-primary font-bold flex items-center space-x-1">
              <span>14:00 (最新)</span>
              <span class="w-1 h-1 rounded-full bg-cyber-primary animate-pulse-cyan"></span>
            </span>
          </div>

        </div>

        <!-- 单行一体化流线工具条 -->
        <div class="flex items-center justify-between flex-wrap gap-1.5 pt-1 border-t border-white/5 text-xs font-mono">
          
          <!-- 模式切换器 -->
          <div class="flex items-center bg-cyber-950/90 rounded-xl border border-white/10 p-0.5 shadow-inner">
            <div role="button" @click="switchMasterMode('live')" id="btn-mode-live" class="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold text-cyber-primary bg-cyber-primary/15 border border-cyber-primary/30 transition-all flex items-center space-x-1 shadow-glow-cyan">
              <span class="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse-cyan"></span>
              <span>跟随最新</span>
            </div>
            <div role="button" @click="switchMasterMode('range')" id="btn-mode-range" class="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-medium text-slate-400 hover:text-white transition-all flex items-center space-x-1">
              <i data-lucide="sliders" class="w-3 h-3"></i>
              <span>区间回放</span>
            </div>
            
            <div id="macro-date-divider" class="h-3.5 w-px bg-white/10 mx-1 hidden"></div>
            
            <div role="button" @click="toggleDateRangePopover()" id="btn-date-trigger" class="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-[11px] text-slate-200 hover:text-cyber-primary transition flex items-center space-x-1 group hidden">
              <i data-lucide="calendar" class="w-3 h-3 text-cyber-primary"></i>
              <span id="current-range-label" class="font-bold truncate max-w-[70px] sm:max-w-none">近90天</span>
              <i data-lucide="chevron-down" class="w-2.5 h-2.5 text-slate-400"></i>
            </div>
          </div>

          <!-- 播放控制簇 -->
          <div id="unified-play-cluster" class="flex items-center gap-1.5 hidden">
            <div class="flex items-center bg-cyber-950/90 p-0.5 rounded-xl border border-white/10 gap-1">
              <div role="button" @click="toggleRangePlay()" id="btn-range-play" class="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 transition flex items-center gap-1 shadow-glow-emerald">
                <i data-lucide="play" class="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" id="icon-range-play"></i>
                <span id="txt-range-play">播放</span>
              </div>
              <div role="button" @click="setPlaySpeed(1, $event)" class="speed-btn px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] bg-cyber-primary/20 text-cyber-primary font-bold">1x</div>
              <div role="button" @click="setPlaySpeed(5, $event)" class="speed-btn px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] text-slate-400 hover:text-white">5x</div>
            </div>

            <div role="button" @click="applyTimePreset('sprint')" class="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-cyber-rose font-bold text-[10px] sm:text-[11px] bg-rose-500/15 border border-rose-500/40 hover:bg-rose-500/25 shadow-glow-rose transition flex items-center gap-1">
              <span>🏎️ 疾驰</span>
            </div>
          </div>

          <!-- 状态呈现区 -->
          <div class="flex items-center space-x-1.5 text-[10px] sm:text-[11px]">
            
            <div id="live-status-bar" class="flex items-center space-x-1 sm:space-x-2">
              <div class="flex items-center space-x-1">
                <span class="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse-cyan"></span>
                <span class="text-cyber-emerald font-bold hidden sm:inline">实时锁定</span>
              </div>
              <div class="flex items-center space-x-1">
                <span id="live-latest-time" class="text-white font-bold">14:00:00</span>
              </div>
              <span class="text-slate-500">·</span>
              <div class="flex items-center space-x-1">
                <span id="live-latest-speed" class="text-cyber-primary font-bold">18.2 km/h</span>
              </div>
            </div>

            <div id="range-status-bar" class="flex items-center space-x-1 sm:space-x-2 hidden">
              <div class="flex items-center space-x-1">
                <span id="current-point-time" class="text-white font-bold">07-27 17:58</span>
                <span id="current-speed-tag" class="px-1 py-0.2 rounded text-[9px] font-bold border transition-all">
                  31.5 km/h
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>

    <!-- ==================== 7. IoT 工作空间与多账号管理抽屉 ==================== -->
    <div id="official-modal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 hidden" @click.self="toggleOfficialModal()">
      <div class="glass-panel max-w-lg w-full p-4 sm:p-5 rounded-2xl border border-cyber-primary/40 shadow-glow-cyan relative max-h-[90vh] overflow-y-auto">
        <div role="button" @click="toggleOfficialModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white p-1">
          <i data-lucide="x" class="w-4 h-4"></i>
        </div>

        <div class="flex items-center space-x-3 mb-4 pb-3 border-b border-white/10">
          <div class="w-10 h-10 rounded-xl bg-cyber-primary/20 border border-cyber-primary text-cyber-primary flex items-center justify-center shadow-glow-cyan shrink-0">
            <i data-lucide="server" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-sm font-bold text-white tracking-wide">IoT 资产空间与账号管理</h3>
            <p class="text-[11px] text-slate-400">支持自主接入合宙 IoT 账号，数据全链路本地缓存</p>
          </div>
        </div>

        <!-- 1. 当前激活工作空间卡片 -->
        <div class="p-3.5 rounded-xl border border-cyber-primary/60 bg-gradient-to-r from-cyber-primary/10 via-cyber-900/60 to-cyber-950/80 mb-4 shadow-inner">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="text-xs font-mono text-slate-400">当前激活空间:</span>
              <span class="text-xs font-bold text-white tracking-wide font-mono">{{ activeAccountPhone }}</span>
            </div>
            <span :class="activeAccountHasAuth ? 'text-[9px] font-mono text-cyber-emerald bg-cyber-emerald/15 px-2 py-0.5 rounded border border-cyber-emerald/30 font-bold' : 'text-[9px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30'">
              {{ activeAccountHasAuth ? '● 已授权连接' : '● 会话已断开' }}
            </span>
          </div>
          <div class="mt-2 text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <span>项目 Key: {{ activeProjectKeyShort }}</span>
            <span>已载入: {{ deviceList.length }} 台设备</span>
          </div>
          <div class="mt-3 flex items-center space-x-2">
            <div role="button" @click="redirectToOfficialOAuth()" class="flex-1 py-1.5 rounded-lg text-xs font-bold bg-cyber-primary text-cyber-950 hover:bg-cyan-300 transition text-center cursor-pointer flex items-center justify-center space-x-1 shadow-glow-cyan">
              <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
              <span>{{ activeAccountHasAuth ? '刷新授权' : '前往合宙安全授权' }}</span>
            </div>
            <div role="button" @click="syncOfficialData()" class="px-3 py-1.5 rounded-lg text-xs font-medium border border-cyber-primary/40 text-slate-200 hover:bg-cyber-primary/10 transition text-center cursor-pointer flex items-center space-x-1">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
              <span>同步最新</span>
            </div>
          </div>
          <div v-if="authError" class="mt-2 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1.5">
            {{ authError }}
          </div>
        </div>

        <!-- 2. 已连接空间列表 (支持切换) -->
        <div class="mb-3">
          <div class="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
            <span class="flex items-center space-x-1">
              <i data-lucide="list" class="w-3.5 h-3.5 text-cyber-primary"></i>
              <span>工作空间列表</span>
            </span>
            <span class="text-[10px] text-slate-400 font-mono">共 {{ accountStates.length }} 个</span>
          </div>

          <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            <div v-for="s in accountStates" :key="s.account.phone"
                 role="button"
                 @click="switchAccount(s.account.phone)"
                 :class="s.active ? 'p-2.5 rounded-xl border border-cyber-primary/70 bg-cyber-primary/15 cursor-pointer transition-all shadow-glow-cyan flex items-center justify-between' : 'p-2.5 rounded-xl border border-cyber-700/50 bg-cyber-900/50 cursor-pointer transition-all hover:border-slate-500 flex items-center justify-between'">
              <div class="flex items-center space-x-2.5">
                <span :class="s.active ? 'w-2 h-2 rounded-full bg-cyber-primary animate-pulse-cyan' : 'w-2 h-2 rounded-full bg-slate-600'"></span>
                <div>
                  <div class="flex items-center space-x-2">
                    <span :class="s.active ? 'text-xs font-bold text-white' : 'text-xs font-bold text-slate-300'">{{ s.account.label }}</span>
                    <span class="text-[11px] font-mono text-slate-400">{{ s.account.phone }}</span>
                    <span v-if="s.account.isDemo" class="text-[8px] font-mono text-cyan-400 bg-cyan-950/80 px-1 py-0.2 rounded border border-cyan-500/30">演示</span>
                  </div>
                  <div class="text-[10px] text-slate-400 mt-0.5">{{ s.account.role }}</div>
                </div>
              </div>

              <div class="flex items-center space-x-2">
                <span :class="s.hasAuth ? 'text-[9px] font-mono text-cyber-emerald bg-cyber-emerald/15 px-1.5 py-0.5 rounded border border-cyber-emerald/30' : 'text-[9px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded'">
                  {{ s.hasAuth ? '在线' : '离线' }}
                </span>
                <div v-if="!s.account.isDemo" role="button" @click="removeUserAccount(s.account.phone, $event)" title="移除该账号" class="text-slate-500 hover:text-rose-400 p-1">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. 添加新合宙账号 (表单) -->
        <div class="mt-3 pt-3 border-t border-white/10">
          <div role="button" @click="isAddingAccount = !isAddingAccount" class="text-xs font-bold text-cyber-primary flex items-center justify-between py-1 cursor-pointer">
            <span class="flex items-center space-x-1.5">
              <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
              <span>添加新合宙账号 (用户自主接入)</span>
            </span>
            <i :data-lucide="isAddingAccount ? 'chevron-up' : 'chevron-down'" class="w-3.5 h-3.5 text-slate-400"></i>
          </div>

          <div v-if="isAddingAccount" class="mt-2.5 p-3 rounded-xl bg-cyber-950/80 border border-cyber-700/60 space-y-2.5">
            <div>
              <label class="text-[10px] font-mono text-slate-400 block mb-1">合宙 IoT 注册手机号码:</label>
              <div class="flex items-center space-x-2">
                <input v-model="newAccountInputPhone" type="tel" placeholder="请输入您的合宙手机号" class="flex-1 bg-cyber-900 border border-cyber-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyber-primary focus:outline-none font-mono">
                <div role="button" @click="startOAuthForPhone()" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyber-primary text-cyber-950 hover:bg-cyan-300 transition shrink-0 cursor-pointer shadow-glow-cyan">
                  官方安全授权
                </div>
              </div>
              <p class="text-[9px] text-slate-400 mt-1">点击将前往合宙官方页面完成密码与验证码校验，成功后自动回跳接入</p>
            </div>

            <!-- 开发者凭据直接录入 -->
            <div class="pt-2 border-t border-white/5">
              <div role="button" @click="showManualCreds = !showManualCreds" class="text-[10px] font-mono text-slate-400 hover:text-slate-200 flex items-center space-x-1 cursor-pointer">
                <span>{{ showManualCreds ? '收起开发者直接导入' : '开发者通道: 直接输入 Token / Salt / Sid 凭据' }}</span>
                <i :data-lucide="showManualCreds ? 'chevron-up' : 'chevron-down'" class="w-3 h-3"></i>
              </div>

              <div v-if="showManualCreds" class="mt-2 space-y-1.5 text-[11px] font-mono">
                <input v-model="manualToken" placeholder="Authorization Token" class="w-full bg-cyber-900 border border-cyber-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none">
                <div class="grid grid-cols-2 gap-1.5">
                  <input v-model="manualSalt" placeholder="Salt 盐值" class="bg-cyber-900 border border-cyber-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none">
                  <input v-model="manualSid" placeholder="SID (默认 336677)" class="bg-cyber-900 border border-cyber-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none">
                </div>
                <input v-model="manualProjectKey" placeholder="Project Key (选填，留空自动拉取)" class="w-full bg-cyber-900 border border-cyber-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none">
                <div role="button" @click="submitManualCreds()" class="w-full py-1.5 rounded bg-cyber-primary/20 border border-cyber-primary/40 text-cyber-primary font-bold text-xs hover:bg-cyber-primary/30 transition text-center cursor-pointer">
                  保存并接入
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, nextTick, ref, computed } from 'vue';
import { AirCloudClient } from '../../api/client';
import { voltageToPercentage, estimateRemainingDays } from '../../utils/battery-model';
import { wgs84ToGcj02 } from '../../utils/coord-transform';

declare const TMap: any;
declare const lucide: any;
declare const echarts: any;

const apiClient = AirCloudClient.getInstance();

function refreshIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// 动态生成高保真雷达脉冲车辆图标
function generateCarMarkerIcon() {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  
  ctx.beginPath();
  ctx.arc(24, 24, 21, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
  ctx.fill();
  ctx.strokeStyle = '#00f0ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(24, 24, 14, 0, Math.PI * 2);
  ctx.fillStyle = '#070d1d';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

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

// ==================== 多账号 / 真实设备响应式状态 ====================
const deviceList = ref<any[]>([]);
const deviceLoading = ref(true);
const authError = ref('');
const accountStates = ref<any[]>([]);
const activeAccountPhone = ref(apiClient.getActivePhone());
const activeAccountLabel = ref(apiClient.getActiveAccount().label);
const activeAccountHasAuth = ref(apiClient.hasAuth());
const activeProjectKey = ref('');
const activeDeviceId = ref('');

const activeProjectKeyShort = computed(() =>
  activeProjectKey.value ? activeProjectKey.value.slice(0, 8) + '…' : '自动发现中'
);

/** 运行时设备索引（由真实云端数据构建，仅供取值，不含任何本地捏造数值） */
const DEVICES_DB: Record<string, any> = {};

function rebuildDeviceDb(list: any[]) {
  Object.keys(DEVICES_DB).forEach(k => delete DEVICES_DB[k]);
  list.forEach(d => {
    DEVICES_DB[d.imei] = {
      name: d.name,
      shortName: d.shortName,
      lat: d.lat,
      lng: d.lng,
      battMv: d.voltageMv ? `${d.voltageMv} mV` : '未上报',
      csq: d.csq ? `CSQ ${d.csq}` : '无信号',
      speed: `${d.speed ?? 0} km/h`,
      status: d.online ? '在线' : '无定位',
      address: d.address || '未上报物理定位',
      lastActiveTime: d.lastActiveTime,
      online: d.online
    };
  });
}

function refreshAccountStates() {
  accountStates.value = apiClient.getAccountStates();
  activeAccountPhone.value = apiClient.getActivePhone();
  activeAccountLabel.value = apiClient.getActiveAccount().label;
  activeAccountHasAuth.value = apiClient.hasAuth();
  activeProjectKey.value = (apiClient as any).projectKey || '';
}

const isAddingAccount = ref(false);
const newAccountInputPhone = ref('');
const showManualCreds = ref(false);
const manualToken = ref('');
const manualSalt = ref('');
const manualSid = ref('336677');
const manualProjectKey = ref('');

function startOAuthForPhone(phone?: string) {
  const target = (phone || newAccountInputPhone.value || activeAccountPhone.value).trim();
  if (!target) return;
  window.location.href = apiClient.buildOAuthUrl(target, window.location.href);
}

function submitManualCreds() {
  const p = (newAccountInputPhone.value || activeAccountPhone.value).trim();
  if (!p || !manualToken.value.trim() || !manualSalt.value.trim()) return;
  apiClient.manualImportAuth(p, manualToken.value.trim(), manualSalt.value.trim(), manualSid.value.trim() || '336677', manualProjectKey.value.trim());
  showManualCreds.value = false;
  isAddingAccount.value = false;
  newAccountInputPhone.value = '';
  manualToken.value = '';
  manualSalt.value = '';
  refreshAccountStates();
  loadRealDevices();
}

function removeUserAccount(phone: string, event: Event) {
  event.stopPropagation();
  apiClient.removeAccount(phone);
  refreshAccountStates();
  loadRealDevices();
}

function mobileTabClass(d: any) {
  const base = 'mob-device-tab shrink-0 px-2.5 py-1 rounded-xl glass-panel flex items-center space-x-1.5 transition-all active:scale-95';
  return d.imei === activeDeviceId.value
    ? `${base} border border-cyber-primary/70 bg-cyber-primary/20 text-cyber-primary shadow-glow-cyan`
    : `${base} border border-cyber-700/60 bg-cyber-900/70 text-slate-300 hover:border-slate-500`;
}

function desktopCardClass(d: any) {
  const base = 'desk-dev-card p-3 rounded-xl cursor-pointer transition-all';
  return d.imei === activeDeviceId.value
    ? `${base} border border-cyber-primary/60 bg-cyber-primary/10 hover:border-cyber-primary`
    : `${base} border border-cyber-700/50 bg-cyber-900/40 hover:border-slate-500`;
}

function signalBadgeClass(d: any) {
  const base = 'text-[9px] font-mono px-1 py-0.2 rounded';
  if (!d.online) return `${base} bg-slate-800 text-slate-500`;
  return d.imei === activeDeviceId.value
    ? `${base} bg-cyber-emerald/20 text-cyber-emerald border border-cyber-emerald/30 font-bold`
    : `${base} bg-slate-800 text-slate-400`;
}

function signalBadgeText(d: any) {
  return d.online && d.csq ? `CSQ ${d.csq}` : '无定位';
}

/** 从合宙云端同步当前账号的真实设备清单 */
async function loadRealDevices() {
  deviceLoading.value = true;
  authError.value = '';
  try {
    const list = await apiClient.getDeviceList();
    deviceList.value = list;
    rebuildDeviceDb(list);

    if (list.length > 0) {
      const keep = list.some(d => d.imei === activeDeviceId.value);
      selectDeviceTab(keep ? activeDeviceId.value : list[0].imei);
    } else {
      activeDeviceId.value = '';
      TRACK_POINTS = [];
      drawSpeedWaveCanvas();
    }
  } catch (e: any) {
    deviceList.value = [];
    rebuildDeviceDb([]);
    activeDeviceId.value = '';
    TRACK_POINTS = [];
    if (e && e.name === 'AuthExpiredError') {
      authError.value = '合宙云端登录态已失效（可能在其他设备重复登录），请重新授权当前账号。';
      // 会话被顶号时立即弹出账号面板，给出可见的重登入口
      const modal = document.getElementById('official-modal');
      if (modal) modal.classList.remove('hidden');
    } else {
      authError.value = e?.message || '云端设备资产清单同步失败';
    }
    console.warn('[AirTrack] loadRealDevices failed', e);
  } finally {
    deviceLoading.value = false;
    refreshAccountStates();
    nextTick(() => {
      drawSpeedWaveCanvas();
      refreshIcons();
    });
  }
}

/** 切换合宙工作空间账号 */
async function switchAccount(phone: string) {
  if (phone === apiClient.getActivePhone()) {
    syncOfficialData();
    return;
  }
  apiClient.setActiveAccount(phone);
  activeDeviceId.value = '';
  deviceList.value = [];
  rebuildDeviceDb([]);
  TRACK_POINTS = [];
  refreshAccountStates();
  await loadRealDevices();
}

async function fetchDeviceLiveTrackAndTags(imei: string) {
  try {
    const realPoints = await apiClient.getHistoricalTrack(imei, masterMode === 'range' ? currentMacroScope : 'recent_window');
    if (realPoints && realPoints.length > 5) {
      TRACK_POINTS = realPoints;
      if (masterMode === 'range') {
        renderRangeTrackOnMap();
      } else {
        renderFullColoredTrackOnMap();
      }
      renderStateAtPosition(committedPlayhead, false);
      drawSpeedWaveCanvas();
    }

    const tagData = await apiClient.getRealTagTelemetry(imei);
    if (tagData) {
      if (tagData.val_799) {
        const mv = parseInt(tagData.val_799, 10);
        const pct = voltageToPercentage(mv);
        const battEl = document.getElementById('tel-tag-batt');
        if (battEl) battEl.innerText = `${mv} mV (${pct}%)`;
      }
      if (tagData.val_782) {
        const csq = parseInt(tagData.val_782, 10);
        const csqEl = document.getElementById('tel-tag-csq');
        if (csqEl) csqEl.innerText = `CSQ ${csq} (${csq >= 25 ? '满格' : '良好'})`;
      }
    }
  } catch (err) {
    console.warn('[AirCloud] Live telemetry sync fallback', err);
  }
}

function selectDeviceTab(imei: string) {
  const dev = DEVICES_DB[imei];
  if (!dev) return;
  activeDeviceId.value = imei;

  // 设备列表头自动滚动到当前频道（样式由 Vue 响应式类绑定管理）
  nextTick(() => {
    const activeMobTab = document.getElementById('mob-tab-dev-' + imei);
    if (activeMobTab && (activeMobTab as any).scrollIntoView) {
      (activeMobTab as any).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });

  const deskTopName = document.getElementById('desktop-top-device-name');
  if (deskTopName) {
    deskTopName.innerText = `${dev.name} (${dev.status})`;
  }

  const elName = document.getElementById('drawer-vehicle-name');
  if (elName) elName.innerText = dev.name;
  const elBatt = document.getElementById('tel-tag-batt');
  if (elBatt) elBatt.innerText = dev.battMv;
  const elCsq = document.getElementById('tel-tag-csq');
  if (elCsq) elCsq.innerText = dev.csq;

  // 同步更新顶部机头设备状态
  const mobHeaderName = document.getElementById('mob-drawer-vehicle-name');
  if (mobHeaderName) mobHeaderName.innerText = dev.name;

  const located = typeof dev.lat === 'number' && typeof dev.lng === 'number' && !isNaN(dev.lat) && !isNaN(dev.lng);
  const coordText = located ? `${dev.lat.toFixed(4)}°N, ${dev.lng.toFixed(4)}°E` : '未上报经纬度';

  const elCoord = document.getElementById('drawer-coord-text');
  if (elCoord) elCoord.innerText = coordText;
  const elTagCoord = document.getElementById('tel-tag-coords');
  if (elTagCoord) elTagCoord.innerText = coordText;
  const mobHeaderCoord = document.getElementById('mob-drawer-coord-text');
  if (mobHeaderCoord) mobHeaderCoord.innerText = coordText;

  // 仅对真实上报过定位的物理设备做地图定位；未上报设备不做任何坐标推测
  if (located) {
    if ((window as any).__map) {
      const center = new TMap.LatLng(dev.lat, dev.lng);
      (window as any).__map.panTo(center);
      if ((window as any).__vehicleMarker) {
        (window as any).__vehicleMarker.setGeometries([{
          id: 'v1',
          styleId: 'car_icon',
          position: center,
          properties: { title: dev.name }
        }]);
      }
      if ((window as any).__fenceCircle) {
        (window as any).__fenceCircle.setGeometries([{
          center: center,
          radius: 1000,
          styleId: 'fence'
        }]);
      }
    }
    currentBaseLat = dev.lat;
    currentBaseLng = dev.lng;
  } else if ((window as any).__vehicleMarker) {
    // 未上报定位：移除车辆标记，避免在错误位置显示设备
    (window as any).__vehicleMarker.setGeometries([]);
  }

  loadTrackDataForScope(masterMode === 'range' ? currentMacroScope : 'recent_window');

  // 触发真实云端接口同步
  fetchDeviceLiveTrackAndTags(imei);
}

function recenterVehicle() {
  if (activeDeviceId.value) selectDeviceTab(activeDeviceId.value);
}

let TRACK_POINTS: any[] = [];
let currentBaseLat = 34.794375;
let currentBaseLng = 114.335039;
let currentMacroScope = '90d';
let isTrackLoading = false;

async function loadTrackDataForScope(scope: string, startDate: string | null = null, endDate: string | null = null) {
  const imei = activeDeviceId.value;
  if (!imei) {
    TRACK_POINTS = [];
    drawSpeedWaveCanvas();
    return;
  }

  const dev = DEVICES_DB[imei];
  isTrackLoading = true;

  try {
    const points = await apiClient.getHistoricalTrack(
      imei,
      scope,
      startDate || undefined,
      endDate || undefined
    );

    if (points && points.length > 0) {
      TRACK_POINTS = points;
      updateTimelineScaleTicks(points[0].isMultiDay);
      drawSpeedWaveCanvas();

      if (masterMode === 'range') {
        renderRangeTrackOnMap();
      } else {
        renderFullColoredTrackOnMap();
      }
      renderStateAtPosition(committedPlayhead, false);
      return;
    }
  } catch (err) {
    console.warn('[AirTrack] loadTrackDataForScope failed', err);
  } finally {
    isTrackLoading = false;
  }

  // 兜底：若云端或本地该时间段暂无轨迹上报，但设备本身有最新坐标
  if (dev && typeof dev.lat === 'number' && typeof dev.lng === 'number') {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    TRACK_POINTS = [{
      index: 0,
      lat: dev.lat,
      lng: dev.lng,
      gcjLat: dev.lat,
      gcjLng: dev.lng,
      speed: 0.0,
      timeStr,
      timestamp: now.getTime(),
      isMultiDay: false
    }];
  } else {
    TRACK_POINTS = [];
  }

  updateTimelineScaleTicks(false);
  drawSpeedWaveCanvas();
  if ((window as any).__trackLines) {
    (window as any).__trackLines.setGeometries([]);
  }
}

function updateTimelineScaleTicks(isMultiDay: boolean) {
  if (!TRACK_POINTS.length) return;
  const numPoints = TRACK_POINTS.length;
  const pStart = TRACK_POINTS[0];
  const pMid1 = TRACK_POINTS[Math.floor(numPoints * 0.25)];
  const pMid2 = TRACK_POINTS[Math.floor(numPoints * 0.5)];
  const pMid3 = TRACK_POINTS[Math.floor(numPoints * 0.75)];
  const pEnd = TRACK_POINTS[numPoints - 1];

  const fmt = (p: any, label = '') => {
    if (!p || !p.timeStr) return '';
    if (isMultiDay) {
      return `${p.timeStr.slice(5, 10)}${label}`;
    } else {
      return `${p.timeStr.slice(11, 16)}${label}`;
    }
  };

  const tStart = document.getElementById('scale-tick-start');
  if (tStart) tStart.innerText = fmt(pStart);
  const t1 = document.getElementById('scale-tick-1');
  if (t1) t1.innerText = fmt(pMid1);
  const t2 = document.getElementById('scale-tick-2');
  if (t2) t2.innerText = fmt(pMid2);
  const t3 = document.getElementById('scale-tick-3');
  if (t3) t3.innerText = fmt(pMid3);
  const tEnd = document.getElementById('scale-tick-end');
  if (tEnd) tEnd.innerHTML = `<span>${fmt(pEnd)}</span><span class="w-1 h-1 rounded-full bg-cyber-primary animate-pulse-cyan"></span>`;
}

const CHROMA_STOPS = [
  { v: 0,  r: 59,  g: 130, b: 246, hex: '#3b82f6', name: '静止' },
  { v: 12, r: 0,   g: 240, b: 255, hex: '#00f0ff', name: '起步' },
  { v: 24, r: 16,  g: 185, b: 129, hex: '#10b981', name: '巡航' },
  { v: 38, r: 234, g: 179, b: 8,   hex: '#eab308', name: '畅行' },
  { v: 50, r: 249, g: 115, b: 22,  hex: '#f97316', name: '飞驰' },
  { v: 65, r: 244, g: 63,  b: 94,  hex: '#f43f5e', name: '极速' }
];

function getContinuousSpeedColor(speed: number) {
  if (speed <= CHROMA_STOPS[0].v) {
    const s = CHROMA_STOPS[0];
    return { rgb: `rgb(${s.r},${s.g},${s.b})`, hex: s.hex, name: s.name, rgba: (a: number) => `rgba(${s.r},${s.g},${s.b},${a})` };
  }
  const last = CHROMA_STOPS[CHROMA_STOPS.length - 1];
  if (speed >= last.v) {
    return { rgb: `rgb(${last.r},${last.g},${last.b})`, hex: last.hex, name: last.name, rgba: (a: number) => `rgba(${last.r},${last.g},${last.b},${a})` };
  }

  for (let i = 0; i < CHROMA_STOPS.length - 1; i++) {
    const s1 = CHROMA_STOPS[i];
    const s2 = CHROMA_STOPS[i + 1];
    if (speed >= s1.v && speed <= s2.v) {
      const t = (speed - s1.v) / (s2.v - s1.v);
      const r = Math.round(s1.r + (s2.r - s1.r) * t);
      const g = Math.round(s1.g + (s2.g - s1.g) * t);
      const b = Math.round(s1.b + (s2.b - s1.b) * t);
      const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
      const name = t > 0.5 ? s2.name : s1.name;
      return { rgb: `rgb(${r},${g},${b})`, hex: hex, name: name, rgba: (a: number) => `rgba(${r},${g},${b},${a})` };
    }
  }
  return { rgb: 'rgb(0,240,255)', hex: '#00f0ff', name: '巡航', rgba: (a: number) => `rgba(0,240,255,${a})` };
}

function getRealCanvas(): HTMLCanvasElement | null {
  const el = document.getElementById('speed-wave-canvas');
  if (!el) return null;
  if (el.tagName === 'CANVAS') return el as HTMLCanvasElement;
  const inner = el.querySelector('canvas');
  if (inner) return inner as HTMLCanvasElement;
  return null;
}

function drawSpeedWaveCanvas() {
  const canvas = getRealCanvas();
  if (!canvas) return;
  const container = document.getElementById('timeline-track-container');
  const rect = container ? container.getBoundingClientRect() : canvas.getBoundingClientRect();
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

  if (!TRACK_POINTS.length) return;

  const numPoints = TRACK_POINTS.length;
  const pts: any[] = [];
  const BASELINE_H = 3;
  const MAX_WAVE_H = h - 5;
  for (let i = 0; i < numPoints; i++) {
    const x = numPoints > 1 ? (i / (numPoints - 1)) * w : 0;
    const sp = TRACK_POINTS[i].speed;
    const waveH = BASELINE_H + (sp / 65) * (MAX_WAVE_H - BASELINE_H);
    const y = h - waveH;
    pts.push({ x, y, speed: sp });
  }

  const speedGradient = ctx.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i < numPoints; i++) {
    const stop = numPoints > 1 ? i / (numPoints - 1) : 0;
    speedGradient.addColorStop(stop, getContinuousSpeedColor(TRACK_POINTS[i].speed).rgb);
  }

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.lineTo(w, h);
  ctx.closePath();

  ctx.fillStyle = speedGradient;
  ctx.globalAlpha = 0.88;
  ctx.fill();

  const verticalLight = ctx.createLinearGradient(0, 0, 0, h);
  verticalLight.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  verticalLight.addColorStop(0.4, 'rgba(255, 255, 255, 0.1)');
  verticalLight.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = verticalLight;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.strokeStyle = '#ffffff';
  ctx.shadowColor = '#00f0ff';
  ctx.shadowBlur = 4;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = speedGradient;
  ctx.fillRect(0, h - 2, w, 2);
}

let masterMode = 'live';
let isPlaying = false;
let playTimer: any = null;
let playSpeed = 1;

let rangeStart = 37.0;
let rangeEnd = 50.5;

let committedPlayhead = 100;
let isHovering = false;
let isDragging = false;

const todayDate = new Date();
const padTwo = (n: number) => String(n).padStart(2, '0');
const formatYMD = (d: Date) => `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;

const customDateEnd = ref(formatYMD(todayDate));
const customDateStart = ref(formatYMD(new Date(todayDate.getTime() - 30 * 86400000)));

function toggleDateRangePopover() {
  if (masterMode === 'live') return;
  const popover = document.getElementById('date-range-popover');
  if (popover) popover.classList.toggle('hidden');
}

function selectMacroPreset(preset: string) {
  currentMacroScope = preset;
  document.querySelectorAll('.macro-chip').forEach(b => {
    b.className = 'macro-chip py-1 rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-slate-500 transition';
  });
  const activeBtn = document.getElementById('macro-btn-' + preset);
  if (activeBtn) {
    activeBtn.className = 'macro-chip py-1 rounded-lg bg-cyber-primary/20 text-cyber-primary border border-cyber-primary/40 font-bold transition';
  }

  const label = document.getElementById('current-range-label');
  if (label) {
    if (preset === 'today') label.innerText = '今日';
    else if (preset === 'yesterday') label.innerText = '昨日';
    else if (preset === '3d') label.innerText = '近3天';
    else if (preset === '7d') label.innerText = '近7天';
    else if (preset === '30d') label.innerText = '近1月';
    else if (preset === '90d') label.innerText = '近1季';
  }

  loadTrackDataForScope(preset);
  toggleDateRangePopover();

  if (masterMode === 'range') {
    renderRangeTrackOnMap();
  } else {
    renderFullColoredTrackOnMap();
  }
  renderStateAtPosition(committedPlayhead, false);
  updateRangeDOM();
}

function applyCustomDateRange() {
  const dStart = customDateStart.value || (document.getElementById('input-date-start') as HTMLInputElement)?.value;
  const dEnd = customDateEnd.value || (document.getElementById('input-date-end') as HTMLInputElement)?.value;
  if (!dStart || !dEnd) return;

  currentMacroScope = 'custom';
  const label = document.getElementById('current-range-label');
  if (label) label.innerText = `${dStart.slice(5)}~${dEnd.slice(5)}`;
  loadTrackDataForScope('custom', dStart, dEnd);
  toggleDateRangePopover();

  if (masterMode === 'range') {
    renderRangeTrackOnMap();
  } else {
    renderFullColoredTrackOnMap();
  }
  renderStateAtPosition(committedPlayhead, false);
  updateRangeDOM();
}

function switchMasterMode(mode: string) {
  masterMode = mode;
  
  const btnLive = document.getElementById('btn-mode-live');
  const btnRange = document.getElementById('btn-mode-range');
  
  const dateDivider = document.getElementById('macro-date-divider');
  const dateTrigger = document.getElementById('btn-date-trigger');
  const popover = document.getElementById('date-range-popover');
  
  const playCluster = document.getElementById('unified-play-cluster');
  const rangeCapsule = document.getElementById('range-capsule');
  const maskLeft = document.getElementById('mask-left');
  const maskRight = document.getElementById('mask-right');
  
  const liveStatusBar = document.getElementById('live-status-bar');
  const rangeStatusBar = document.getElementById('range-status-bar');

  stopRangePlayback();
  if (popover) popover.classList.add('hidden');

  if (mode === 'live') {
    if (btnLive) btnLive.className = 'px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold text-cyber-primary bg-cyber-primary/15 border border-cyber-primary/30 transition-all flex items-center space-x-1 shadow-glow-cyan';
    if (btnRange) btnRange.className = 'px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-medium text-slate-400 hover:text-white transition-all flex items-center space-x-1';
    
    if (dateDivider) dateDivider.classList.add('hidden');
    if (dateTrigger) dateTrigger.classList.add('hidden');

    if (playCluster) playCluster.classList.add('hidden');
    if (rangeCapsule) rangeCapsule.classList.add('hidden');
    if (maskLeft) maskLeft.classList.add('hidden');
    if (maskRight) maskRight.classList.add('hidden');

    if (liveStatusBar) liveStatusBar.classList.remove('hidden');
    if (rangeStatusBar) rangeStatusBar.classList.add('hidden');

    loadTrackDataForScope('recent_window');

    committedPlayhead = 100;
    renderStateAtPosition(committedPlayhead, false);
    renderFullColoredTrackOnMap();
    recenterVehicle();
  } else {
    if (btnLive) btnLive.className = 'px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-medium text-slate-400 hover:text-white transition-all flex items-center space-x-1';
    if (btnRange) btnRange.className = 'px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold text-cyber-primary bg-cyber-primary/15 border border-cyber-primary/30 transition-all flex items-center space-x-1 shadow-glow-cyan';
    
    if (dateDivider) dateDivider.classList.remove('hidden');
    if (dateTrigger) dateTrigger.classList.remove('hidden');

    if (playCluster) playCluster.classList.remove('hidden');
    if (rangeCapsule) rangeCapsule.classList.remove('hidden');
    if (maskLeft) maskLeft.classList.remove('hidden');
    if (maskRight) maskRight.classList.remove('hidden');

    if (liveStatusBar) liveStatusBar.classList.add('hidden');
    if (rangeStatusBar) rangeStatusBar.classList.remove('hidden');

    loadTrackDataForScope(currentMacroScope);

    committedPlayhead = rangeEnd;
    updateRangeDOM();
    renderStateAtPosition(committedPlayhead, false);
    renderRangeTrackOnMap();
  }
  refreshIcons();
  setTimeout(refreshIcons, 50);
}

function renderStateAtPosition(percent: number, isPreview = false) {
  if (!TRACK_POINTS.length) return;
  const numPoints = TRACK_POINTS.length;
  const idx = Math.min(Math.floor((percent / 100) * (numPoints - 1)), numPoints - 1);
  const pt = TRACK_POINTS[idx];
  if (!pt) return;
  const sColor = getContinuousSpeedColor(pt.speed);

  if (!isPreview) {
    const playheadNeedle = document.getElementById('playhead-needle');
    if (playheadNeedle) playheadNeedle.style.left = percent + '%';
    const dot = document.getElementById('playhead-inner-dot');
    if (dot) dot.style.backgroundColor = sColor.hex;

    const liveTime = document.getElementById('live-latest-time');
    if (liveTime && pt.timeStr) liveTime.innerText = pt.timeStr.slice(11, 19);
    const liveSpeed = document.getElementById('live-latest-speed');
    if (liveSpeed) {
      liveSpeed.innerText = `${pt.speed} km/h`;
      liveSpeed.style.color = sColor.hex;
    }

    const drawerSpeed = document.getElementById('drawer-speed-badge');
    if (drawerSpeed) {
      drawerSpeed.innerText = `${pt.speed} km/h`;
    }

    const timeBox = document.getElementById('current-point-time');
    if (timeBox && pt.timeStr) timeBox.innerText = pt.isMultiDay ? pt.timeStr.slice(5, 16) : pt.timeStr.slice(11, 16);

    const speedTag = document.getElementById('current-speed-tag');
    if (speedTag) {
      speedTag.style.backgroundColor = sColor.rgba(0.2);
      speedTag.style.borderColor = sColor.rgba(0.5);
      speedTag.style.color = sColor.hex;
      speedTag.innerText = `${pt.speed} km/h`;
    }

    // 同步地图上车辆标点位置，实现滑块拖拽平滑跟跑
    if ((window as any).__vehicleMarker && typeof TMap !== 'undefined' && typeof pt.lat === 'number' && typeof pt.lng === 'number') {
      const pos = new TMap.LatLng(pt.lat, pt.lng);
      (window as any).__vehicleMarker.setGeometries([{
        id: 'v1',
        styleId: 'car_icon',
        position: pos,
        properties: { title: `${pt.speed} km/h` }
      }]);
    }
  }

  if (typeof pt.lat === 'number' && typeof pt.lng === 'number') {
    const elCoord = document.getElementById('drawer-coord-text');
    if (elCoord) elCoord.innerText = `${pt.lat.toFixed(4)}°N, ${pt.lng.toFixed(4)}°E`;
    const elTagCoord = document.getElementById('tel-tag-coords');
    if (elTagCoord) elTagCoord.innerText = `${pt.lat.toFixed(4)}°N, ${pt.lng.toFixed(4)}°E`;
  }
  
  const drawerSpeed = document.getElementById('drawer-speed-badge');
  if (drawerSpeed) {
    drawerSpeed.style.backgroundColor = sColor.rgba(0.2);
    drawerSpeed.style.color = sColor.hex;
    drawerSpeed.innerText = `${pt.speed} km/h`;
  }
  const telSpeed = document.getElementById('tel-tag-speed');
  if (telSpeed) {
    telSpeed.style.color = sColor.hex;
    telSpeed.innerText = `${pt.speed} km/h`;
  }

  if ((window as any).__vehicleMarker) {
    (window as any).__vehicleMarker.setGeometries([{
      id: 'v1',
      styleId: 'car_icon',
      position: new TMap.LatLng(pt.lat, pt.lng),
      properties: { title: DEVICES_DB[activeDeviceId.value]?.name || '合宙设备' }
    }]);
  }
}

function onTimelineMouseMove(e: MouseEvent) {
  if (isDragging || !TRACK_POINTS.length) return;

  const container = document.getElementById('timeline-track-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const p = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));

  isHovering = true;

  const hoverNeedle = document.getElementById('hover-needle');
  if (hoverNeedle) {
    hoverNeedle.classList.remove('hidden');
    hoverNeedle.style.left = p + '%';
  }

  if (!TRACK_POINTS.length) return;
  const numPoints = TRACK_POINTS.length;
  const idx = Math.min(Math.floor((p / 100) * (numPoints - 1)), numPoints - 1);
  const pt = TRACK_POINTS[idx];
  if (!pt) return;
  const sColor = getContinuousSpeedColor(pt.speed);

  const bubbleTime = pt.isMultiDay ? pt.timeStr.slice(5, 16) : pt.timeStr.slice(11, 19);
  const elBTime = document.getElementById('hover-bubble-time');
  if (elBTime) elBTime.innerText = bubbleTime;
  const speedBubble = document.getElementById('hover-bubble-speed');
  if (speedBubble) {
    speedBubble.innerText = `${pt.speed} km/h`;
    speedBubble.style.color = sColor.hex;
  }

  renderStateAtPosition(p, true);
}

function onTimelineUserClick(e: MouseEvent) {
  if (isDragging || !TRACK_POINTS.length) return;

  const container = document.getElementById('timeline-track-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const p = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));

  committedPlayhead = p;
  isHovering = false;

  const hoverNeedle = document.getElementById('hover-needle');
  if (hoverNeedle) hoverNeedle.classList.add('hidden');
  renderStateAtPosition(committedPlayhead, false);
}

function onTimelineMouseLeave() {
  if (isDragging || !isHovering) return;
  isHovering = false;

  const hoverNeedle = document.getElementById('hover-needle');
  if (hoverNeedle) hoverNeedle.classList.add('hidden');
  renderStateAtPosition(committedPlayhead, false);
}

function applyTimePreset(type: string) {
  if (type === 'sprint') {
    rangeStart = 55;
    rangeEnd = 78;
  }
  committedPlayhead = rangeStart;
  updateRangeDOM();
  renderStateAtPosition(committedPlayhead, false);
  renderRangeTrackOnMap();
}

function updateRangeDOM() {
  if (rangeStart < 0) rangeStart = 0;
  if (rangeEnd > 100) rangeEnd = 100;
  if (rangeStart > rangeEnd - 3) rangeStart = rangeEnd - 3;

  const capsule = document.getElementById('range-capsule');
  if (capsule) {
    capsule.style.left = rangeStart + '%';
    capsule.style.width = (rangeEnd - rangeStart) + '%';
  }

  const maskL = document.getElementById('mask-left');
  const maskR = document.getElementById('mask-right');
  if (masterMode === 'range') {
    if (maskL) maskL.style.width = rangeStart + '%';
    if (maskR) maskR.style.width = (100 - rangeEnd) + '%';
  }

  if (!TRACK_POINTS.length) return;
  const numPoints = TRACK_POINTS.length;
  const idxStart = Math.min(Math.floor((rangeStart / 100) * (numPoints - 1)), numPoints - 1);
  const idxEnd = Math.min(Math.floor((rangeEnd / 100) * (numPoints - 1)), numPoints - 1);
  
  const pS = TRACK_POINTS[idxStart];
  const pE = TRACK_POINTS[idxEnd];

  const tStart = pS.isMultiDay ? pS.timeStr.slice(5, 16) : pS.timeStr.slice(11, 16);
  const tEnd = pE.isMultiDay ? pE.timeStr.slice(5, 16) : pE.timeStr.slice(11, 16);

  const bL = document.getElementById('drag-bubble-left');
  if (bL) bL.innerText = tStart;
  const bR = document.getElementById('drag-bubble-right');
  if (bR) bR.innerText = tEnd;
}

function toggleRangePlay() {
  if (isPlaying) stopRangePlayback();
  else startRangePlayback();
}

function startRangePlayback() {
  isPlaying = true;
  const txt = document.getElementById('txt-range-play');
  if (txt) txt.innerText = '暂停';
  const icon = document.getElementById('icon-range-play');
  if (icon) icon.setAttribute('data-lucide', 'pause');
  if (typeof lucide !== 'undefined') lucide.createIcons();

  if (committedPlayhead >= rangeEnd || committedPlayhead < rangeStart) {
    committedPlayhead = rangeStart;
  }

  playTimer = setInterval(() => {
    committedPlayhead += 0.5 * playSpeed;
    if (committedPlayhead >= rangeEnd) {
      committedPlayhead = rangeEnd;
      renderStateAtPosition(committedPlayhead, false);
      stopRangePlayback();
      return;
    }
    renderStateAtPosition(committedPlayhead, false);
  }, 100);
}

function stopRangePlayback() {
  isPlaying = false;
  if (playTimer) clearInterval(playTimer);
  const txt = document.getElementById('txt-range-play');
  const icon = document.getElementById('icon-range-play');
  if (txt) txt.innerText = '播放';
  if (icon) icon.setAttribute('data-lucide', 'play');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function setPlaySpeed(s: number, e: MouseEvent) {
  playSpeed = s;
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.className = 'speed-btn px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] text-slate-400 hover:text-white';
  });
  if (e.currentTarget) {
    (e.currentTarget as HTMLElement).className = 'speed-btn px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] bg-cyber-primary/20 text-cyber-primary font-bold';
  }
}

function setupSilkyTimelineInteractions() {
  const container = document.getElementById('timeline-track-container');
  const handleL = document.getElementById('handle-left-hitbox');
  const handleR = document.getElementById('handle-right-hitbox');
  const rangeBody = document.getElementById('range-body');
  const bubbleL = document.getElementById('drag-bubble-left');
  const bubbleR = document.getElementById('drag-bubble-right');

  if (!container || !handleL || !handleR || !rangeBody || !bubbleL || !bubbleR) return;

  let activeDrag: string | null = null;
  let activePointerId: number | null = null;
  let startClientX = 0;
  let initStartVal = 0;
  let initEndVal = 0;
  let containerRect: DOMRect | null = null;
  let rAFPending = false;

  function scheduleDOMUpdate() {
    if (!rAFPending) {
      rAFPending = true;
      requestAnimationFrame(() => {
        updateRangeDOM();
        rAFPending = false;
      });
    }
  }

  function onPointerDown(type: string, e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();

    activeDrag = type;
    activePointerId = e.pointerId;
    startClientX = e.clientX;
    initStartVal = rangeStart;
    initEndVal = rangeEnd;
    isDragging = true;

    containerRect = container!.getBoundingClientRect();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch (err) {}

    if (type === 'left') {
      bubbleL!.classList.remove('hidden');
      document.body.classList.add('is-dragging-handle');
    } else if (type === 'right') {
      bubbleR!.classList.remove('hidden');
      document.body.classList.add('is-dragging-handle');
    } else if (type === 'body') {
      bubbleL!.classList.remove('hidden');
      bubbleR!.classList.remove('hidden');
      document.body.classList.add('is-dragging-body');
    }

    const hoverNeedle = document.getElementById('hover-needle');
    if (hoverNeedle) hoverNeedle.classList.add('hidden');
  }

  function onPointerMove(e: PointerEvent) {
    if (!activeDrag || e.pointerId !== activePointerId || !containerRect) return;

    const deltaX = e.clientX - startClientX;
    const deltaPercent = (deltaX / containerRect.width) * 100;

    if (activeDrag === 'left') {
      let newS = initStartVal + deltaPercent;
      if (newS < 0) newS = 0;
      if (newS > rangeEnd - 3) newS = rangeEnd - 3;
      rangeStart = newS;
      scheduleDOMUpdate();
    } else if (activeDrag === 'right') {
      let newE = initEndVal + deltaPercent;
      if (newE > 100) newE = 100;
      if (newE < rangeStart + 3) newE = rangeStart + 3;
      rangeEnd = newE;
      scheduleDOMUpdate();
    } else if (activeDrag === 'body') {
      const span = initEndVal - initStartVal;
      let newS = initStartVal + deltaPercent;
      let newE = initEndVal + deltaPercent;

      if (newS < 0) {
        newS = 0;
        newE = span;
      }
      if (newE > 100) {
        newE = 100;
        newS = 100 - span;
      }

      rangeStart = newS;
      rangeEnd = newE;
      scheduleDOMUpdate();
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!activeDrag) return;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}

    activeDrag = null;
    activePointerId = null;
    isDragging = false;

    document.body.classList.remove('is-dragging-handle');
    document.body.classList.remove('is-dragging-body');

    bubbleL!.classList.add('hidden');
    bubbleR!.classList.add('hidden');

    renderRangeTrackOnMap();
  }

  handleL.addEventListener('pointerdown', (e) => onPointerDown('left', e));
  handleL.addEventListener('pointermove', onPointerMove);
  handleL.addEventListener('pointerup', onPointerUp);
  handleL.addEventListener('pointercancel', onPointerUp);

  handleR.addEventListener('pointerdown', (e) => onPointerDown('right', e));
  handleR.addEventListener('pointermove', onPointerMove);
  handleR.addEventListener('pointerup', onPointerUp);
  handleR.addEventListener('pointercancel', onPointerUp);

  rangeBody.addEventListener('pointerdown', (e) => onPointerDown('body', e));
  rangeBody.addEventListener('pointermove', onPointerMove);
  rangeBody.addEventListener('pointerup', onPointerUp);
  rangeBody.addEventListener('pointercancel', onPointerUp);

  container.addEventListener('mousemove', onTimelineMouseMove);
  container.addEventListener('click', onTimelineUserClick);
  container.addEventListener('mouseleave', onTimelineMouseLeave);
}

function renderFullColoredTrackOnMap() {
  if (!(window as any).__map || !(window as any).__trackLines || !TRACK_POINTS.length) return;
  const numPoints = TRACK_POINTS.length;
  if (numPoints < 2) {
    (window as any).__trackLines.setGeometries([]);
    return;
  }

  // 1. 判断是否属于室内静止驻留 (最大经纬度跨度 < 0.0003 即 ~30米，且无运动速度)
  let minLat = 999, maxLat = -999, minLng = 999, maxLng = -999, maxSpeed = 0;
  for (let i = 0; i < numPoints; i++) {
    const p = TRACK_POINTS[i];
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.speed > maxSpeed) maxSpeed = p.speed;
  }
  const deltaLat = maxLat - minLat;
  const deltaLng = maxLng - minLng;
  const isStationaryDwell = (deltaLat < 0.0003 && deltaLng < 0.0003 && maxSpeed < 3.0);

  if (isStationaryDwell) {
    // 室内静止驻留点：不绘制多点漂移杂乱折线，直接清空路线，仅保留车辆标点
    (window as any).__trackLines.setGeometries([]);
    return;
  }

  const rainbowPaths = [];
  for (let i = 0; i < numPoints - 1; i++) {
    const p1 = TRACK_POINTS[i];
    const p2 = TRACK_POINTS[i + 1];
    const avgSpeed = (p1.speed + p2.speed) / 2;
    const c = getContinuousSpeedColor(avgSpeed);
    rainbowPaths.push({
      path: [new TMap.LatLng(p1.lat, p1.lng), new TMap.LatLng(p2.lat, p2.lng)],
      color: c.rgb,
      borderColor: 'rgba(7, 13, 29, 0.45)'
    });
  }

  (window as any).__trackLines.setGeometries([{
    id: 'track_rainbow',
    styleId: 'rainbow_style',
    rainbowPaths: rainbowPaths
  }]);
}

function renderRangeTrackOnMap() {
  if (!(window as any).__map || !(window as any).__trackLines || !TRACK_POINTS.length) return;
  const numPoints = TRACK_POINTS.length;
  if (numPoints < 2) {
    (window as any).__trackLines.setGeometries([]);
    return;
  }

  const idxStart = Math.min(Math.floor((rangeStart / 100) * (numPoints - 1)), numPoints - 1);
  const idxEnd = Math.min(Math.floor((rangeEnd / 100) * (numPoints - 1)), numPoints - 1);

  if (idxEnd <= idxStart) {
    (window as any).__trackLines.setGeometries([]);
    return;
  }

  // 判断选定区间内是否属于静止驻留
  let minLat = 999, maxLat = -999, minLng = 999, maxLng = -999, maxSpeed = 0;
  for (let i = idxStart; i <= idxEnd; i++) {
    const p = TRACK_POINTS[i];
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.speed > maxSpeed) maxSpeed = p.speed;
  }
  const deltaLat = maxLat - minLat;
  const deltaLng = maxLng - minLng;
  const isStationaryDwell = (deltaLat < 0.0003 && deltaLng < 0.0003 && maxSpeed < 3.0);

  if (isStationaryDwell) {
    (window as any).__trackLines.setGeometries([]);
    return;
  }

  const rainbowPaths = [];
  for (let i = idxStart; i < idxEnd; i++) {
    const p1 = TRACK_POINTS[i];
    const p2 = TRACK_POINTS[i + 1];
    const avgSpeed = (p1.speed + p2.speed) / 2;
    const c = getContinuousSpeedColor(avgSpeed);
    rainbowPaths.push({
      path: [new TMap.LatLng(p1.lat, p1.lng), new TMap.LatLng(p2.lat, p2.lng)],
      color: c.rgb,
      borderColor: 'rgba(7, 13, 29, 0.45)'
    });
  }

  (window as any).__trackLines.setGeometries([{
    id: 'track_rainbow',
    styleId: 'rainbow_style',
    rainbowPaths: rainbowPaths
  }]);
}

let mobileSheetState = 'peek';

function setMobileSheetState(state: string) {
  mobileSheetState = state;
  const drawer = document.getElementById('inspector-drawer');
  const chevron = document.getElementById('icon-sheet-chevron');
  if (!drawer) return;

  drawer.classList.remove('sheet-peek', 'sheet-half', 'sheet-full');
  drawer.classList.add('sheet-' + state);

  if (chevron) {
    if (state === 'peek') {
      chevron.setAttribute('data-lucide', 'chevron-up');
    } else if (state === 'half') {
      chevron.setAttribute('data-lucide', 'chevron-up');
    } else if (state === 'full') {
      chevron.setAttribute('data-lucide', 'chevron-down');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  if ((window as any).__accelChart) {
    setTimeout(() => (window as any).__accelChart.resize(), 200);
  }
}

function cycleMobileSheet() {
  if (window.innerWidth >= 768) return;
  if (mobileSheetState === 'peek') setMobileSheetState('half');
  else if (mobileSheetState === 'half') setMobileSheetState('full');
  else setMobileSheetState('peek');
}

function setupMobileSheetTouchGestures() {
  const handle = document.getElementById('sheet-drag-handle');
  const header = document.getElementById('sheet-header-bar');
  let touchStartY = 0;

  function onTouchStart(e: TouchEvent) {
    if (window.innerWidth >= 768) return;
    touchStartY = e.touches[0].clientY;
  }

  function onTouchEnd(e: TouchEvent) {
    if (window.innerWidth >= 768) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(deltaY) > 30) {
      if (deltaY < -30) {
        if (mobileSheetState === 'peek') setMobileSheetState('half');
        else if (mobileSheetState === 'half') setMobileSheetState('full');
      } else if (deltaY > 30) {
        if (mobileSheetState === 'full') setMobileSheetState('half');
        else if (mobileSheetState === 'half') setMobileSheetState('peek');
      }
    }
  }

  if (handle) {
    handle.addEventListener('touchstart', onTouchStart, { passive: true });
    handle.addEventListener('touchend', onTouchEnd, { passive: true });
    handle.addEventListener('click', cycleMobileSheet);
  }
  if (header) {
    header.addEventListener('touchstart', onTouchStart, { passive: true });
    header.addEventListener('touchend', onTouchEnd, { passive: true });
    header.addEventListener('click', (e) => {
      if (window.innerWidth < 768) cycleMobileSheet();
    });
  }
}

let isArmed = true;
function toggleQuickArm() {
  isArmed = !isArmed;
  const btn = document.getElementById('btn-quick-arm');
  const text = document.getElementById('quick-arm-text');
  if (!btn || !text) return;
  if (isArmed) {
    btn.className = 'px-2.5 py-1 rounded-xl text-[10px] font-bold bg-cyber-emerald text-white hover:bg-emerald-600 transition flex items-center space-x-1 shadow-glow-emerald';
    text.innerText = '已设防';
  } else {
    btn.className = 'px-2.5 py-1 rounded-xl text-[10px] font-bold bg-cyber-800 text-slate-400 hover:text-white transition flex items-center space-x-1';
    text.innerText = '已撤防';
  }
}

let isDockOpen = true;
function toggleDeviceDock() {
  if (window.innerWidth < 768) return;
  isDockOpen = !isDockOpen;
  const dock = document.getElementById('device-dock');
  if (!dock) return;
  if (isDockOpen) {
    dock.style.transform = 'translateX(0)';
    dock.style.opacity = '1';
    dock.style.pointerEvents = 'auto';
  } else {
    dock.style.transform = 'translateX(-115%)';
    dock.style.opacity = '0';
    dock.style.pointerEvents = 'none';
  }
}

let isInspectorOpen = true;
function toggleInspectorDrawer() {
  if (window.innerWidth < 768) {
    cycleMobileSheet();
    return;
  }
  isInspectorOpen = !isInspectorOpen;
  const drawer = document.getElementById('inspector-drawer');
  if (!drawer) return;
  if (isInspectorOpen) {
    drawer.style.transform = 'translateX(0)';
    drawer.style.opacity = '1';
    drawer.style.pointerEvents = 'auto';
  } else {
    drawer.style.transform = 'translateX(115%)';
    drawer.style.opacity = '0';
    drawer.style.pointerEvents = 'none';
  }
}

function toggleOfficialModal() {
  const modal = document.getElementById('official-modal');
  if (modal) modal.classList.toggle('hidden');
}

function redirectToOfficialOAuth() {
  const url = apiClient.buildOAuthUrl(apiClient.getActivePhone(), window.location.href);
  console.info('[AirTrack] 跳转合宙官方 OAuth 授权:', url);
  window.location.href = url;
}

async function syncOfficialData() {
  await loadRealDevices();
  toggleOfficialModal();
}

let compassTimer: any = null;

function initAccelChart() {
  const el = document.getElementById('chart-accel');
  if (!el || typeof echarts === 'undefined') return;
  const chart = echarts.init(el);
  (window as any).__accelChart = chart;

  const times: string[] = [];
  const dataX: number[] = [], dataY: number[] = [], dataZ: number[] = [];
  const now = Date.now();
  for (let i = 30; i >= 0; i--) {
    times.push(new Date(now - i * 100).toLocaleTimeString().slice(3));
    dataX.push(140 + Math.sin(i * 0.4) * 20);
    dataY.push(-80 + Math.cos(i * 0.4) * 15);
    dataZ.push(980 + Math.sin(i * 0.2) * 10);
  }

  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: ['X轴', 'Y轴', 'Z轴'], textStyle: { color: '#94a3b8', fontSize: 10 } },
    grid: { left: 30, right: 10, top: 25, bottom: 20 },
    xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#334155' } }, axisLabel: { color: '#64748b', fontSize: 9 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#64748b', fontSize: 9 } },
    series: [
      { name: 'X轴', type: 'line', smooth: true, showSymbol: false, data: dataX, itemStyle: { color: '#f43f5e' } },
      { name: 'Y轴', type: 'line', smooth: true, showSymbol: false, data: dataY, itemStyle: { color: '#10b981' } },
      { name: 'Z轴', type: 'line', smooth: true, showSymbol: false, data: dataZ, itemStyle: { color: '#00f0ff' } }
    ]
  });
}

function startCompassSimulator() {
  let t = 0;
  compassTimer = setInterval(() => {
    t += 0.05;
    const pitch = 4.2 + Math.sin(t) * 1.5;
    const roll = -1.5 + Math.cos(t) * 1.2;
    const yaw = (68.0 + Math.sin(t * 0.5) * 5).toFixed(1);
    
    const elP = document.getElementById('val-pitch');
    const elR = document.getElementById('val-roll');
    const elY = document.getElementById('val-yaw');
    if (elP) elP.innerText = (pitch > 0 ? '+' : '') + pitch.toFixed(1) + '°';
    if (elR) elR.innerText = (roll > 0 ? '+' : '') + roll.toFixed(1) + '°';
    if (elY) elY.innerText = yaw + '°';

    const p = document.getElementById('yaw-pointer');
    if (p) p.style.transform = `rotate(${yaw}deg)`;
    const h = document.getElementById('horizon-disc');
    if (h) h.style.transform = `rotate(${-roll}deg) translateY(${pitch * 1.2}px)`;
  }, 100);
}

onMounted(() => {
  refreshIcons();
  setTimeout(refreshIcons, 100);
  setTimeout(refreshIcons, 500);

  // 捕获合宙官方 OAuth 回调 token，并写入「发起登录的那个账号」
  if (typeof window !== 'undefined') {
    const searchStr = window.location.search || (window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '');
    const urlParams = new URLSearchParams(searchStr);
    const oauthToken = urlParams.get('token');
    if (oauthToken) {
      const pending = apiClient.consumePendingAccount() || apiClient.getActivePhone();
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      apiClient.exchangeOAuthToken(oauthToken, pending).then(ok => {
        console.info(ok ? `[AirTrack] 账号 ${pending} OAuth 换票成功` : `[AirTrack] 账号 ${pending} 换票失败`);
        refreshAccountStates();
        loadRealDevices();
      });
    }
  }

  window.addEventListener('resize', () => {
    drawSpeedWaveCanvas();
    if ((window as any).__accelChart) (window as any).__accelChart.resize();
  });

  try {
    if (typeof TMap !== 'undefined') {
      const center = new TMap.LatLng(34.794375, 114.335039);
      const mapEl = document.getElementById('main-map');
      if (mapEl) {
        const map = new TMap.Map(mapEl, {
          center: center,
          zoom: 14,
          viewMode: '2D',
          mapStyleId: 'style1', // 强制暗黑主题
          control: {
            zoom: false,
            rotation: false,
            scale: false
          }
        });
        (window as any).__map = map;

        (window as any).__trackLines = new TMap.MultiPolyline({
          map: map,
          styles: {
            rainbow_style: new TMap.PolylineStyle({
              width: 6,
              borderWidth: 1,
              lineCap: 'round'
            })
          }
        });

        (window as any).__vehicleMarker = new TMap.MultiMarker({
          map: map,
          styles: {
            car_icon: new TMap.MarkerStyle({
              width: 48,
              height: 48,
              anchor: { x: 24, y: 24 },
              src: generateCarMarkerIcon()
            })
          },
          geometries: [{ id: 'v1', styleId: 'car_icon', position: center, properties: { title: '8202G·开封旗舰机' } }]
        });

        (window as any).__fenceCircle = new TMap.MultiCircle({
          map: map,
          geometries: [{ center: center, radius: 1000, styleId: 'fence' }],
          styles: {
            fence: new TMap.CircleStyle({ color: 'rgba(0, 240, 255, 0.12)', showBorder: true, borderColor: '#00f0ff', borderWidth: 1.5 })
          }
        });
      }
    }
  } catch (e) {
    console.warn('Map error:', e);
  }

  // 从合宙官方网关拉取当前账号的真实设备清单
  refreshAccountStates();
  loadRealDevices();

  // 首次进入且所有账号都未授权时，主动弹出账号面板，让评审直接看到授权入口
  setTimeout(() => {
    const anyAuth = apiClient.getAccountStates().some((s: any) => s.hasAuth);
    if (!anyAuth) {
      const modal = document.getElementById('official-modal');
      if (modal) modal.classList.remove('hidden');
    }
    refreshIcons();
  }, 1500);

  initAccelChart();
  startCompassSimulator();
  setupSilkyTimelineInteractions();
  setupMobileSheetTouchGestures();
  switchMasterMode('live');

  setTimeout(() => {
    drawSpeedWaveCanvas();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }, 200);
});

onUnmounted(() => {
  if (compassTimer) clearInterval(compassTimer);
  if (playTimer) clearInterval(playTimer);
  if ((window as any).__map) {
    (window as any).__map.destroy();
    (window as any).__map = null;
  }
});
</script>

<style>
/* 全局暗黑背景覆盖 */
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: #030712 !important;
  overflow: hidden;
}
</style>
