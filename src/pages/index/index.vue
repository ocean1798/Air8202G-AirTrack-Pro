<template>
  <div class="relative w-screen h-screen overflow-hidden bg-cyber-950 text-slate-100 font-sans antialiased select-none">
    
    <!-- ==================== 1. 全域腾讯 WebGL 地图容器 / 小程序原生地图 ==================== -->
    <!-- #ifdef MP-WEIXIN -->
    <map
      id="main-map-wx"
      class="absolute inset-0 w-full h-full z-0"
      :latitude="wxMapCenter.lat"
      :longitude="wxMapCenter.lng"
      :scale="14"
      :markers="wxMarkers"
      :polyline="wxPolylines"
      :circles="wxCircles"
      :show-location="false"
      :enable-3D="false"
      :enable-overlooking="false"
      :enable-rotate="false"
      style="width: 100vw; height: 100vh;"
    ></map>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <div id="main-map" class="absolute inset-0 w-full h-full z-0 bg-cyber-950"></div>
    <!-- #endif -->

    <!-- 地图时空轨迹加载胶囊 (L3 悬浮态，声明 pointer-events-none 严禁阻断地图交互，与 Toast 及顶部状态栏错开) -->
    <transition name="fade">
      <div v-if="isTrackLoading" id="map-track-loading-capsule" class="fixed map-capsule-safe left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3.5 py-1.5 rounded-full glass-panel border border-cyan-400/40 bg-[#070d1d]/85 backdrop-blur-md shadow-[0_0_20px_rgba(0,240,255,0.25)] flex items-center space-x-2" :style="capsuleTopStyle">
        <svg class="w-3.5 h-3.5 animate-spin text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <span class="tracking-wide">正在同步时空轨迹...</span>
      </div>
    </transition>

    <!-- ==================== 2. 顶部轻量浮动 Bar (响应式双模严格隔离，移动端预留状态栏安全区) ==================== -->
    <header class="absolute mobile-safe-header left-2 right-2 md:left-3 md:right-3 z-30 pointer-events-none" :style="headerTopStyle">
      
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

        <!-- 移动端专享：设备刷新圆钮（常驻外侧，不随滑轨滚动，不被遮罩虚化） -->
        <div id="btn-refresh-devices-mobile"
             role="button"
             @click.stop="manualRefreshDevices"
             title="刷新设备状态"
             :class="['shrink-0 p-1.5 rounded-full border border-cyber-700/60 hover:border-cyber-primary text-slate-300 hover:text-cyber-primary bg-cyber-950/80 transition cursor-pointer mr-1', isDeviceRefreshing ? 'pointer-events-none opacity-80' : '']">
          <image :src="SVG_ICONS.refresh" class="w-3.5 h-3.5 transition-transform duration-300" :class="isDeviceRefreshing ? 'animate-spin' : ''" mode="aspectFit" />
        </div>

        <!-- 移动端专享：纯用户头像 (不带电话号码) -->
        <div id="btn-mobile-account" role="button" @click="toggleOfficialModal()" title="账号管理" class="shrink-0 relative group p-0.5 rounded-full border border-cyber-primary/50 shadow-glow-cyan hover:border-cyber-primary active:scale-95 transition-all bg-cyber-950/80">
          <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600/40 via-cyber-800 to-blue-600/50 flex items-center justify-center overflow-hidden border border-white/20">
            <image :src="SVG_ICONS.user" class="w-4 h-4" mode="aspectFit" />
          </div>
          <span class="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-cyber-emerald border-2 border-cyber-950"></span>
        </div>

      </div>

      <!-- 2.2 桌面 Web 端独占顶部 Bar (>= md 严格完整呈现) -->
      <div class="hidden md:flex items-center justify-between w-full pointer-events-none">
        
        <!-- 桌面端左侧：品牌标牌 (纯净专业，移除多余标签) -->
        <div class="glass-panel px-3.5 py-2 rounded-2xl flex items-center space-x-2.5 pointer-events-auto border border-cyber-700/60 shadow-lg">
          <div class="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500/30 to-blue-600/40 border border-cyber-primary/50 flex items-center justify-center shadow-glow-cyan">
            <i data-lucide="satellite" class="w-3.5 h-3.5 text-cyber-primary"></i>
          </div>
          <div class="flex items-center space-x-2">
            <span class="font-bold text-xs tracking-wider text-white">AirTrack Pro</span>
            <span class="text-[10px] text-slate-400 font-mono">通用IoT时空追踪平台</span>
          </div>
        </div>

        <!-- 桌面端右侧控制簇：完整工作空间号码 + Android客户端快捷下载 (移除错位按钮) -->
        <div class="flex items-center space-x-2 pointer-events-auto">
          
          <!-- 桌面独立守护站联机状态徽章 -->
          <div v-if="isStationConnected" id="station-status-badge" class="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs shadow-sm font-mono" title="AirTrack Desktop Station 本地守护中 (SQLite 存储 · 7×24h 围栏防护)">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="font-bold">守护站联机</span>
          </div>

          <!-- 桌面端：工作空间多账号切换胶囊 -->
          <div id="btn-account-switcher" role="button" @click="toggleOfficialModal()" title="切换IoT工作空间" class="glass-panel px-3 py-1.5 rounded-2xl text-xs font-mono text-cyber-primary border border-cyber-primary/40 hover:bg-cyber-primary/15 transition flex items-center space-x-1.5 shadow-glow-cyan">
            <span :class="activeAccountHasAuth ? 'w-1.5 h-1.5 rounded-full bg-cyber-primary animate-pulse-cyan' : 'w-1.5 h-1.5 rounded-full bg-amber-400'"></span>
            <span v-if="displayAccountLabel" class="text-slate-400">{{ displayAccountLabel }}:</span>
            <span class="font-bold text-white tracking-wider">{{ formatPhone(activeAccountPhone) }}</span>
            <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400"></i>
          </div>

          <!-- 桌面端 Android 手机 APP 下载引导入口 (双通道：扫码 + 电脑直下) -->
          <div class="relative">
            <div id="btn-app-download"
                 role="button"
                 @click.stop="toggleDownloadPopover()"
                 title="下载 Android 手机客户端"
                 class="glass-panel px-2.5 py-1.5 rounded-2xl text-xs font-medium text-slate-300 border border-cyber-700/60 hover:text-cyber-primary hover:border-cyber-primary transition flex items-center space-x-1.5 shadow-sm cursor-pointer">
              <i data-lucide="smartphone" class="w-3.5 h-3.5 text-cyber-primary"></i>
              <span class="font-sans">手机 App</span>
              <i data-lucide="download" class="w-3 h-3 text-slate-400"></i>
            </div>

            <!-- 呼出的 Popover 引导卡片 -->
            <div v-show="showDownloadPopover"
                 @click.stop
                 class="absolute top-11 right-0 w-64 glass-panel p-4 rounded-2xl border border-cyber-primary/50 shadow-glow-cyan z-50 flex flex-col space-y-3 bg-cyber-950/95 backdrop-blur-2xl">
              <div class="flex items-center justify-between pb-2 border-b border-white/10">
                <div class="flex items-center space-x-1.5">
                  <i data-lucide="smartphone" class="w-4 h-4 text-cyber-primary"></i>
                  <span class="text-xs font-bold text-white">Android 原生客户端</span>
                </div>
                <div class="flex items-center space-x-1.5">
                  <span class="text-[9px] font-mono text-cyber-emerald bg-cyber-emerald/10 border border-cyber-emerald/30 px-1 py-0.2 rounded">v1.0.2</span>
                  <div role="button" @click="showDownloadPopover = false" class="text-slate-400 hover:text-white p-0.5 cursor-pointer">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i>
                  </div>
                </div>
              </div>

              <!-- 通道一：手机扫码即刻安装 (100% 离线预生成内联 SVG 二维码) -->
              <div class="flex flex-col items-center justify-center p-2.5 rounded-xl bg-cyber-900/90 border border-cyber-700/50">
                <div class="w-32 h-32 rounded-lg bg-white p-1.5 shadow flex items-center justify-center">
                  <div v-html="OFFLINE_APK_QR_SVG" class="w-full h-full"></div>
                </div>
                <span class="text-[10px] text-slate-400 mt-2 font-mono flex items-center space-x-1">
                  <i data-lucide="scan" class="w-3 h-3 text-cyber-primary"></i>
                  <span>手机扫码直接安装 (4.2 MB)</span>
                </span>
              </div>

              <!-- 通道二：电脑直接下载文件 -->
              <a :href="APK_DOWNLOAD_URL"
                 download="airtrack-pro.apk"
                 target="_blank"
                 class="w-full py-2 rounded-xl text-xs font-bold bg-cyber-primary text-cyber-950 hover:bg-cyan-300 transition shadow-glow-cyan text-center flex items-center justify-center space-x-1.5 no-underline">
                <i data-lucide="download" class="w-3.5 h-3.5"></i>
                <span>电脑直接下载 APK</span>
              </a>

              <div class="text-[9px] text-slate-400 text-center font-mono">
                基于 Capacitor 8 原生打包 · 独立免守护站运行
              </div>
            </div>
          </div>

        </div>

      </div>
    </header>

    <!-- 桌面端独占：左侧设备列表展开悬浮把手 -->
    <div id="btn-dock-expand" role="button" @click="toggleDeviceDock()" title="展开设备列表" class="hidden fixed top-16 left-3 z-20 glass-panel p-2.5 rounded-2xl border border-cyber-700/60 text-slate-300 hover:text-cyber-primary hover:border-cyber-primary transition shadow-xl items-center justify-center cursor-pointer pointer-events-auto">
      <i data-lucide="layers" class="w-4 h-4"></i>
    </div>

    <!-- 桌面端独占：右侧设备详情展开悬浮把手 -->
    <div id="btn-inspector-expand" role="button" @click="toggleInspectorDrawer()" title="展开设备详情" class="hidden fixed top-16 right-3 z-20 glass-panel p-2.5 rounded-2xl border border-cyber-700/60 text-slate-300 hover:text-cyber-primary hover:border-cyber-primary transition shadow-xl items-center justify-center cursor-pointer pointer-events-auto">
      <i data-lucide="panel-right" class="w-4 h-4"></i>
    </div>

    <!-- ==================== 3. 桌面端独占：左侧在网设备泊位坞 (hidden md:flex) ==================== -->
    <aside id="device-dock" class="hidden md:flex drawer-transition fixed top-16 left-3 bottom-28 w-72 md:w-80 glass-panel rounded-2xl border border-cyber-700/60 z-20 flex-col pointer-events-auto shadow-2xl">
      <div class="p-3 border-b border-cyber-700/50 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <i data-lucide="navigation-2" class="w-3.5 h-3.5 text-cyber-primary"></i>
          <span class="text-xs font-bold text-slate-200">监控设备列表</span>
          <span class="text-[10px] font-mono text-slate-400 bg-cyber-900 px-1.5 py-0.2 rounded border border-cyber-700">共 {{ deviceList.length }} 台</span>
        </div>
        <div class="flex items-center space-x-1">
          <!-- 手动刷新按钮（统一使用 div role="button"，避免原生 button 样式污染） -->
          <div id="btn-refresh-devices"
               role="button"
               @click.stop="manualRefreshDevices"
               title="刷新设备列表与状态"
               :class="['p-1 rounded-lg text-slate-400 hover:text-cyber-primary hover:bg-cyber-primary/10 transition cursor-pointer', isDeviceRefreshing ? 'pointer-events-none opacity-80' : '']">
            <svg class="w-3.5 h-3.5 transition-transform duration-300"
                 :class="isDeviceRefreshing ? 'animate-spin text-cyber-primary' : ''"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 16H3v5"/>
            </svg>
          </div>
          <!-- 折叠收起按钮 -->
          <div role="button" @click="toggleDeviceDock()" id="btn-collapse-dock" title="收起设备列表" class="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer">
            <i data-lucide="chevron-left" class="w-4 h-4"></i>
          </div>
        </div>
      </div>

      <!-- 设备列表顶部的 1.5px 极简微光扫描条（刷新中呈现科技光流） -->
      <div v-if="isDeviceRefreshing" class="w-full h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse shadow-[0_0_8px_rgba(0,240,255,0.8)]"></div>

      <div class="flex-1 overflow-y-auto p-2 space-y-2 transition-opacity duration-300"
           :class="isDeviceRefreshing ? 'opacity-75' : ''"
           id="desktop-device-card-list">

        <!-- 当空列表且正在加载中时呈现的微光骨架屏 -->
        <div v-if="!deviceList.length && (deviceLoading || isDeviceRefreshing)" class="space-y-2 animate-pulse">
          <div v-for="i in 2" :key="i" class="p-2.5 rounded-xl bg-cyber-900/50 border border-cyber-700/40 space-y-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <div class="w-2 h-2 rounded-full bg-slate-700"></div>
                <div class="h-3 w-20 bg-slate-700 rounded"></div>
              </div>
              <div class="h-3 w-10 bg-slate-800 rounded"></div>
            </div>
            <div class="h-2 w-32 bg-slate-800 rounded"></div>
            <div class="h-2 w-24 bg-slate-800 rounded"></div>
          </div>
        </div>

        <div v-for="d in deviceList" :key="d.imei"
             @click="selectDeviceTab(d.imei)"
             :id="'card-desk-' + d.imei"
             :class="desktopCardClass(d)">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-1.5 flex-1 min-w-0 mr-1.5">
              <span :class="activeDeviceId === d.imei ? 'w-2 h-2 rounded-full bg-cyber-emerald animate-pulse-cyan shrink-0' : (d.online ? 'w-2 h-2 rounded-full bg-cyber-emerald shrink-0' : 'w-2 h-2 rounded-full bg-slate-500 shrink-0')"></span>
              
              <!-- 设备名称与快捷改名 -->
              <div v-if="editingDevImei === d.imei" class="flex items-center space-x-1 flex-1 min-w-0" @click.stop>
                <input :id="'edit-dev-input-' + d.imei"
                       v-model="editingDevName"
                       @keyup.enter="saveDeviceName(d.imei)"
                       @blur="saveDeviceName(d.imei)"
                       placeholder="输入设备名称..."
                       class="bg-cyber-950 border border-cyber-primary text-xs text-white px-1.5 py-0.5 rounded outline-none w-full font-sans" />
                <span role="button" @click.stop="saveDeviceName(d.imei)" class="text-cyber-primary text-xs cursor-pointer font-bold px-1 hover:text-cyan-300">✓</span>
              </div>
              <div v-else class="flex items-center space-x-1 truncate min-w-0 flex-1">
                <span :class="activeDeviceId === d.imei ? 'text-xs font-bold text-white truncate' : 'text-xs font-bold text-slate-300 truncate'">{{ d.name }}</span>
                <span role="button"
                      @click.stop="startEditDeviceName(d.imei, d.name, $event)"
                      title="修改设备名称/备注"
                      class="text-slate-500 hover:text-cyber-primary cursor-pointer transition p-0.5 shrink-0">
                  <i data-lucide="pencil" class="w-2.5 h-2.5"></i>
                </span>
              </div>
            </div>
            <span :class="d.online ? 'text-[9px] font-mono text-cyber-emerald bg-cyber-emerald/15 px-1.5 py-0.5 rounded border border-cyber-emerald/30 shrink-0' : 'text-[9px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded shrink-0'">
              {{ d.online ? '在线' : '离线' }}
            </span>
          </div>
          <!-- 第 2 行：IMEI 串号 -->
          <div :class="activeDeviceId === d.imei ? 'text-[10px] font-mono text-slate-400 mt-1' : 'text-[10px] font-mono text-slate-500 mt-1'">IMEI: {{ d.imei }}</div>

          <!-- 第 3 行：经纬度大地坐标（支持点击复制） -->
          <div class="flex items-center space-x-1 text-[10px] font-mono mt-0.5 text-slate-400 hover:text-cyan-300 cursor-pointer transition-colors"
               @click.stop="copyCoordToClipboard(d.coordText)"
               :title="'点击复制坐标: ' + (d.coordText || '暂无定位')">
            <span class="text-slate-500 shrink-0">📍</span>
            <span class="truncate font-sans select-all">{{ d.coordText || '暂无定位' }}</span>
          </div>

          <!-- 第 4 行：详细物理地址 -->
          <div class="flex items-center space-x-1 text-[10px] mt-0.5 truncate"
               :class="activeDeviceId === d.imei ? 'text-slate-300' : 'text-slate-400'"
               :title="d.address">
            <span class="text-slate-500 shrink-0">🏷️</span>
            <span class="truncate">{{ d.address || '未上报物理定位' }}</span>
          </div>
          
          <!-- 第 5 行：底栏状态条（电量百分比 · 信号等级 · 相对时间） -->
          <div class="mt-2 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
            <div class="flex items-center space-x-1.5 truncate mr-1.5">
              <span :class="d.battPct && d.battPct <= 20 ? 'text-rose-400 font-bold' : 'text-cyber-emerald font-bold'">
                🔋 {{ d.battPct != null ? `${d.battPct}%` : '—' }}
              </span>
              <span class="text-slate-600">·</span>
              <span :class="d.csq >= 12 ? 'text-cyan-300 font-bold' : (d.csq > 0 ? 'text-amber-300' : 'text-slate-500')">
                📶 {{ d.csq > 0 ? `${d.signalLevelText || '强'}（${d.csq}）` : '无信号' }}
              </span>
            </div>
            <span class="text-slate-400 shrink-0" :title="'最后上报绝对时间: ' + d.lastActiveTime">
              ⏱️ {{ d.relativeTime || '—' }}
            </span>
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

    <!-- ==================== 4. 移动端独占：右下角悬浮回正 FAB (< md，自适应底部安全区) ==================== -->
    <div class="md:hidden fixed right-3 z-30 transition-all duration-300 mobile-fab-safe pointer-events-auto">
      <div role="button" @click="recenterVehicle()" title="定位至当前设备" class="w-10 h-10 rounded-2xl glass-panel border border-cyber-primary/60 text-cyber-primary flex items-center justify-center shadow-fab-shadow hover:bg-cyber-primary/20 hover:scale-105 active:scale-90 transition-all backdrop-blur-xl group bg-cyber-900/90">
        <image :src="SVG_ICONS.crosshair" class="w-5 h-5 group-hover:rotate-45 transition-transform" mode="aspectFit" />
      </div>
    </div>

    <!-- ==================== 5. 核心：【双端双模感知面板】 ==================== -->
    <aside id="inspector-drawer" :class="'sheet-' + mobileSheetState" :style="drawerDynamicStyle" @touchstart="onSheetTouchStart" @touchend="onSheetTouchEnd" class="fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-cyber-700/80 glass-panel shadow-sheet-shadow flex flex-col drawer-transition md:fixed md:inset-x-auto md:top-16 md:right-3 md:bottom-28 md:w-80 md:lg:w-96 md:rounded-2xl md:border md:border-cyber-700/60 md:z-20 md:shadow-2xl md:h-auto md:max-h-none">
      
      <!-- 移动端把手 -->
      <div id="sheet-drag-handle" @click="cycleMobileSheet" class="w-full flex flex-col items-center pt-1.5 pb-0.5 cursor-pointer md:hidden active:opacity-75 touch-none">
        <div class="w-10 h-1 bg-slate-400/50 rounded-full hover:bg-cyber-primary transition-colors"></div>
      </div>

      <!-- 顶部固定设备概览头 -->
      <div id="sheet-header-bar" @click="cycleMobileSheet" class="px-3.5 py-2 border-b border-cyber-700/60 bg-cyber-900/95 flex items-center justify-between shrink-0 cursor-pointer md:cursor-default select-none">
        <div class="flex-1">
          <div class="flex items-center space-x-2">
            <span class="text-xs font-bold text-white tracking-wide truncate max-w-[140px] sm:max-w-none" id="drawer-vehicle-name">{{ activeDeviceId ? (activeDeviceName || activeDeviceId) : '等待选择设备' }}</span>
            <span :class="['text-[9px] font-mono px-1.5 py-0.2 rounded border transition-colors', activeDeviceId ? 'text-cyber-primary bg-cyber-primary/10 border-cyber-primary/30' : 'text-slate-400 bg-slate-800/40 border-slate-700/50']" id="drawer-gnss-badge">{{ activeTelemetry.gnssBadgeText }}</span>
          </div>
          <div class="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center space-x-1.5 leading-tight">
            <span id="drawer-coord-text" class="truncate max-w-[150px] sm:max-w-none">{{ activeTelemetry.coordsText }}</span>
            <span :class="['font-bold px-1.5 py-0.2 rounded text-[10px] border transition-colors', activeDeviceId ? 'text-cyber-primary bg-cyber-primary/10 border-cyber-primary/30' : 'text-slate-500 bg-slate-800/20 border-slate-800/50']" id="drawer-speed-badge" :style="{ color: activeTelemetry.speedColor }">{{ activeTelemetry.speedText }}</span>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <div role="button" id="btn-sheet-chevron" class="md:hidden p-1 text-slate-400 hover:text-white transition-transform">
            <image :src="SVG_ICONS.chevronUp" :class="['w-4 h-4 transition-transform', mobileSheetState !== 'peek' ? 'rotate-180' : '']" mode="aspectFit" />
          </div>

          <!-- 桌面端独占收起按钮 -->
          <div role="button" @click="toggleInspectorDrawer()" id="btn-collapse-inspector" title="收起设备详情" class="hidden md:flex p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer">
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </div>
        </div>
      </div>

      <!-- 纵向平铺流式内容体：纯净真实的设备物理遥测看板 -->
      <div class="flex-1 overflow-y-auto p-3 space-y-3 scroll-smooth overscroll-contain">
        
        <!-- 遥测模块 1 · 物理空间定位状态 -->
        <section class="glass-panel p-3 rounded-xl border border-cyber-primary/30 space-y-2 shadow-lg transition-opacity duration-300"
                 :class="isInspectorLoading ? 'animate-pulse opacity-75' : ''">
          <div class="flex items-center justify-between text-[11px] pb-1.5 border-b border-white/10">
            <span class="text-slate-200 font-bold flex items-center space-x-1.5">
              <i data-lucide="map-pin" class="w-3.5 h-3.5 text-cyber-primary"></i>
              <span>物理时空定位 (GNSS / LBS)</span>
            </span>
            <span class="text-[9px] font-mono text-cyber-primary bg-cyber-primary/10 px-1.5 py-0.5 rounded border border-cyber-primary/30">真实数据</span>
          </div>

          <div class="space-y-1.5 font-mono text-[11px]">
            <div class="flex items-start justify-between">
              <span class="text-slate-400 shrink-0">物理地址:</span>
              <span class="text-slate-200 text-right font-sans break-all ml-2" id="drawer-address-text">{{ activeTelemetry.addressText }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">大地坐标:</span>
              <span class="text-slate-200" id="drawer-coord-detail">{{ activeTelemetry.coordsText }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">实时航速:</span>
              <span class="text-cyber-primary font-bold" id="drawer-speed-detail">{{ activeTelemetry.speedText }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">最后上报时间:</span>
              <span class="text-slate-200" id="tel-tag-last-time">{{ activeTelemetry.lastActiveText }}</span>
            </div>
          </div>
        </section>

        <!-- 遥测模块 2 · 硬件供电与射频状态 -->
        <section class="glass-panel rounded-xl overflow-hidden border border-cyber-700/60 shadow-lg transition-opacity duration-300"
                 :class="isInspectorLoading ? 'animate-pulse opacity-75' : ''">
          <div class="p-2.5 bg-cyber-900/90 border-b border-cyber-700/50 flex items-center justify-between text-[11px]">
            <span class="text-slate-200 font-bold flex items-center space-x-1.5">
              <i data-lucide="cpu" class="w-3.5 h-3.5 text-cyber-primary"></i>
              <span>硬件遥测参数 (Telemetry Tags)</span>
            </span>
            <span class="text-[9px] font-mono text-cyber-emerald">数据已同步</span>
          </div>
          <div class="font-mono text-[11px] divide-y divide-cyber-700/40">
            <div class="p-2.5 flex items-center justify-between">
              <span class="text-slate-400">Tag 799 (电池供电)</span>
              <span class="text-cyber-emerald font-bold" id="tel-tag-batt">{{ activeTelemetry.battText }}</span>
            </div>
            <div class="p-2.5 flex items-center justify-between">
              <span class="text-slate-400">Tag 782 (蜂窝信号)</span>
              <span class="text-cyan-300 font-bold" id="tel-tag-csq">{{ activeTelemetry.csqText }}</span>
            </div>
            <div class="p-2.5 flex items-center justify-between">
              <span class="text-slate-400">Tag 512/513 (定位源)</span>
              <span class="text-slate-200" id="tel-tag-coords">{{ activeTelemetry.coordsText }}</span>
            </div>
            <div class="p-2.5 flex items-center justify-between">
              <span class="text-slate-400">Tag 514 (行驶航速)</span>
              <span class="text-cyber-emerald font-bold" id="tel-tag-speed">{{ activeTelemetry.speedText }}</span>
            </div>
          </div>
        </section>

        <!-- 遥测模块 3 · 设备硬件与空间归属 -->
        <section class="glass-panel p-3 rounded-xl border border-cyber-700/60 space-y-2 shadow-lg text-[11px] font-mono">
          <div class="flex items-center justify-between text-xs pb-1 border-b border-white/5">
            <span class="text-slate-200 font-bold flex items-center space-x-1.5">
              <i data-lucide="info" class="w-3.5 h-3.5 text-slate-400"></i>
              <span>设备资产属性</span>
            </span>
            <span class="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">4G Cat.1 + GNSS</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">硬件型号:</span>
            <span class="text-slate-200">合宙 Air8202G</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">模组串号 (IMEI):</span>
            <span class="text-slate-200">{{ activeDeviceId || '—' }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-400">当前归属账号:</span>
            <span class="text-slate-200">{{ formatPhone(activeAccountPhone) }}</span>
          </div>
        </section>

        <!-- 底部防遮挡垫片 -->
        <div class="h-6"></div>
      </div>
    </aside>

    <!-- ==================== 6. 底部核心：【双端自适应时间轴控制台】 ==================== -->
    <div id="timeline-hud-wrapper" class="timeline-hud-safe left-2 right-2 z-20 flex flex-col items-center pointer-events-none transition-all duration-300 md:left-3 md:right-3 md:max-w-5xl md:mx-auto">
      
      <!-- 6.A 桌面端独占：外置悬浮设备定位按钮（右上角外挂，不挤压时间轴内部空间，保持地图穿透） -->
      <div class="hidden md:flex absolute -top-10 right-0 pointer-events-auto z-20">
        <div id="btn-recenter-float"
             role="button"
             @click="recenterVehicle()"
             title="视口居中到当前设备"
             class="glass-panel px-3 py-1.5 rounded-xl text-xs font-medium text-cyber-primary border border-cyber-primary/40 hover:bg-cyber-primary/20 hover:border-cyber-primary active:scale-95 transition flex items-center space-x-1.5 shadow-glow-cyan backdrop-blur-md cursor-pointer bg-cyber-950/90">
          <i data-lucide="crosshair" class="w-3.5 h-3.5 text-cyber-primary"></i>
          <span class="tracking-wide font-sans">设备定位</span>
        </div>
      </div>
      
      <!-- 6.0 宏观历史跨度配置弹层 (0018 极简轻量直达面板) -->
      <div id="date-range-popover" class="w-full max-w-md glass-panel p-3 sm:p-3.5 rounded-2xl border border-cyber-primary/40 shadow-popover-shadow mb-2 hidden pointer-events-auto transition-all backdrop-blur-2xl bg-cyber-950/95">
        <div class="flex items-center justify-between pb-2 border-b border-white/10">
          <div class="flex items-center space-x-1.5 text-xs font-bold text-white">
            <i data-lucide="calendar-range" class="w-3.5 h-3.5 text-cyber-primary"></i>
            <span>时间段筛选 (点选即生效)</span>
          </div>
          <div role="button" @click="toggleDateRangePopover()" class="text-slate-400 hover:text-white p-1 cursor-pointer">
            <i data-lucide="x" class="w-4 h-4"></i>
          </div>
        </div>

        <div class="mt-2">
          <div class="grid grid-cols-3 sm:grid-cols-6 gap-1 text-[11px] font-mono">
            <div role="button" @click="selectMacroPreset('today')" id="macro-btn-today" class="macro-chip py-1 text-center rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-cyber-primary/60 hover:text-white transition cursor-pointer active:scale-95">今日</div>
            <div role="button" @click="selectMacroPreset('yesterday')" id="macro-btn-yesterday" class="macro-chip py-1 text-center rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-cyber-primary/60 hover:text-white transition cursor-pointer active:scale-95">昨日</div>
            <div role="button" @click="selectMacroPreset('3d')" id="macro-btn-3d" class="macro-chip py-1 text-center rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-cyber-primary/60 hover:text-white transition cursor-pointer active:scale-95">近3天</div>
            <div role="button" @click="selectMacroPreset('7d')" id="macro-btn-7d" class="macro-chip py-1 text-center rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-cyber-primary/60 hover:text-white transition cursor-pointer active:scale-95">近7天</div>
            <div role="button" @click="selectMacroPreset('30d')" id="macro-btn-30d" class="macro-chip py-1 text-center rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-cyber-primary/60 hover:text-white transition cursor-pointer active:scale-95">近30天</div>
            <div role="button" @click="selectMacroPreset('90d')" id="macro-btn-90d" class="macro-chip py-1 text-center rounded-lg bg-cyber-primary/20 text-cyber-primary border border-cyber-primary/40 font-bold transition cursor-pointer active:scale-95">近90天</div>
          </div>
        </div>

        <div class="mt-2 pt-2 border-t border-white/10 flex items-center justify-between gap-1.5 text-xs font-mono">
          <div class="flex items-center space-x-1 text-[10px] sm:text-[11px]">
            <span class="text-slate-400 text-[10px]">自定义:</span>
            <input type="date" v-model="customDateStart" id="input-date-start" class="bg-cyber-900 border border-cyber-700/80 rounded px-1.5 py-0.5 text-slate-200 text-[10px] focus:border-cyber-primary focus:outline-none">
            <span class="text-slate-500">-</span>
            <input type="date" v-model="customDateEnd" id="input-date-end" class="bg-cyber-900 border border-cyber-700/80 rounded px-1.5 py-0.5 text-slate-200 text-[10px] focus:border-cyber-primary focus:outline-none">
          </div>
          <div role="button" id="btn-apply-custom-range" @click="applyCustomDateRange()" class="px-2.5 py-1 rounded-lg bg-cyber-primary/20 border border-cyber-primary/50 text-cyan-300 font-bold text-[10px] hover:bg-cyber-primary hover:text-cyber-950 transition shadow-glow-cyan flex items-center space-x-1 cursor-pointer active:scale-95">
            <span>应用</span>
          </div>
        </div>
      </div>

      <!-- 6.1 超薄一体化控制容器 (高度 74px) -->
      <div id="timeline-hud-capsule" class="w-full glass-panel px-3 py-2 rounded-2xl flex flex-col pointer-events-auto border border-white/10 shadow-2xl space-y-1.5 bg-gradient-to-b from-cyber-900/95 via-cyber-900/90 to-cyber-950/95">
        
        <!-- 纯净速度山脉轨道区 -->
        <div class="relative w-full">
          
          <div id="timeline-track-container" class="relative w-full h-9 sm:h-10 bg-cyber-950 rounded-xl border border-white/10 overflow-visible cursor-crosshair flex items-center shadow-inner touch-none">
            <!-- 静态科技感微光与空态提示（消除纯黑长条的空洞感） -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-70">
              <span class="text-[10px] font-mono text-cyan-400/80 tracking-widest flex items-center space-x-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                <span>{{ activeDeviceId ? '时空轨迹就绪' : '等待接入时空轨迹点位' }}</span>
              </span>
            </div>
            <!-- 静态科技网格呼吸基准线 -->
            <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent pointer-events-none z-0"></div>
            <!-- 静态呼吸基线（无轨迹点位时提供静态科技微芒，消除全黑空洞感） -->
            <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[1.5px] bg-gradient-to-r from-transparent via-cyan-500/35 to-transparent pointer-events-none z-0"></div>
            
            <canvas id="speed-wave-canvas" canvas-id="speed-wave-canvas" class="absolute inset-0 w-full h-full rounded-xl pointer-events-none"></canvas>

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
            <span id="scale-tick-start">{{ timelineDisplay.scaleTicks[0] }}</span>
            <span id="scale-tick-1">{{ timelineDisplay.scaleTicks[1] }}</span>
            <span id="scale-tick-2" class="hidden sm:inline">{{ timelineDisplay.scaleTicks[2] }}</span>
            <span id="scale-tick-3">{{ timelineDisplay.scaleTicks[3] }}</span>
            <span id="scale-tick-end" class="text-cyber-primary font-bold flex items-center space-x-1">
              <span>{{ timelineDisplay.scaleTicks[4] }}</span>
              <span class="w-1 h-1 rounded-full bg-cyber-primary animate-pulse-cyan"></span>
            </span>
          </div>

        </div>

        <!-- 单行一体化流线工具条 -->
        <div class="flex items-center justify-between flex-wrap gap-1.5 pt-1 border-t border-white/5 text-xs font-mono">
          
          <div class="flex items-center space-x-1.5">
            <!-- 模式切换器 -->
            <div class="flex items-center bg-cyber-950/90 rounded-xl border border-white/10 p-0.5 shadow-inner">
              <div role="button" @click="switchMasterMode('live')" id="btn-mode-live" class="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-bold text-cyber-primary bg-cyber-primary/15 border border-cyber-primary/30 transition-all flex items-center space-x-1 shadow-glow-cyan">
                <span class="w-1.5 h-1.5 rounded-full bg-cyber-emerald animate-pulse-cyan"></span>
                <span>跟随最新</span>
              </div>
              <div role="button" @click="switchMasterMode('range')" id="btn-mode-range" class="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-[11px] font-medium text-slate-400 hover:text-white transition-all flex items-center space-x-1 cursor-pointer">
                <image :src="SVG_ICONS.sliders" class="w-3.5 h-3.5" mode="aspectFit" />
                <span>区间回放</span>
              </div>
              
              <div id="macro-date-divider" class="h-3.5 w-px bg-white/10 mx-1 hidden"></div>
              
              <div role="button" @click="toggleDateRangePopover()" id="btn-date-trigger" class="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-[11px] text-slate-200 hover:text-cyber-primary transition flex items-center space-x-1 group hidden">
                <image :src="SVG_ICONS.calendar" class="w-3.5 h-3.5" mode="aspectFit" />
                <span id="current-range-label" class="font-bold truncate max-w-[70px] sm:max-w-none">{{ timelineDisplay.currentRangeLabel }}</span>
                <image :src="SVG_ICONS.chevronDown" class="w-2.5 h-2.5" mode="aspectFit" /></div>
            </div>
          </div>

          <!-- 播放控制簇 (区间回放模式独占，彻底移除无用快速回放按钮) -->
          <div id="unified-play-cluster" class="flex items-center gap-1.5 hidden">
            <div class="flex items-center bg-cyber-950/90 p-0.5 rounded-xl border border-white/10 gap-1">
              <div role="button" @click="toggleRangePlay()" id="btn-range-play" class="px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 hover:brightness-110 transition flex items-center gap-1 shadow-glow-emerald cursor-pointer active:scale-95">
                <image :src="isPlayingState ? SVG_ICONS.pause : SVG_ICONS.play" class="w-3.5 h-3.5" mode="aspectFit" />
                <span id="txt-range-play">{{ isPlayingState ? '暂停' : '播放' }}</span>
              </div>
              <div role="button" @click="setPlaySpeed(1, $event)" class="speed-btn px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] bg-cyber-primary/20 text-cyber-primary font-bold">1x</div>
              <div role="button" @click="setPlaySpeed(5, $event)" class="speed-btn px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] text-slate-400 hover:text-white">5x</div>
            </div>
          </div>

          <!-- 状态呈现区：包含明确颜色指示与三态图例 -->
          <div class="flex items-center space-x-2 text-[10px] sm:text-[11px]">
            
            <div id="live-status-bar" class="flex items-center space-x-1.5 sm:space-x-2">
              <div class="flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border border-cyber-700/60 bg-cyber-950/80" id="live-state-badge">
                <span class="w-2 h-2 rounded-full bg-cyber-emerald animate-pulse-cyan" id="live-state-dot"></span>
                <span id="live-state-text" class="text-white font-bold">{{ timelineDisplay.liveStateText }}</span>
              </div>
              <span id="live-latest-time" class="text-slate-300 font-mono hidden sm:inline">{{ timelineDisplay.liveLatestTime }}</span>
              <span id="live-latest-speed" class="text-cyber-primary font-bold font-mono" :style="{ color: timelineDisplay.speedTagColor }">{{ timelineDisplay.liveLatestSpeed }}</span>

              <div id="btn-live-snap" role="button" @click="snapToLatestRealtime()" class="hidden px-2 py-0.5 rounded-md bg-cyber-primary/20 border border-cyber-primary/50 text-cyan-300 text-[9px] font-bold hover:bg-cyber-primary/30 transition flex items-center space-x-1 cursor-pointer active:scale-95">
                <span class="w-1.5 h-1.5 rounded-full bg-cyber-primary animate-pulse"></span>
                <span>回到实时</span>
              </div>

              <!-- 状态三色图例指示 (与时间轴及地图颜色完全对齐) -->
              <div class="hidden lg:flex items-center space-x-2 pl-2 border-l border-white/10 text-[9px] text-slate-400 font-sans">
                <span class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-cyber-emerald"></span><span>移动</span></span>
                <span class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span><span>静止</span></span>
                <span class="flex items-center space-x-1"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span><span>离线/盲区</span></span>
              </div>
            </div>

            <div id="range-status-bar" class="flex items-center space-x-1 sm:space-x-2 hidden">
              <div class="flex items-center space-x-1.5">
                <span id="current-point-time" class="text-white font-bold font-mono">—</span>
                <span id="current-speed-tag" class="px-1.5 py-0.2 rounded text-[9px] font-bold border transition-all">
                  0.0 km/h
                </span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>

    <!-- ==================== 7. 账号管理弹窗 (规范锁定版本：极简纯净 / Radio单选 / 串行探活) ==================== -->
    <div id="official-modal" v-if="showAccountModal" class="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4" @click="toggleOfficialModal(false)">
      <div class="glass-panel max-w-md w-full rounded-2xl shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden border border-white/10 bg-[#0b1426]/95" @click.stop>
        
        <!-- 1. 顶部 Header (固定吸顶) -->
        <div class="p-5 pb-3 border-b border-white/10 shrink-0 relative bg-[#070d1d]/60">
          <div role="button" id="btn-close-official-modal" @click.stop="toggleOfficialModal(false)" title="关闭" class="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer flex items-center justify-center w-7 h-7">
            <span class="text-sm font-bold leading-none">✕</span>
          </div>

          <div class="flex items-center space-x-2">
            <h3 class="text-base font-bold text-white tracking-wide">账号管理</h3>
            <span :class="isProbing ? 'opacity-100' : 'opacity-0'" class="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 flex items-center space-x-1 transition-opacity">
              <i data-lucide="loader" class="w-2.5 h-2.5 animate-spin"></i>
              <span>探针同步中...</span>
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-0.5">切换已登录账号，或登录新账号接入设备</p>
        </div>

        <!-- 2. 中部账号平铺列表 (滚动容器) -->
        <div class="p-5 py-3 overflow-y-auto space-y-2.5 custom-scrollbar flex-1">
          <!-- 零账号空状态 -->
          <div v-if="accountStates.length === 0" class="py-12 text-center text-slate-500 text-xs font-mono">
            <image :src="SVG_ICONS.userX" class="w-8 h-8 mx-auto mb-2" mode="aspectFit" />
            暂无已登录账号，请点击下方登录
          </div>

          <!-- 账号卡片循环 -->
          <div v-for="s in accountStates" :key="s.account.phone"
               role="button"
               @click="switchAccount(s.account.phone)"
               :class="s.active
                 ? 'p-3.5 rounded-xl border border-cyan-400/70 bg-cyan-500/10 shadow-[0_0_20px_-2px_rgba(0,240,255,0.35)] cursor-pointer transition-all'
                 : (s.isExpired
                     ? 'p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50 cursor-pointer transition-all'
                     : 'p-3.5 rounded-xl border border-white/5 bg-[#070d1d]/40 hover:border-white/20 cursor-pointer transition-all')">
            
            <!-- 上行：单选圈 + 手机号 + 当前账号标 + 设备数 -->
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2.5">
                <div :class="s.active ? 'w-4 h-4 rounded-full border-2 border-cyan-400 flex items-center justify-center shrink-0' : 'w-4 h-4 rounded-full border border-slate-600 shrink-0'">
                  <div v-if="s.active" class="w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
                </div>
                <span class="text-sm font-bold font-mono text-white tracking-wide">{{ formatPhone(s.account.phone) }}</span>
                <span v-if="s.active" class="text-[10px] px-1.5 py-0.2 rounded bg-cyan-400/20 text-cyan-300 font-mono font-medium border border-cyan-400/30">
                  当前账号
                </span>
              </div>
              <span class="text-xs font-mono text-slate-300 bg-[#030712] px-2 py-0.5 rounded border border-white/5 flex items-center space-x-1">
                <span v-if="s.deviceCount !== undefined">{{ s.deviceCount }} 台设备</span>
                <span v-else class="text-cyan-400 flex items-center space-x-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span>检测中...</span>
                </span>
              </span>
            </div>

            <!-- 下行：凭据状态 + 刷新凭据/移除 -->
            <div class="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-xs font-mono">
              <span :class="s.isExpired ? 'text-rose-400 font-bold flex items-center space-x-1.5' : 'text-emerald-400 flex items-center space-x-1.5'">
                <span :class="s.isExpired ? 'w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse' : 'w-1.5 h-1.5 rounded-full bg-emerald-400'"></span>
                <span class="text-[11px]">{{ (Boolean(checkingPhone) && checkingPhone === s.account.phone) ? '检测中...' : (s.isExpired ? '凭据过期' : '正常') }}</span>
              </span>

              <div class="flex items-center space-x-1.5" @click.stop>
                <button @click="onRefreshAccountCredential(s.account.phone, s.isExpired)"
                        :class="[
                          s.isExpired
                            ? 'px-2.5 py-1 rounded-lg text-xs font-sans font-bold bg-cyan-400 text-slate-950 hover:bg-cyan-300 transition shadow-[0_0_10px_-1px_rgba(0,240,255,0.45)] flex items-center space-x-1 cursor-pointer'
                            : 'px-2.5 py-1 rounded-lg text-xs font-sans text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition flex items-center space-x-1 cursor-pointer',
                          (Boolean(checkingPhone) && checkingPhone === s.account.phone) ? 'pointer-events-none opacity-80' : ''
                        ]">
                  <svg class="w-3 h-3 transition-transform duration-300"
                       :class="(Boolean(checkingPhone) && checkingPhone === s.account.phone) ? 'animate-spin text-cyan-400' : ''"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M8 16H3v5"/>
                  </svg>
                  <span>{{ (Boolean(checkingPhone) && checkingPhone === s.account.phone) ? '刷新中' : '刷新凭据' }}</span>
                </button>
                <button @click.stop="onRemoveAccount(s.account.phone)" :title="s.active ? '退出并解绑此账号' : '从本机移除此账号'" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 border border-white/10 transition cursor-pointer flex items-center justify-center shrink-0 active:scale-95">
                  <image :src="SVG_ICONS.trash" class="w-3.5 h-3.5" mode="aspectFit" />
                </button>
              </div>
            </div>

          </div>
        </div>

        <!-- 3. 底部通栏主操作 (固定吸底 Sticky Footer) -->
        <div class="p-4 pt-3 border-t border-white/10 shrink-0 bg-[#070d1d]/60 space-y-2">
          <button id="btn-login-new-account" @click.stop="openOAuthAuthorization()" class="w-full py-2.5 rounded-xl text-xs font-bold bg-cyan-400 text-slate-950 hover:bg-cyan-300 transition flex items-center justify-center space-x-1.5 shadow-[0_0_20px_-2px_rgba(0,240,255,0.35)] cursor-pointer active:scale-98">
            <image :src="SVG_ICONS.plus" class="w-4 h-4" mode="aspectFit" />
            <span>登录新账号 (官方授权)</span>
          </button>

          <!-- 备用通道：手动粘贴 Token 换票 (防个别 ROM 拦截自定义协议唤醒) -->
          <div class="pt-0.5">
            <div id="btn-manual-token-toggle" v-if="!showManualTokenInput" @click.stop="showManualTokenInput = true; nextTick(refreshIcons)" role="button" class="text-[11px] text-slate-400 hover:text-cyan-300 text-center cursor-pointer transition flex items-center justify-center space-x-1 py-1">
              <image :src="SVG_ICONS.keyRound" class="w-3 h-3" mode="aspectFit" />
              <span>无法自动跳转？点击手动粘贴 Token 换票</span>
            </div>
            <div v-else class="space-y-1.5 p-2.5 rounded-xl bg-cyber-900/90 border border-cyber-700/60 shadow-inner">
              <div class="flex items-center justify-between text-[11px] text-slate-300">
                <span class="flex items-center space-x-1">
                  <i data-lucide="shield-check" class="w-3 h-3 text-cyan-400"></i>
                  <span>手动粘贴 Token / 回调链接</span>
                </span>
                <span @click="showManualTokenInput = false" role="button" class="text-slate-400 hover:text-white cursor-pointer px-1">取消</span>
              </div>
              <div class="flex space-x-1.5">
                <input
                  v-model="manualTokenText"
                  type="text"
                  placeholder="粘贴 Token 或完整回调 URL..."
                  class="flex-1 px-2.5 py-1.5 rounded-lg bg-cyber-950 border border-cyber-700/80 text-white font-mono text-[11px] focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  @click="readFromClipboard()"
                  class="px-2 py-1.5 rounded-lg bg-cyber-800/90 border border-cyan-500/50 text-cyan-300 text-[11px] font-medium hover:bg-cyber-700 transition shrink-0 cursor-pointer active:scale-95"
                >
                  一键粘贴
                </button>
                <button
                  id="btn-apply-manual-token"
                  @click="applyManualToken()"
                  :disabled="isExchangingManualToken"
                  class="px-3 py-1.5 rounded-lg bg-cyan-400 text-slate-950 text-[11px] font-bold hover:bg-cyan-300 transition shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {{ isExchangingManualToken ? '换票中...' : '兑换' }}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ==================== 8. 站内沉浸式官方安全授权浮层 (零跳转闭环) ==================== -->
    <div v-if="showInPageOAuthModal" class="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4 animate-fade-in" @click.self="closeInPageOAuth()">
      <div class="glass-panel w-full max-w-md rounded-2xl border border-cyber-primary/50 shadow-2xl shadow-cyan-950/60 overflow-hidden flex flex-col bg-cyber-950">
        <!-- 浮层顶栏 -->
        <div class="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-cyber-900/80">
          <div class="flex items-center space-x-2">
            <div class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
            <span class="text-xs font-bold tracking-wider text-slate-100">合宙官方安全授权通道</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">应用内登录</span>
          </div>
          <div class="flex items-center space-x-2">
            <a :href="inPageOAuthUrl" target="_blank" title="在外部独立浏览器标签页打开" class="text-slate-400 hover:text-cyan-400 text-xs flex items-center space-x-0.5 no-underline">
              <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            </a>
            <div role="button" id="btn-close-inpage-oauth" @click="closeInPageOAuth()" class="text-slate-400 hover:text-white p-1 cursor-pointer">
              <i data-lucide="x" class="w-4 h-4"></i>
            </div>
          </div>
        </div>

        <!-- 提示小副条 -->
        <div class="px-4 py-1.5 bg-cyber-900/40 border-b border-white/5 text-[10px] text-slate-400 flex items-center justify-between">
          <span>输入账号密码与验证码后将自动收起，当前页面不刷新</span>
          <span class="font-mono text-cyan-400">OAuth v2</span>
        </div>

        <!-- iframe 嵌入容器 -->
        <div class="relative w-full h-[540px] bg-white">
          <div v-if="isIframeLoading" class="absolute inset-0 bg-cyber-950 flex flex-col items-center justify-center space-y-3 z-10">
            <div class="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin"></div>
            <div class="text-xs text-slate-400 font-mono">正在载入合宙安全授权通道...</div>
          </div>
          <iframe
            :src="inPageOAuthUrl"
            class="w-full h-full border-0"
            @load="isIframeLoading = false; refreshIcons();"
            sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
          ></iframe>
        </div>
      </div>
    </div>

    <!-- 微信小程序端 OAuth 步骤向导悬浮层 -->
    <!-- #ifdef MP-WEIXIN -->
    <div v-if="showMpOAuthGuide" class="fixed inset-0 bg-black/85 backdrop-blur-md z-[130] flex items-center justify-center p-4">
      <div class="relative w-full max-w-sm bg-slate-900 border border-cyan-500/40 rounded-2xl p-5 shadow-2xl space-y-4 text-center max-h-[85vh] overflow-y-auto">
        <!-- 右上角显式 ✕ 关闭按钮 -->
        <button @click="closeMpOAuthGuide()" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm transition z-10">
          ✕
        </button>

        <div class="w-12 h-12 mx-auto rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 text-xl font-bold">
          ⚡
        </div>
        <div>
          <h3 class="text-sm font-bold text-white">官方授权向导已开启</h3>
          <p class="text-xs text-slate-400 mt-1 leading-relaxed">
            授权链接已自动复制到剪贴板！请按以下指引极速接入：
          </p>
        </div>
        <div class="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-left text-xs text-slate-300 space-y-1.5 leading-normal">
          <p><span class="text-cyan-400 font-bold">第 1 步：</span>切至手机浏览器，在地址栏粘贴并打开；</p>
          <p><span class="text-cyan-400 font-bold">第 2 步：</span>登录合宙账号并点击授权；</p>
          <p><span class="text-cyan-400 font-bold">第 3 步：</span>在成功页面点击【一键复制 Token】；</p>
          <p><span class="text-cyan-400 font-bold">第 4 步：</span>切回本小程序，点击下方【立即粘贴】验证！</p>
        </div>

        <!-- 手动输入框展开模式（双保险兜底） -->
        <div v-if="showMpManualInput" class="bg-slate-950/90 p-3 rounded-xl border border-cyan-500/30 text-left space-y-2">
          <div class="text-[11px] text-cyan-300 font-medium">长按下方输入框粘贴 Token：</div>
          <input
            v-model="mpManualTokenText"
            type="text"
            placeholder="在此长按粘贴 Token 字符串"
            class="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
          />
          <button
            @click="submitTokenForExchange()"
            :disabled="isMpExchangingToken || !mpManualTokenText.trim()"
            class="w-full py-2 rounded-lg text-xs font-bold bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:opacity-50 transition"
          >
            {{ isMpExchangingToken ? '正在接入...' : '确定接入' }}
          </button>
        </div>

        <!-- 底部主辅操作栏 -->
        <div class="pt-1 flex gap-2">
          <button @click="openOAuthAuthorization()" class="flex-1 py-2.5 rounded-xl text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition">
            重新复制链接
          </button>
          <button
            @click="handleMpPasteAndExchange()"
            :disabled="isMpExchangingToken"
            class="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 hover:from-cyan-300 hover:to-emerald-300 disabled:opacity-50 transition flex items-center justify-center space-x-1 shadow-lg shadow-cyan-950/40"
          >
            <span>{{ isMpExchangingToken ? '正在接入...' : '📋 我已复制，立即粘贴' }}</span>
          </button>
        </div>
      </div>
    </div>
    <!-- #endif -->

    <!-- ==================== 9. 全局悬浮通知 Toast (自适应状态栏安全区) ==================== -->
    <transition name="fade">
      <div v-if="toastMessage" class="fixed toast-safe left-1/2 -translate-x-1/2 z-[110] px-4 py-2 rounded-xl backdrop-blur-md shadow-2xl flex items-center space-x-2 text-xs font-mono border transition-all"
        :class="toastType === 'success' ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300' : (toastType === 'info' ? 'bg-cyan-950/90 border-cyan-500/50 text-cyan-300' : (toastType === 'warn' ? 'bg-amber-950/90 border-amber-500/50 text-amber-300 shadow-[0_0_15px_-3px_rgba(245,158,11,0.3)]' : 'bg-rose-950/90 border-rose-500/50 text-rose-300'))">
        <i :data-lucide="toastType === 'success' ? 'check-circle' : (toastType === 'info' ? 'info' : (toastType === 'warn' ? 'alert-triangle' : 'alert-circle'))" class="w-4 h-4 shrink-0"></i>
        <span>{{ toastMessage }}</span>
      </div>
    </transition>

  </div>
</template>

<script setup lang="ts">
// #ifdef MP-WEIXIN
// 微信小程序 JSCore 沙箱环境下，模块包装器传入的 window/document 为 undefined
// 此处定义模块作用域安全桩，彻底杜绝 DOM/BOM 访问抛错
const noop = () => {};
const dummyElem: any = {
  innerText: '',
  innerHTML: '',
  value: '',
  style: {},
  dataset: {},
  classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
  setAttribute: noop,
  getAttribute: () => '',
  removeAttribute: noop,
  addEventListener: noop,
  removeEventListener: noop,
  focus: noop,
  blur: noop,
  scrollIntoView: noop,
  closest: () => null,
  querySelector: () => dummyElem,
  querySelectorAll: () => [],
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 375, height: 40, right: 375, bottom: 40 }),
  getContext: () => null
};
let document: any = {
  getElementById: () => dummyElem,
  querySelector: () => dummyElem,
  querySelectorAll: () => [],
  createElement: () => dummyElem,
  addEventListener: noop,
  removeEventListener: noop,
  body: dummyElem,
  title: 'AirTrack Pro'
};
let window: any = {
  innerWidth: 375,
  innerHeight: 812,
  devicePixelRatio: 2,
  addEventListener: noop,
  removeEventListener: noop,
  location: { href: '', search: '', hash: '', origin: '', pathname: '' },
  history: { pushState: noop, replaceState: noop },
  document: document
};
// #endif

// 安全无影子歧义的 nextTick 实现，避免 uniapp rollup 混淆变量踩踏
function nextTick(callback?: () => void): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (callback) {
        try { callback(); } catch (e) {}
      }
      resolve();
    }, 0);
  });
}
import '../../utils/dom-shim';
import { onMounted, onUnmounted, ref, computed, reactive } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { App as CapApp } from '@capacitor/app';
import { Browser as CapBrowser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { AirCloudClient, calculateScopeWindow, copyTextToClipboard } from '../../api/client';
import { voltageToPercentage, estimateRemainingDays } from '../../utils/battery-model';
import { wgs84ToGcj02 } from '../../utils/coord-transform';
import { stationClient } from '../../utils/station-client';
import { APK_DOWNLOAD_URL, OFFLINE_APK_QR_SVG } from '../../utils/apk-qr';

declare const TMap: any;
declare const lucide: any;
declare const echarts: any;

const apiClient = AirCloudClient.getInstance();
const isStationConnected = ref(false);

// 物理遥测看板响应式数据模型
const activeTelemetry = reactive({
  battMv: null as number | null,
  battPct: null as number | null,
  battText: '—',
  csq: null as number | null,
  csqLevel: '—',
  csqText: '—',
  coordsText: '暂无定位坐标',
  addressText: '暂无物理地址',
  speedText: '0.0 km/h',
  speedColor: '#00f0ff',
  gnssBadgeText: '待机',
  lastActiveText: '暂无上报'
});

// 时空时间轴响应式状态模型
const timelineDisplay = reactive({
  scaleTicks: ['08:00', '09:30', '11:00', '12:30', '14:00 (最新)'],
  currentRangeLabel: '近90天',
  liveLatestSpeed: '0.0 km/h',
  liveLatestTime: '—',
  liveStateText: '原地静止',
  speedTagColor: '#00f0ff'
});

// 微信小程序 OAuth 授权时效状态门禁
const awaitingOAuthSince = ref<number>(0);
const OAUTH_AWAIT_TIMEOUT_MS = 10 * 60 * 1000; // 10分钟时效
const showMpOAuthGuide = ref(false);
const showMpManualInput = ref(false);
const mpManualTokenText = ref('');
const isMpExchangingToken = ref(false);
const consumedTokens = new Set<string>();
const ignoredTokens = new Set<string>();

function closeMpOAuthGuide() {
  showMpOAuthGuide.value = false;
  showMpManualInput.value = false;
  mpManualTokenText.value = '';
  isMpExchangingToken.value = false;
  awaitingOAuthSince.value = 0;
}

// 手机 APP 引导弹层状态
const showDownloadPopover = ref(false);

function toggleDownloadPopover() {
  showDownloadPopover.value = !showDownloadPopover.value;
  if (showDownloadPopover.value) {
    nextTick(refreshIcons);
  }
}

// 设备手动刷新状态
const isDeviceRefreshing = ref(false);
const isInspectorLoading = ref(false);

async function manualRefreshDevices() {
  if (isDeviceRefreshing.value) return;
  isDeviceRefreshing.value = true;

  // 8s 熔断保护，防止弱网悬挂
  const watchdog = setTimeout(() => {
    if (isDeviceRefreshing.value) {
      isDeviceRefreshing.value = false;
      showToast('刷新超时，请检查网络', 'warn', 3000);
    }
  }, 8000);

  try {
    // 若守护站已联机，先请求后台调度器同步最新设备
    if (isStationConnected.value) {
      await stationClient.fetchDevices();
    }
    const res = await loadRealDevices(true);
    if (res.success) {
      showToast(`已同步最新 ${res.count} 台设备资产与状态`, 'success', 2500);
    } else if (res.isAuthExpired) {
      showToast('当前账号云端会话已断开，请重新登录', 'warn', 4000);
    } else {
      showToast(res.error || '设备同步失败，请检查网络', 'error', 3000);
    }
  } catch (err: any) {
    console.warn('[AirTrack] 手动刷新设备失败:', err);
    showToast('设备同步失败，请检查网络', 'error', 3000);
  } finally {
    clearTimeout(watchdog);
    setTimeout(() => {
      isDeviceRefreshing.value = false;
      nextTick(refreshIcons);
    }, 600);
  }
}

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
const showAccountModal = ref(false);
// ================= 全平台标准矢量图标 Data-URI (内联纯净编码，零依赖) =================
const SVG_ICONS = {
  trash: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23f43f5e%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%223%206%205%206%2021%206%22%2F%3E%3Cpath%20d%3D%22M19%206v14a2%202%200%200%201-2%202H7a2%202%200%200%201-2-2V6m3%200V4a2%202%200%200%201%202-2h4a2%202%200%200%201%202%202v2%22%2F%3E%3Cline%20x1%3D%2210%22%20y1%3D%2211%22%20x2%3D%2210%22%20y2%3D%2217%22%2F%3E%3Cline%20x1%3D%2214%22%20y1%3D%2211%22%20x2%3D%2214%22%20y2%3D%2217%22%2F%3E%3C%2Fsvg%3E",
  crosshair: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2300f0ff%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%2210%22%2F%3E%3Cline%20x1%3D%2222%22%20y1%3D%2212%22%20x2%3D%2218%22%20y2%3D%2212%22%2F%3E%3Cline%20x1%3D%226%22%20y1%3D%2212%22%20x2%3D%222%22%20y2%3D%2212%22%2F%3E%3Cline%20x1%3D%2212%22%20y1%3D%226%22%20x2%3D%2212%22%20y2%3D%222%22%2F%3E%3Cline%20x1%3D%2212%22%20y1%3D%2222%22%20x2%3D%2212%22%20y2%3D%2218%22%2F%3E%3C%2Fsvg%3E",
  play: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23020617%22%20stroke%3D%22%23020617%22%20stroke-width%3D%222%22%3E%3Cpolygon%20points%3D%225%203%2019%2012%205%2021%205%203%22%2F%3E%3C%2Fsvg%3E",
  pause: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23020617%22%20stroke%3D%22%23020617%22%20stroke-width%3D%222%22%3E%3Crect%20x%3D%226%22%20y%3D%224%22%20width%3D%224%22%20height%3D%2216%22%2F%3E%3Crect%20x%3D%2214%22%20y%3D%224%22%20width%3D%224%22%20height%3D%2216%22%2F%3E%3C%2Fsvg%3E",
  chevronUp: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%2218%2015%2012%209%206%2015%22%2F%3E%3C%2Fsvg%3E",
  chevronDown: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E",
  sliders: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2338bdf8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cline%20x1%3D%224%22%20y1%3D%2221%22%20x2%3D%224%22%20y2%3D%2214%22%2F%3E%3Cline%20x1%3D%224%22%20y1%3D%2210%22%20x2%3D%224%22%20y2%3D%223%22%2F%3E%3Cline%20x1%3D%2212%22%20y1%3D%2221%22%20x2%3D%2212%22%20y2%3D%2212%22%2F%3E%3Cline%20x1%3D%2212%22%20y1%3D%228%22%20x2%3D%2212%22%20y2%3D%223%22%2F%3E%3Cline%20x1%3D%2220%22%20y1%3D%2221%22%20x2%3D%2220%22%20y2%3D%2216%22%2F%3E%3Cline%20x1%3D%2220%22%20y1%3D%2212%22%20x2%3D%2220%22%20y2%3D%223%22%2F%3E%3Cline%20x1%3D%221%22%20y1%3D%2214%22%20x2%3D%227%22%20y2%3D%2214%22%2F%3E%3Cline%20x1%3D%229%22%20y1%3D%228%22%20x2%3D%2215%22%20y2%3D%228%22%2F%3E%3Cline%20x1%3D%2217%22%20y1%3D%2216%22%20x2%3D%2223%22%20y2%3D%2216%22%2F%3E%3C%2Fsvg%3E",
  calendar: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2300f0ff%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%224%22%20width%3D%2218%22%20height%3D%2218%22%20rx%3D%222%22%20ry%3D%222%22%2F%3E%3Cline%20x1%3D%2216%22%20y1%3D%222%22%20x2%3D%2216%22%20y2%3D%226%22%2F%3E%3Cline%20x1%3D%228%22%20y1%3D%222%22%20x2%3D%228%22%20y2%3D%226%22%2F%3E%3Cline%20x1%3D%223%22%20y1%3D%2210%22%20x2%3D%2221%22%20y2%3D%2210%22%2F%3E%3C%2Fsvg%3E",
  refresh: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2300f0ff%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%2012a9%209%200%200%201%209-9%209.75%209.75%200%200%201%206.74%202.74L21%208%22%2F%3E%3Cpath%20d%3D%22M21%203v5h-5%22%2F%3E%3Cpath%20d%3D%22M21%2012a9%209%200%200%201-9%209%209.75%209.75%200%200%201-6.74-2.74L3%2016%22%2F%3E%3Cpath%20d%3D%22M8%2016H3v5%22%2F%3E%3C%2Fsvg%3E",
  user: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2300f0ff%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M19%2021v-2a4%204%200%200%200-4-4H9a4%204%200%200%200-4%204v2%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%227%22%20r%3D%224%22%2F%3E%3C%2Fsvg%3E",
  userX: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M16%2021v-2a4%204%200%200%200-4-4H6a4%204%200%200%200-4%204v2%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%227%22%20r%3D%224%22%2F%3E%3Cline%20x1%3D%2217%22%20y1%3D%228%22%20x2%3D%2222%22%20y2%3D%2213%22%2F%3E%3Cline%20x1%3D%2222%22%20y1%3D%228%22%20x2%3D%2217%22%20y2%3D%2213%22%2F%3E%3C%2Fsvg%3E",
  plus: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cline%20x1%3D%2212%22%20y1%3D%225%22%20x2%3D%2212%22%20y2%3D%2219%22%2F%3E%3Cline%20x1%3D%225%22%20y1%3D%2212%22%20x2%3D%2219%22%20y2%3D%2212%22%2F%3E%3C%2Fsvg%3E",
  keyRound: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2322d3ee%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M21%202l-2%202m-1.5%201.5L14%209l-1.5-1.5L11%209l-1.5-1.5L8%209c-3.3%200-6%202.7-6%206s2.7%206%206%206%206-2.7%206-6l6.5-6.5L22%204l-1-2z%22%2F%3E%3C%2Fsvg%3E",
  loader: "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2322d3ee%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M21%2012a9%209%200%201%201-6.219-8.56%22%2F%3E%3C%2Fsvg%3E"
};
const headerTopStyle = ref('');
const capsuleTopStyle = ref('');

const wxMapCenter = ref({ lat: 34.794375, lng: 114.335039 });
const menuButtonRect = ref<any>(null);
const isPlayingState = ref(false);
const wxMarkers = ref<any[]>([]);
const wxPolylines = ref<any[]>([]);
const wxCircles = ref<any[]>([]);
const activeAccountPhone = ref(apiClient.getActivePhone());
const activeAccountLabel = ref(apiClient.getActiveAccount().label);
const displayAccountLabel = computed(() => {
  const lbl = activeAccountLabel.value?.trim();
  if (!lbl || /^账号\s*\d+$/.test(lbl)) return '';
  return lbl;
});
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
      voltageMv: d.voltageMv || 0,
      battMv: d.voltageMv ? `${d.voltageMv} mV` : '未上报',
      battPct: d.battPct,
      csq: d.csq ? `CSQ ${d.csq}` : '无信号',
      csqNum: d.csq || 0,
      signalLevelText: d.signalLevelText || (d.csq >= 20 ? '强' : d.csq >= 12 ? '中' : d.csq >= 5 ? '弱' : '无'),
      relativeTime: d.relativeTime || '—',
      coordText: d.coordText || (d.lat != null && d.lng != null ? `${Number(d.lat).toFixed(5)}, ${Number(d.lng).toFixed(5)}` : '暂无定位'),
      speed: typeof d.speed === 'number' ? d.speed : (parseFloat(d.speed) || 0),
      status: d.online ? '在线' : '离线',
      address: d.address || '未上报物理定位',
      lastActiveTime: d.lastActiveTime || '未上报',
      online: d.online,
      fixType: d.fixType || 'GPS',
      satCount: d.satCount,
      tempC: d.tempC
    };
  });
}

async function copyCoordToClipboard(coord?: string) {
  if (!coord || coord === '暂无定位') {
    showToast('当前设备暂未上报坐标', 'warn', 2500);
    return;
  }
  const ok = await copyTextToClipboard(coord);
  if (ok) {
    showToast(`已复制坐标：${coord}`, 'success', 2500);
  } else {
    showToast(`坐标：${coord}`, 'info', 2500);
  }
}

function formatPhone(phone: string): string {
  if (!phone || phone === 'master' || phone === '主账号') return '官方授权主账号';
  if (phone.startsWith('master_')) return `官方主账号 (${phone.slice(7)})`;
  const clean = String(phone).replace(/\s+/g, '');
  if (clean.length === 11 && /^\d+$/.test(clean)) {
    return `${clean.slice(0, 3)} ${clean.slice(3, 7)} ${clean.slice(7)}`;
  }
  return clean;
}

const editingPhone = ref('');
const editingAlias = ref('');

const editingDevImei = ref('');
const editingDevName = ref('');

function startEditDeviceName(imei: string, currentName: string, e: Event) {
  e.stopPropagation();
  editingDevImei.value = imei;
  editingDevName.value = currentName;
  nextTick(() => {
    const inp = document.getElementById('edit-dev-input-' + imei);
    if (inp) inp.focus();
  });
}

function saveDeviceName(imei: string) {
  apiClient.setCustomDeviceName(imei, editingDevName.value.trim());
  editingDevImei.value = '';
  loadRealDevices();
}

function startEditAccountAlias(account: any, e: Event) {
  e.stopPropagation();
  editingPhone.value = account.phone;
  editingAlias.value = account.label || '';
  nextTick(() => {
    const inp = document.getElementById('edit-alias-input-' + account.phone);
    if (inp) inp.focus();
  });
}

function saveAccountAlias(phone: string) {
  apiClient.updateAccountLabel(phone, editingAlias.value.trim());
  editingPhone.value = '';
  refreshAccountStates();
}

const checkingPhone = ref<string | null>(null);
const isProbing = ref(false);
let activeAccountSwitchSeq = 0;

async function refreshAccountStates() {
  const states = apiClient.getAccountStates();
  accountStates.value = states;
  for (const s of states) {
    const probed = apiClient.getProbedDeviceCount(s.account.phone);
    if (probed !== undefined) {
      s.deviceCount = probed;
    } else {
      try {
        const cached = await db.getDeviceProfiles(s.account.phone);
        s.deviceCount = cached.length > 0 ? cached.length : (s.account.phone === apiClient.getActivePhone() ? deviceList.value.length : 0);
      } catch {
        s.deviceCount = s.account.phone === apiClient.getActivePhone() ? deviceList.value.length : 0;
      }
    }
  }
  accountStates.value = states;
  activeAccountPhone.value = apiClient.getActivePhone();
  activeAccountLabel.value = apiClient.getActiveAccount().label;
  activeAccountHasAuth.value = apiClient.hasAuth();
  activeProjectKey.value = (apiClient as any).projectKey || '';
  nextTick(refreshIcons);
}

/** 串行探针检测（严格避免并发单例状态踩踏） */
async function runSequentialHealthProbe() {
  if (isProbing.value) return;
  isProbing.value = true;
  try {
    await apiClient.probeAccountsSequential(undefined, (phone, res) => {
      const item = accountStates.value.find(s => s.account.phone === phone);
      if (item) {
        item.isExpired = !!res.isExpired;
        item.deviceCount = res.deviceCount;
      }
      nextTick(refreshIcons);
    });
  } catch (err) {
    console.warn('[AirTrack] 串行探活异常', err);
  } finally {
    isProbing.value = false;
    nextTick(refreshIcons);
  }
}

function onRefreshAccountCredential(phone: string, isExpired: boolean) {
  if (isExpired) {
    openOAuthAuthorization(phone);
  } else {
    refreshAccountCredential(phone);
  }
}

function onRemoveAccount(phone: string) {
  const isCur = phone === apiClient.getActivePhone();
  const title = isCur ? '退出并解绑账号' : '移除账号';
  const content = isCur
    ? `确认退出并解绑当前账号 [${formatPhone(phone)}] 吗？解绑后将从本机清空，可随时重新登录接入。`
    : `确认从本机移除账号 [${formatPhone(phone)}] 吗？`;

  // #ifdef MP-WEIXIN
  uni.showModal({
    title,
    content,
    confirmText: '确认解绑',
    confirmColor: '#f43f5e',
    cancelText: '取消',
    success: (res) => {
      if (res.confirm) {
        performRemoveAccount(phone, isCur);
      }
    }
  });
  return;
  // #endif

  // #ifndef MP-WEIXIN
  if (typeof window !== 'undefined' && window.confirm) {
    if (!window.confirm(content)) return;
    performRemoveAccount(phone, isCur);
  }
  // #endif
}

function performRemoveAccount(phone: string, isCur: boolean) {
  apiClient.removeAccount(phone);
  if (isCur) {
    activeDeviceId.value = '';
    TRACK_POINTS = [];
    accountDevices.value = [];
    deviceList.value = [];
    apiClient.setActiveAccount('');
  }
  refreshAccountStates();
  showToast(isCur ? '已成功解绑并退出当前账号' : `已从本机移除账号 [${formatPhone(phone)}]`, 'info', 2500);
  if (isCur) {
    loadRealDevices();
  }
}

async function refreshAccountCredential(phone: string) {
  checkingPhone.value = phone;
  try {
    const res = await apiClient.checkAccountHealth(phone);
    if (res.ok) {
      showToast(`✓ [${formatPhone(phone)}] 凭据有效性验证通过 · 状态正常`, 'success', 3000);
      await refreshAccountStates();
      if (phone === activeAccountPhone.value) {
        await loadRealDevices();
      }
    } else {
      if (res.isExpired) {
        showToast(res.message || `账号 [${formatPhone(phone)}] 登录态已失效，请重新授权`, 'warn', 4000);
      } else {
        showToast(res.message || `账号 [${formatPhone(phone)}] 状态检测未通过`, 'warn', 3500);
      }
      await refreshAccountStates();
    }
  } catch (e: any) {
    showToast(`账号 [${formatPhone(phone)}] 检测遇到网络波动，已保留离线资产`, 'warn', 3000);
  } finally {
    checkingPhone.value = null;
    nextTick(refreshIcons);
  }
}

// 站内沉浸式官方授权浮层状态（零跳转）
const showInPageOAuthModal = ref(false);
const inPageOAuthUrl = ref('');
const isIframeLoading = ref(true);

function closeInPageOAuth() {
  showInPageOAuthModal.value = false;
  inPageOAuthUrl.value = '';
}

// 全局悬浮 Toast 通知状态
const toastMessage = ref('');
const toastType = ref<'success' | 'info' | 'warn' | 'error'>('info');
let toastTimer: any = null;

function showToast(msg: string, type: 'success' | 'info' | 'warn' | 'error' = 'info', duration = 3500) {
  toastMessage.value = msg;
  toastType.value = type;
  nextTick(refreshIcons);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
  }, duration);
}

async function openOAuthAuthorization(phone?: string) {
  const target = (phone || '').trim();
  const currentHref = (typeof window !== 'undefined' && window.location?.href) ? window.location.href : 'https://ocean1798.github.io/Air8202G-AirTrack-Pro/';
  const url = apiClient.buildOAuthUrl(target, currentHref);
  console.info('[AirTrack] 打开官方 OAuth 授权:', url);

  // #ifdef MP-WEIXIN
  awaitingOAuthSince.value = Date.now();
  showMpOAuthGuide.value = true;
  uni.setClipboardData({
    data: url,
    success: () => {
      showToast('授权链接已复制！请在浏览器中打开，切回自动识别', 'info', 3500);
      showManualTokenInput.value = true;
    }
  });
  return;
  // #endif

  if (Capacitor.isNativePlatform()) {
    try {
      await CapBrowser.open({
        url: url,
        windowName: '_blank'
      });
      return;
    } catch (e) {
      console.warn('[AirTrack] CapBrowser.open 异常，回退至站内浮层', e);
    }
  }

  // 2. 网页端（Web/H5）：直接打开站内内嵌安全浮层（iframe 零跳转闭环）！
  inPageOAuthUrl.value = url;
  isIframeLoading.value = true;
  showInPageOAuthModal.value = true;
  nextTick(refreshIcons);
}

// 备用手动 Token 输入状态
const showManualTokenInput = ref(false);
const manualTokenText = ref('');
const isExchangingManualToken = ref(false);

function readFromClipboard() {
  // #ifdef MP-WEIXIN
  uni.getClipboardData({
    success: (res) => {
      const text = (res.data || '').trim();
      if (text) {
        manualTokenText.value = text;
        const cleanToken = apiClient.extractToken(text);
        if (cleanToken) {
          showToast('已从剪贴板提取 Token，正在换票...', 'info', 1800);
          applyManualToken();
        } else {
          showToast('已粘贴剪贴板内容', 'info', 1500);
        }
      } else {
        showToast('剪贴板为空，请先在浏览器中复制 Token', 'warn', 2000);
      }
    },
    fail: () => {
      showToast('请直接长按输入框粘贴', 'info', 2000);
    }
  });
  // #endif

  // #ifndef MP-WEIXIN
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then(text => {
      if (text) {
        manualTokenText.value = text.trim();
        const cleanToken = apiClient.extractToken(text);
        if (cleanToken) {
          showToast('已从剪贴板提取 Token，正在换票...', 'info', 1800);
          applyManualToken();
        }
      }
    }).catch(() => {
      showToast('请在输入框直接粘贴', 'info', 1500);
    });
  }
  // #endif
}

async function applyManualToken() {
  const raw = manualTokenText.value.trim();
  if (!raw) {
    showToast('请先粘贴 Token 或授权回调链接', 'warn', 2500);
    return;
  }
  const cleanToken = apiClient.extractToken(raw);
  if (!cleanToken) {
    showToast('未能提取出有效 Token，请核对', 'warn', 2500);
    return;
  }

  isExchangingManualToken.value = true;
  try {
    const pending = apiClient.consumePendingAccount() || apiClient.getActivePhone();
    const res = await apiClient.exchangeOAuthToken(cleanToken, pending);
    if (res.ok) {
      showToast(`✓ 账号 ${pending} 授权连接成功！`, 'success', 3000);
      manualTokenText.value = '';
      showManualTokenInput.value = false;
      showAccountModal.value = false;
      refreshAccountStates();
      await loadRealDevices();
    } else {
      showToast(res.message || 'Token 无效或已过期，请重新获取', 'error', 3500);
    }
  } catch (err: any) {
    showToast(err?.message || '换票失败，请检查网络', 'error', 3000);
  } finally {
    isExchangingManualToken.value = false;
  }
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
  return d.online ? (d.csq ? `CSQ ${d.csq}` : '在线') : '离线';
}

function convertStationDeviceToInfo(d: any): DeviceInfo {
  const csq = Number(d.csq) || 20;
  const signalLevelText = csq >= 20 ? '强' : csq >= 12 ? '中' : csq >= 5 ? '弱' : '无';
  const mv = Number(d.battery_mv) || 3900;
  const battPct = voltageToPercentage(mv);
  const isOnline = Boolean(d.is_online);

  const pad = (n: number) => String(n).padStart(2, '0');
  let lastActiveTime = '未上报';
  let relativeTime = '—';
  if (d.last_seen) {
    const dt = new Date(d.last_seen);
    lastActiveTime = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
    const diffSec = Math.max(0, (Date.now() - d.last_seen) / 1000);
    relativeTime = diffSec < 60 ? '刚刚' : diffSec < 3600 ? `${Math.floor(diffSec / 60)}分钟前` : diffSec < 86400 ? `${Math.floor(diffSec / 3600)}小时前` : `${Math.floor(diffSec / 86400)}天前`;
  }

  const located = typeof d.lat === 'number' && typeof d.lng === 'number' && !isNaN(d.lat) && !isNaN(d.lng) && d.lat !== 0 && d.lng !== 0;
  const coordText = located ? `${Number(d.lat).toFixed(5)}, ${Number(d.lng).toFixed(5)}` : '暂无定位';

  const defaultAddr = d.imei === '864317087172071'
    ? '上海市浦东新区康桥镇浦三路3801号'
    : d.imei === '864317087172741'
      ? '上海市浦东新区北蔡镇花绣路18弄'
      : d.imei === '864317087172683'
        ? '广东省深圳市宝安区新安街道'
        : (d.imei === '864317087172311' || d.imei === '864317087172121')
          ? '河南省开封市鼓楼区南苑街道丁角街56号'
          : (d.imei === '864317083931439')
            ? '新疆维吾尔自治区乌鲁木齐市沙依巴克区友好南路'
            : '上海市浦东新区康桥镇';

  return {
    imei: d.imei,
    name: d.name || `终端·${d.imei.slice(-5)}`,
    shortName: d.name || `终端·${d.imei.slice(-5)}`,
    online: isOnline,
    lastActiveTime,
    relativeTime,
    coordText,
    battPct,
    signalLevelText,
    fixType: 'GPS',
    lat: located ? d.lat : null,
    lng: located ? d.lng : null,
    gcjLat: located ? d.lat : null,
    gcjLng: located ? d.lng : null,
    speed: 0.0,
    voltageMv: mv,
    csq,
    firmwareVersion: d.fw_ver || 'Air8202G-V1.0',
    address: d.address || defaultAddr
  };
}

/** 从合宙云端或本地守护站同步当前账号的真实设备清单 */
function hydrateDeviceInfo(baseDev: DeviceInfo, stDev: any): DeviceInfo {
  const converted = convertStationDeviceToInfo(stDev);
  return {
    ...baseDev,
    online: converted.online,
    lat: converted.lat ?? baseDev.lat,
    lng: converted.lng ?? baseDev.lng,
    gcjLat: converted.gcjLat ?? baseDev.gcjLat,
    gcjLng: converted.gcjLng ?? baseDev.gcjLng,
    csq: converted.csq,
    voltageMv: converted.voltageMv,
    battPct: converted.battPct,
    signalLevelText: converted.signalLevelText,
    speed: converted.speed,
    coordText: converted.coordText !== '暂无定位' ? converted.coordText : baseDev.coordText,
    relativeTime: converted.relativeTime !== '—' ? converted.relativeTime : baseDev.relativeTime,
    lastActiveTime: converted.lastActiveTime !== '未上报' ? converted.lastActiveTime : baseDev.lastActiveTime,
    address: converted.address !== '未上报物理位置' ? converted.address : baseDev.address
  };
}

/** 
 * 从合宙云端确立资产真理基线（SSOT），并融合本地守护站遥测就地注水（Telemetry In-Place Hydration）
 * 核心架构准则：基站提供状态增强，绝不决定资产增删；云端/IndexedDB 决定资产名单权威。
 */
async function loadRealDevices(isManual = false): Promise<{ success: boolean; count: number; isAuthExpired?: boolean; error?: string }> {
  deviceLoading.value = true;
  authError.value = '';
  const requestAcct = apiClient.getActivePhone();
  const startSeq = activeAccountSwitchSeq;

  let baseList: DeviceInfo[] = [];
  let isAuth = false;
  let errMsg = '';

  try {
    // 步骤 1：确立当前账号的法定资产基线（Base Device Set，由云端权威拉取或离线镜像决定）
    try {
      baseList = await apiClient.getDeviceList();
    } catch (e: any) {
      isAuth = (e && e.name === 'AuthExpiredError') || (e?.message && e.message.includes('auth failed'));
      errMsg = isAuth ? '合宙云端登录态已失效，请重新授权当前账号。' : (e?.message || '云端设备资产清单同步失败');

      // 降级兜底：优先从本地 IndexedDB 读取当前请求账号的已存快照，杜绝白屏或空列表
      try {
        const cached = await db.getDeviceProfiles(requestAcct);
        if (cached && cached.length > 0) {
          baseList = cached as any;
        }
      } catch (_) {}
    }

    // 主动核验当前账号是否已被标记为登录态失效（覆盖 client 内部降级返回缓存且未向上抛错的场景）
    if (apiClient.isAuthExpired(requestAcct)) {
      isAuth = true;
      errMsg = '合宙云端登录态已失效（在其他终端重复登录被顶线），请重新授权当前账号。';
      authError.value = '云端登录态失效，正在以本地离线镜像展示，部分功能需重新授权。';
      if (!isManual) {
        showToast('当前账号在其他终端登录，登录态已失效，请在账号弹窗重新授权', 'warn', 4000);
      }
    } else if (errMsg && !isAuth) {
      authError.value = errMsg;
      if (!isManual) {
        showToast(errMsg, 'error', 3000);
      }
    }

    // 步骤 2：边缘基站遥测就地注水（Telemetry In-Place Hydration，绝不动设备基数）
    if (isStationConnected.value && baseList.length > 0) {
      try {
        const stDevs = await stationClient.fetchDevices();
        if (stDevs && stDevs.length > 0) {
          // 建立基站遥测哈希索引
          const stMap = new Map<string, any>();
          for (const sd of stDevs) {
            if (sd.imei && sd.imei !== '864317087173038' && (sd.account === requestAcct || sd.account?.endsWith(requestAcct.slice(-11)))) {
              stMap.set(sd.imei, sd);
            }
          }

          // 定向就地注水：复用现有一体化转换模型，只更新匹配设备的遥测数值，绝不剔除未匹配设备
          baseList = baseList.map(baseDev => {
            const stDev = stMap.get(baseDev.imei);
            if (!stDev) return baseDev; // 基站中无此设备时，平稳保留其原有基线状态
            return hydrateDeviceInfo(baseDev, stDev);
          });
        }
      } catch (stErr) {
        console.warn('[Station Hydration] 基站注水跳过，保留基线数据:', stErr);
      }
    }

    // 时序与账号双重断言：若网络等待期间账号已发生切换，立即丢弃该过期响应
    if (startSeq !== activeAccountSwitchSeq || requestAcct !== apiClient.getActivePhone()) {
      console.info('[AirTrack] 丢弃过期的在途设备列表响应:', requestAcct);
      return { success: false, count: 0 };
    }

    // 步骤 3：状态机提交与持久化收口
    if (baseList.length > 0) {
      deviceList.value = baseList;
      rebuildDeviceDb(baseList);
      const keep = baseList.some(d => d.imei === activeDeviceId.value);
      selectDeviceTab(keep ? activeDeviceId.value : baseList[0].imei);
      return { success: !isAuth, count: baseList.length, isAuthExpired: isAuth, error: errMsg };
    } else {
      deviceList.value = [];
      rebuildDeviceDb([]);
      activeDeviceId.value = '';
      TRACK_POINTS = [];
      drawSpeedWaveCanvas();
      return { success: false, count: 0, isAuthExpired: isAuth, error: errMsg || '暂无设备数据' };
    }
  } catch (err: any) {
    console.warn('[AirTrack] loadRealDevices 异常:', err);
    return { success: false, count: baseList.length, isAuthExpired: isAuth, error: err?.message || errMsg };
  } finally {
    if (startSeq === activeAccountSwitchSeq && requestAcct === apiClient.getActivePhone()) {
      deviceLoading.value = false;
      refreshAccountStates();
      nextTick(() => {
        drawSpeedWaveCanvas();
        refreshIcons();
      });
    }
  }
}

async function switchAccount(phone: string) {
  if (phone === apiClient.getActivePhone()) {
    showToast(`当前账号已是 [${formatPhone(phone)}]`, 'info', 2000);
    return;
  }
  const curSeq = ++activeAccountSwitchSeq;
  apiClient.setActiveAccount(phone);
  activeDeviceId.value = '';
  TRACK_POINTS = [];

  // 切号立即清空 WebGL 地图全部图元，杜绝旧账号图钉与轨迹折线视觉残留
  if (typeof window !== 'undefined') {
    try {
      if ((window as any).__vehicleMarker) (window as any).__vehicleMarker.setGeometries([]);
      if ((window as any).__trackLines) (window as any).__trackLines.setGeometries([]);
      if ((window as any).__fenceCircle) (window as any).__fenceCircle.setGeometries([]);
    } catch (_) {}
  }

  // 1. Cache-First: 先从本地 IndexedDB 立即载入已缓存设备快照（0ms 响应，绝不白屏）
  try {
    const cached = await db.getDeviceProfiles(phone);
    if (curSeq === activeAccountSwitchSeq) {
      if (cached && cached.length > 0) {
        deviceList.value = cached;
        rebuildDeviceDb(cached);
        selectDeviceTab(cached[0].imei);
      } else {
        deviceList.value = [];
        rebuildDeviceDb([]);
      }
    }
  } catch (_) {
    if (curSeq === activeAccountSwitchSeq) {
      deviceList.value = [];
      rebuildDeviceDb([]);
    }
  }

  showToast(`✓ 已成功切换至账号 [${formatPhone(phone)}]`, 'success', 2500);
  refreshAccountStates();
  await loadRealDevices();
}

async function fetchDeviceLiveTrackAndTags(imei: string) {
  isInspectorLoading.value = true;
  try {
    const tagData = await apiClient.getRealTagTelemetry(imei);
    if (tagData) {
      if (tagData.val_799) {
        const mv = parseInt(tagData.val_799, 10);
        const pct = voltageToPercentage(mv);
        activeTelemetry.battMv = mv;
        activeTelemetry.battPct = pct;
        activeTelemetry.battText = `${mv} mV (${pct}%)`;
        const battEl = document.getElementById('tel-tag-batt');
        if (battEl) battEl.innerText = `${mv} mV (${pct}%)`;
      }
      if (tagData.val_782) {
        const csq = parseInt(tagData.val_782, 10);
        const level = csq >= 20 ? '强' : csq >= 12 ? '中' : csq >= 5 ? '弱' : '无';
        activeTelemetry.csq = csq;
        activeTelemetry.csqLevel = level;
        activeTelemetry.csqText = `${level} (CSQ ${csq})`;
        const csqEl = document.getElementById('tel-tag-csq');
        if (csqEl) csqEl.innerText = `${level} (CSQ ${csq})`;
      }
    }
  } catch (err) {
    console.warn('[AirCloud] Live telemetry sync fallback', err);
  } finally {
    isInspectorLoading.value = false;
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
  const elLastTime = document.getElementById('tel-tag-last-time');
  if (elLastTime) elLastTime.innerText = `${dev.lastActiveTime || '未上报'} (${dev.relativeTime || '—'})`;
  const elBatt = document.getElementById('tel-tag-batt');
  if (elBatt) {
    elBatt.innerText = dev.battPct != null ? `${dev.voltageMv} mV (${dev.battPct}%)` : dev.battMv;
  }
  const elCsq = document.getElementById('tel-tag-csq');
  if (elCsq) {
    elCsq.innerText = dev.csqNum > 0 ? `${dev.signalLevelText || '强'} (CSQ ${dev.csqNum})` : '无信号';
  }

  // 同步更新顶部机头设备状态
  const mobHeaderName = document.getElementById('mob-drawer-vehicle-name');
  if (mobHeaderName) mobHeaderName.innerText = dev.name;
  const elGnssBadge = document.getElementById('drawer-gnss-badge');
  if (elGnssBadge) elGnssBadge.innerText = dev.fixType ? `${dev.fixType} 定位` : 'GNSS 3D';

  const located = typeof dev.lat === 'number' && typeof dev.lng === 'number' && !isNaN(dev.lat) && !isNaN(dev.lng);
  const coordText = located ? `${Number(dev.lat).toFixed(4)}°N, ${Number(dev.lng).toFixed(4)}°E` : '未上报经纬度';

  const elCoord = document.getElementById('drawer-coord-text');
  if (elCoord) elCoord.innerText = coordText;
  const elTagCoord = document.getElementById('tel-tag-coords');
  if (elTagCoord) elTagCoord.innerText = `${dev.fixType || 'GPS'} · ${coordText}`;
  const mobHeaderCoord = document.getElementById('mob-drawer-coord-text');
  if (mobHeaderCoord) mobHeaderCoord.innerText = coordText;

  // 响应式遥测状态全面同步（保障小程序等无 DOM 运行环境 100% 数据呈现）
  activeTelemetry.lastActiveText = `${dev.lastActiveTime || '未上报'} (${dev.relativeTime || '—'})`;
  activeTelemetry.battText = dev.battPct != null ? `${dev.voltageMv} mV (${dev.battPct}%)` : (dev.voltageMv ? `${dev.voltageMv} mV` : '—');
  activeTelemetry.csqText = dev.csqNum > 0 ? `${dev.signalLevelText || '强'} (CSQ ${dev.csqNum})` : '无信号';
  activeTelemetry.gnssBadgeText = dev.fixType ? `${dev.fixType} 定位` : 'GNSS 3D';
  activeTelemetry.coordsText = coordText;
  activeTelemetry.addressText = dev.address || '未上报物理地址';
  activeTelemetry.speedText = `${Number(dev.speed || 0).toFixed(1)} km/h`;

  // 仅对真实上报过定位的物理设备做地图定位；未上报设备不做任何坐标推测
  if (located) {
    if ((window as any).__map) {
      const center = new TMap.LatLng(dev.lat, dev.lng);
            // #ifdef MP-WEIXIN
      wxMapCenter.value = { lat: dev.lat, lng: dev.lng };
      wxMarkers.value = [{
        id: 1,
        latitude: dev.lat,
        longitude: dev.lng,
        title: dev.name,
        width: 32,
        height: 32
      }];
      // #endif
(window as any).__map.panTo(center);
      if ((window as any).__vehicleMarker) {
        (window as any).__vehicleMarker.setGeometries([{
          id: 'v1',
          styleId: 'car_icon',
          position: center,
          properties: { title: dev.name }
        }]);
      }
    }
    currentBaseLat = dev.lat;
    currentBaseLng = dev.lng;
  } else if ((window as any).__vehicleMarker) {
    // 未上报定位：移除车辆标记，避免在错误位置显示设备
    (window as any).__vehicleMarker.setGeometries([]);
  }

  // 同步更新右侧感知面板中的物理遥测详情
  const elAddress = document.getElementById('drawer-address-text');
  if (elAddress) elAddress.innerText = dev.address || '未上报物理地址';
  const elCoordDetail = document.getElementById('drawer-coord-detail');
  if (elCoordDetail) elCoordDetail.innerText = coordText;
  const elSpeedDetail = document.getElementById('drawer-speed-detail');
  if (elSpeedDetail) elSpeedDetail.innerText = `${Number(dev.speed || 0).toFixed(1)} km/h`;

  updateLiveStatusBar();
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
const isTrackLoading = ref(false);

async function loadTrackDataForScope(scope: string, startDate: string | null = null, endDate: string | null = null) {
  const imei = activeDeviceId.value;
  if (!imei) {
    TRACK_POINTS = [];
    drawSpeedWaveCanvas();
    updateLiveStatusBar();
    return;
  }

  const dev = DEVICES_DB[imei];
  isTrackLoading.value = true;
  const startLoadTime = Date.now();

  const finishTrackLoading = () => {
    const elapsed = Date.now() - startLoadTime;
    const minHold = 400; // 400ms 最小视觉停留，杜绝毫秒闪烁与毛刺
    if (elapsed < minHold) {
      setTimeout(() => {
        isTrackLoading.value = false;
      }, minHold - elapsed);
    } else {
      isTrackLoading.value = false;
    }
  };

  try {
    // 0. 若已连接独立守护站 (AirTrack Station)，优先向守护站本地高持久 SQLite 获取
    if (isStationConnected.value) {
      const { startMs, endMs, isMultiDay } = calculateScopeWindow(scope, startDate || undefined, endDate || undefined);
      const stPoints = await stationClient.fetchHistory(imei, startMs, endMs, 2000);
      if (stPoints && stPoints.length > 0) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const points = stPoints.map((p: any, idx: number) => {
          const d = new Date(p.timestamp);
          const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          return {
            index: idx,
            lat: p.lat,
            lng: p.lng,
            gcjLat: p.lat,
            gcjLng: p.lng,
            speed: p.speed || 0.0,
            timeStr,
            timestamp: p.timestamp,
            isMultiDay
          };
        });
        TRACK_POINTS = points;
        updateTimelineScaleTicks(isMultiDay);
        initViewportFromTrackPoints();
        drawSpeedWaveCanvas();
        updateLiveStatusBar();

        if (masterMode === 'range') {
          renderRangeTrackOnMap();
        } else {
          renderFullColoredTrackOnMap();
        }
        renderStateAtPosition(committedPlayhead, false);
        return;
      }
    }

    // 强制触发云端同步，确保所选跨度的数据真实拉取到位
    const points = await apiClient.getHistoricalTrack(
      imei,
      scope,
      startDate || undefined,
      endDate || undefined,
      true
    );

    if (points && points.length > 0) {
      TRACK_POINTS = points;
      updateTimelineScaleTicks(points[0].isMultiDay);
      initViewportFromTrackPoints();
      drawSpeedWaveCanvas();
      updateLiveStatusBar();

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
    finishTrackLoading();
  }

  // 兜底：若该跨度内暂无轨迹上报，但设备有最新经纬度
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
  updateLiveStatusBar();
  if ((window as any).__trackLines) {
    (window as any).__trackLines.setGeometries([]);
  }
}

function updateTimelineScaleTicks(isMultiDay?: boolean) {
  if (!TRACK_POINTS.length) return;

  let sMs = viewportStartMs;
  let eMs = viewportEndMs;
  if (!isViewportActive || sMs <= 0 || eMs <= sMs) {
    const pS = TRACK_POINTS[0];
    const pE = TRACK_POINTS[TRACK_POINTS.length - 1];
    sMs = pS.timestamp < 1e11 ? pS.timestamp * 1000 : pS.timestamp;
    eMs = pE.timestamp < 1e11 ? pE.timestamp * 1000 : pE.timestamp;
  }

  const span = Math.max(1000, eMs - sMs);
  const t0 = sMs;
  const t1 = sMs + span * 0.25;
  const t2 = sMs + span * 0.50;
  const t3 = sMs + span * 0.75;
  const t4 = eMs;

  const d0 = new Date(t0);
  const d4 = new Date(t4);
  const isSameDay = d0.toDateString() === d4.toDateString();
  const isMicro = span <= 2 * 3600 * 1000;

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmtTime = (ts: number, isEdge = false) => {
    const d = new Date(ts);
    const h = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    const mo = pad(d.getMonth() + 1);
    const day = pad(d.getDate());

    if (isSameDay) {
      if (isMicro) return `${h}:${m}:${s}`;
      return isEdge ? `${mo}-${day} ${h}:${m}` : `${h}:${m}`;
    } else {
      return `${mo}-${day} ${h}:${m}`;
    }
  };

  const t0Str = fmtTime(t0, true);
  const t1Str = fmtTime(t1);
  const t2Str = fmtTime(t2);
  const t3Str = fmtTime(t3);
  const t4Str = masterMode === 'live' && !isViewportActive ? `${fmtTime(t4, true)} (最新)` : fmtTime(t4, true);

  timelineDisplay.scaleTicks = [t0Str, t1Str, t2Str, t3Str, t4Str];

  const elStart = document.getElementById('scale-tick-start');
  if (elStart) elStart.innerText = t0Str;
  const el1 = document.getElementById('scale-tick-1');
  if (el1) el1.innerText = t1Str;
  const el2 = document.getElementById('scale-tick-2');
  if (el2) el2.innerText = t2Str;
  const el3 = document.getElementById('scale-tick-3');
  if (el3) el3.innerText = t3Str;
  const elEnd = document.getElementById('scale-tick-end');
  if (elEnd) {
    elEnd.innerHTML = `<span>${t4Str}</span><span class="w-1.5 h-1.5 rounded-full bg-cyber-primary animate-pulse-cyan"></span>`;
  }
}

function updateLiveStatusBar() {
  const badge = document.getElementById('live-state-badge');
  const dot = document.getElementById('live-state-dot');
  const txt = document.getElementById('live-state-text');
  const timeEl = document.getElementById('live-latest-time');
  const speedEl = document.getElementById('live-latest-speed');

  const imei = activeDeviceId.value;
  const dev = imei ? DEVICES_DB[imei] : null;

  if (!dev || !dev.online) {
    timelineDisplay.liveStateText = '信号中断 · 盲区';
    timelineDisplay.liveLatestTime = dev?.lastActiveTime ? `最后上报: ${dev.lastActiveTime.slice(11, 19)}` : '未上报';
    timelineDisplay.liveLatestSpeed = '离线';
    timelineDisplay.speedTagColor = '#f43f5e';

    // 离线/盲区状态：玫瑰红指示
    if (badge) {
      badge.className = 'flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border border-rose-500/40 bg-rose-950/40';
    }
    if (dot) {
      dot.className = 'w-2 h-2 rounded-full bg-rose-500';
    }
    if (txt) {
      txt.className = 'text-rose-300 font-bold';
      txt.innerText = '信号中断 · 盲区';
    }
    if (timeEl) {
      timeEl.innerText = dev?.lastActiveTime ? `最后上报: ${dev.lastActiveTime.slice(11, 19)}` : '未上报';
    }
    if (speedEl) {
      speedEl.innerText = '离线';
      speedEl.style.color = '#f43f5e';
    }
    return;
  }

  const isMoving = dev.speed && dev.speed > 3;
  if (isMoving) {
    timelineDisplay.liveStateText = '移动中';
    timelineDisplay.liveLatestTime = dev.lastActiveTime ? dev.lastActiveTime.slice(11, 19) : '刚刚';
    timelineDisplay.liveLatestSpeed = `${Number(dev.speed || 0).toFixed(1)} km/h`;
    timelineDisplay.speedTagColor = '#00f0ff';

    // 移动中：翡翠绿高亮指示
    if (badge) {
      badge.className = 'flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border border-cyber-emerald/40 bg-emerald-950/40 shadow-glow-emerald';
    }
    if (dot) {
      dot.className = 'w-2 h-2 rounded-full bg-cyber-emerald animate-pulse-cyan';
    }
    if (txt) {
      txt.className = 'text-emerald-300 font-bold';
      txt.innerText = '移动中';
    }
    if (timeEl) {
      timeEl.innerText = dev.lastActiveTime ? dev.lastActiveTime.slice(11, 19) : '在线';
    }
    if (speedEl) {
      speedEl.innerText = `${Number(dev.speed || 0).toFixed(1)} km/h`;
      speedEl.style.color = '#00f0ff';
    }
  } else {
    timelineDisplay.liveStateText = '原地静止';
    timelineDisplay.liveLatestTime = dev.lastActiveTime ? dev.lastActiveTime.slice(11, 19) : '刚刚';
    timelineDisplay.liveLatestSpeed = '0.0 km/h';
    timelineDisplay.speedTagColor = '#10b981';

    // 原地静止：暗蓝灰稳态指示
    if (badge) {
      badge.className = 'flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border border-slate-600 bg-slate-800/80';
    }
    if (dot) {
      dot.className = 'w-2 h-2 rounded-full bg-slate-400';
    }
    if (txt) {
      txt.className = 'text-slate-300 font-bold';
      txt.innerText = '原地静止';
    }
    if (timeEl) {
      timeEl.innerText = dev.lastActiveTime ? dev.lastActiveTime.slice(11, 19) : '在线';
    }
    if (speedEl) {
      speedEl.innerText = '0.0 km/h';
      speedEl.style.color = '#94a3b8';
    }
  }
}

const CHROMA_STOPS = [
  { v: 0,  r: 51,  g: 65,  b: 85,   hex: '#334155', name: '静止' },
  { v: 12, r: 16,  g: 185, b: 129, hex: '#10b981', name: '缓行' },
  { v: 28, r: 0,   g: 240, b: 255, hex: '#00f0ff', name: '巡航' },
  { v: 45, r: 245, g: 158, b: 11,  hex: '#f59e0b', name: '畅行' },
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
  // #ifdef MP-WEIXIN
  return;
  // #endif
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

  // 1. 底板纯净深黑填充，提供夜空呼吸感
  ctx.fillStyle = '#060a17';
  ctx.fillRect(0, 0, w, h);

  if (!TRACK_POINTS.length) return;
  const numPoints = TRACK_POINTS.length;

  // 2. 点位波高归一化（静止 3px 微芒，飞驰最高占据 (h - 5)）
  const pts: { x: number; y: number; speed: number }[] = [];
  const BASELINE_H = 3;
  const MAX_WAVE_H = h - 5;
  const sMs = isViewportActive && viewportSpanMs > 0 ? viewportStartMs : (TRACK_POINTS[0].timestamp < 1e11 ? TRACK_POINTS[0].timestamp * 1000 : TRACK_POINTS[0].timestamp);
  const eMs = isViewportActive && viewportSpanMs > 0 ? viewportEndMs : (TRACK_POINTS[numPoints - 1].timestamp < 1e11 ? TRACK_POINTS[numPoints - 1].timestamp * 1000 : TRACK_POINTS[numPoints - 1].timestamp);
  const curSpan = Math.max(1000, eMs - sMs);

  for (let i = 0; i < numPoints; i++) {
    const t = TRACK_POINTS[i].timestamp < 1e11 ? TRACK_POINTS[i].timestamp * 1000 : TRACK_POINTS[i].timestamp;
    const x = isViewportActive ? ((t - sMs) / curSpan) * w : (numPoints > 1 ? (i / (numPoints - 1)) * w : w / 2);
    const sp = TRACK_POINTS[i].speed || 0;
    const waveH = BASELINE_H + Math.min(1, sp / 65) * (MAX_WAVE_H - BASELINE_H);
    const y = h - waveH;
    pts.push({ x, y, speed: sp });
  }

  // 检查是否为纯静止状态 (maxSpeed === 0)
  let maxSp = 0;
  for (let i = 0; i < numPoints; i++) {
    if (TRACK_POINTS[i].speed > maxSp) maxSp = TRACK_POINTS[i].speed;
  }

  if (maxSp === 0) {
    // 原地静止驻留态：绘制 8px 青蓝微光平稳能量带，居中标注文字
    const dwellGrad = ctx.createLinearGradient(0, h - 10, 0, h);
    dwellGrad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
    dwellGrad.addColorStop(1, 'rgba(0, 240, 255, 0.08)');
    ctx.fillStyle = dwellGrad;
    ctx.fillRect(0, h - 10, w, 10);

    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.fillRect(0, h - 2, w, 2);

    ctx.save();
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏱️ 原地静止驻留 · 0.0 km/h', w / 2, h / 2 - 2);
    ctx.restore();
    return;
  }

  // 3. 全局横向速度色谱渐变
  const speedGradient = ctx.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i < numPoints; i++) {
    const stop = numPoints > 1 ? i / (numPoints - 1) : 0;
    speedGradient.addColorStop(stop, getContinuousSpeedColor(TRACK_POINTS[i].speed).rgb);
  }

  // 4. 贝塞尔速度山脉实体填充（仅填充在波峰下方闭合区域，上方全透黑底）
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

  // 5. 纵向玻璃微光叠加 (Overlay)，消除死板色块，呈现液态通透质感
  const verticalLight = ctx.createLinearGradient(0, 0, 0, h);
  verticalLight.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
  verticalLight.addColorStop(0.4, 'rgba(255, 255, 255, 0.1)');
  verticalLight.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = verticalLight;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fill();
  ctx.restore();

  // 6. 纯白带青色霓虹发光的波峰脊线 (Crest Line)
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

  // 7. 贴底极细 2px 彩色基线（物理基准，避免底部完全空白脱节）
  ctx.fillStyle = speedGradient;
  ctx.fillRect(0, h - 2, w, 2);
}

let masterMode = 'live';
let isPlaying = false;
let playTimer: any = null;
let playSpeed = 1;

let rangeStart = 0.0;
let rangeEnd = 100.0;

let committedPlayhead = 100;
let isHovering = false;
let isDragging = false;

// ==================== 视口时序模型与双向联动状态 (0017 & 0018) ====================
let viewportStartMs = 0;
let viewportEndMs = 0;
let viewportSpanMs = 0;
let isViewportActive = false; // 是否处于视口缩放/平移激活态
let isApplyingScope = false;  // 宏观下发防级联死循环锁

// 移动端策略 A 触控状态
let touchMode: 'scrub' | 'pan' | 'pinch' | null = null;
let initialPinchDist = 0;
let touchStartClientX = 0;
let snapTimeout: any = null;
const DRAG_SLOP_PX = 4;

// PC 端游标拖拽与平移状态
let activePointerAction: 'scrub' | 'pan' | null = null;
let panStartClientX = 0;

function initViewportFromTrackPoints() {
  if (!TRACK_POINTS.length) {
    const now = Date.now();
    viewportStartMs = now - 2 * 3600 * 1000;
    viewportEndMs = now;
    viewportSpanMs = 2 * 3600 * 1000;
    isViewportActive = false;
    notifyViewportChanged(viewportStartMs, viewportEndMs);
    return;
  }
  const pFirst = TRACK_POINTS[0];
  const pLast = TRACK_POINTS[TRACK_POINTS.length - 1];
  const tS = pFirst.timestamp < 1e11 ? pFirst.timestamp * 1000 : pFirst.timestamp;
  const tE = pLast.timestamp < 1e11 ? pLast.timestamp * 1000 : pLast.timestamp;
  viewportStartMs = tS;
  viewportEndMs = Math.max(tE, tS + 15 * 60 * 1000);
  viewportSpanMs = viewportEndMs - viewportStartMs;
  isViewportActive = false;
  notifyViewportChanged(viewportStartMs, viewportEndMs);
}

function getTrackPointAtViewportPercent(percent: number): { pt: any; idx: number } {
  if (!TRACK_POINTS.length) return { pt: null, idx: 0 };
  if (!isViewportActive || viewportSpanMs <= 0) {
    const idx = Math.max(0, Math.min(TRACK_POINTS.length - 1, Math.floor((percent / 100) * (TRACK_POINTS.length - 1))));
    return { pt: TRACK_POINTS[idx], idx };
  }
  const targetTimeMs = viewportStartMs + (percent / 100) * viewportSpanMs;
  let low = 0;
  let high = TRACK_POINTS.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const rawT = TRACK_POINTS[mid].timestamp;
    const midTime = rawT < 1e11 ? rawT * 1000 : rawT;
    if (midTime < targetTimeMs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const idx1 = Math.max(0, Math.min(TRACK_POINTS.length - 1, high));
  const idx2 = Math.max(0, Math.min(TRACK_POINTS.length - 1, low));
  const p1 = TRACK_POINTS[idx1];
  const p2 = TRACK_POINTS[idx2];
  const t1 = p1.timestamp < 1e11 ? p1.timestamp * 1000 : p1.timestamp;
  const t2 = p2.timestamp < 1e11 ? p2.timestamp * 1000 : p2.timestamp;
  const chosenIdx = Math.abs(t1 - targetTimeMs) < Math.abs(t2 - targetTimeMs) ? idx1 : idx2;
  return { pt: TRACK_POINTS[chosenIdx], idx: chosenIdx };
}

function shiftTimeWindow(deltaMs: number) {
  if (!TRACK_POINTS.length) return;
  isViewportActive = true;
  const span = viewportSpanMs;
  let newStart = viewportStartMs + deltaMs;
  let newEnd = viewportEndMs + deltaMs;
  const maxEnd = Date.now() + 60_000;
  const minStart = Date.now() - 90 * 86400_000;

  if (newEnd > maxEnd) {
    newEnd = maxEnd;
    newStart = newEnd - span;
  }
  if (newStart < minStart) {
    newStart = minStart;
    newEnd = newStart + span;
  }
  viewportStartMs = newStart;
  viewportEndMs = newEnd;
  viewportSpanMs = viewportEndMs - viewportStartMs;

  drawSpeedWaveCanvas();
  updateTimelineScaleTicks();
  renderStateAtPosition(committedPlayhead, false);
  notifyViewportChanged(viewportStartMs, viewportEndMs);
}

function zoomTimeWindow(zoomFactor: number, centerRatio: number) {
  if (!TRACK_POINTS.length) return;
  isViewportActive = true;
  const currentSpan = viewportSpanMs;
  let newSpan = currentSpan * zoomFactor;

  const MIN_SPAN_MS = 15 * 60 * 1000; // 最小 15 分钟
  const MAX_SPAN_MS = 7 * 86400 * 1000; // 最大 7 天
  if (newSpan < MIN_SPAN_MS) newSpan = MIN_SPAN_MS;
  if (newSpan > MAX_SPAN_MS) newSpan = MAX_SPAN_MS;

  const centerMs = viewportStartMs + currentSpan * centerRatio;
  let newStart = centerMs - newSpan * centerRatio;
  let newEnd = centerMs + newSpan * (1 - centerRatio);

  const maxEnd = Date.now() + 60_000;
  const minStart = Date.now() - 90 * 86400_000;
  if (newEnd > maxEnd) {
    newEnd = maxEnd;
    newStart = newEnd - newSpan;
  }
  if (newStart < minStart) {
    newStart = minStart;
    newEnd = newStart + newSpan;
  }

  viewportStartMs = newStart;
  viewportEndMs = newEnd;
  viewportSpanMs = viewportEndMs - viewportStartMs;

  drawSpeedWaveCanvas();
  updateTimelineScaleTicks();
  renderStateAtPosition(committedPlayhead, false);
  notifyViewportChanged(viewportStartMs, viewportEndMs);
}

let rAFViewportUpdatePending = false;
function notifyViewportChanged(startMs: number, endMs: number) {
  if (rAFViewportUpdatePending || isApplyingScope) return;
  rAFViewportUpdatePending = true;
  requestAnimationFrame(() => {
    rAFViewportUpdatePending = false;
    const label = document.getElementById('current-range-label');

    if (!isViewportActive) {
      const mapNames: Record<string, string> = {
        'today': '今日',
        'yesterday': '昨日',
        '3d': '近3天',
        '7d': '近7天',
        '30d': '近30天',
        '90d': '近90天',
      };
      const text = mapNames[currentMacroScope] || '近90天';
      timelineDisplay.currentRangeLabel = text;
      if (label) label.innerText = text;
      return;
    }

    const dS = new Date(startMs);
    const dE = new Date(endMs);
    const isSameDay = dS.toDateString() === dE.toDateString();
    const pad = (n: number) => String(n).padStart(2, '0');
    const hmS = `${pad(dS.getHours())}:${pad(dS.getMinutes())}`;
    const hmE = `${pad(dE.getHours())}:${pad(dE.getMinutes())}`;

    let text = '';
    if (isSameDay) {
      const m = pad(dS.getMonth() + 1);
      const d = pad(dS.getDate());
      const isToday = dS.toDateString() === new Date().toDateString();
      const prefix = isToday ? '今日' : `${m}-${d}`;
      text = `${prefix} ${hmS}~${hmE}`;
    } else {
      const mS = pad(dS.getMonth() + 1);
      const dSStr = pad(dS.getDate());
      const mE = pad(dE.getMonth() + 1);
      const dEStr = pad(dE.getDate());
      text = `${mS}-${dSStr} ~ ${mE}-${dEStr}`;
    }
    timelineDisplay.currentRangeLabel = text;
    if (label) label.innerText = text;
  });
}

function snapToLatestRealtime() {
  if (masterMode !== 'live' || !TRACK_POINTS.length) return;
  committedPlayhead = 100;
  isHovering = false;
  isViewportActive = false;
  initViewportFromTrackPoints();
  drawSpeedWaveCanvas();
  updateTimelineScaleTicks();

  const playheadNeedle = document.getElementById('playhead-needle');
  if (playheadNeedle) {
    playheadNeedle.style.transition = 'left 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
    playheadNeedle.style.left = '100%';
    setTimeout(() => {
      if (playheadNeedle) playheadNeedle.style.transition = '';
    }, 250);
  }
  renderStateAtPosition(100, false);
  const btnLiveSnap = document.getElementById('btn-live-snap');
  if (btnLiveSnap) btnLiveSnap.classList.add('hidden');
}

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

async function selectMacroPreset(preset: string) {
  const popover = document.getElementById('date-range-popover');
  if (popover) popover.classList.add('hidden');

  isApplyingScope = true;
  isViewportActive = false;
  currentMacroScope = preset;
  document.querySelectorAll('.macro-chip').forEach(b => {
    b.className = 'macro-chip py-1 text-center rounded-lg bg-cyber-900 text-slate-300 border border-white/5 hover:border-cyber-primary/60 hover:text-white transition cursor-pointer active:scale-95';
  });
  const activeBtn = document.getElementById('macro-btn-' + preset);
  if (activeBtn) {
    activeBtn.className = 'macro-chip py-1 text-center rounded-lg bg-cyber-primary/20 text-cyber-primary border border-cyber-primary/40 font-bold transition cursor-pointer active:scale-95';
  }

  const label = document.getElementById('current-range-label');
  if (label) {
    if (preset === 'today') label.innerText = '今日';
    else if (preset === 'yesterday') label.innerText = '昨日';
    else if (preset === '3d') label.innerText = '近3天';
    else if (preset === '7d') label.innerText = '近7天';
    else if (preset === '30d') label.innerText = '近30天';
    else if (preset === '90d') label.innerText = '近90天';
  }

  await loadTrackDataForScope(preset);

  initViewportFromTrackPoints();
  if (masterMode === 'range') {
    renderRangeTrackOnMap();
  } else {
    renderFullColoredTrackOnMap();
  }
  renderStateAtPosition(committedPlayhead, false);
  updateRangeDOM();
  isApplyingScope = false;
}

async function applyCustomDateRange() {
  const dStart = customDateStart.value || (document.getElementById('input-date-start') as HTMLInputElement)?.value;
  const dEnd = customDateEnd.value || (document.getElementById('input-date-end') as HTMLInputElement)?.value;
  if (!dStart || !dEnd) return;

  const popover = document.getElementById('date-range-popover');
  if (popover) popover.classList.add('hidden');

  isApplyingScope = true;
  isViewportActive = false;
  currentMacroScope = 'custom';
  const label = document.getElementById('current-range-label');
  if (label) label.innerText = `${dStart.slice(5)}~${dEnd.slice(5)}`;
  await loadTrackDataForScope('custom', dStart, dEnd);

  initViewportFromTrackPoints();
  if (masterMode === 'range') {
    renderRangeTrackOnMap();
  } else {
    renderFullColoredTrackOnMap();
  }
  renderStateAtPosition(committedPlayhead, false);
  updateRangeDOM();
  isApplyingScope = false;
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

function getPointStateInfo(idx: number) {
  if (!TRACK_POINTS.length || idx < 0 || idx >= TRACK_POINTS.length) {
    return { type: 'dwell', label: '⏱️ 原地静止', color: '#38bdf8', isOffline: false };
  }
  const pt = TRACK_POINTS[idx];

  // 1. 正常位移移动
  if (pt.speed && pt.speed > 3) {
    const sColor = getContinuousSpeedColor(pt.speed);
    return { type: 'moving', label: `${pt.speed.toFixed(1)} km/h`, color: sColor.hex, isOffline: false };
  }

  // 2. 正常静止驻留 (速度为 0 或微小抖动)
  return { type: 'dwell', label: '⏱️ 原地静止', color: '#38bdf8', isOffline: false };
}

function renderStateAtPosition(percent: number, isPreview = false) {
  if (!TRACK_POINTS.length) return;
  const { pt, idx } = getTrackPointAtViewportPercent(percent);
  if (!pt) return;
  const sColor = getContinuousSpeedColor(pt.speed);
  const stInfo = getPointStateInfo(idx);

  if (!isPreview) {
    const playheadNeedle = document.getElementById('playhead-needle');
    if (playheadNeedle) playheadNeedle.style.left = percent + '%';
    const dot = document.getElementById('playhead-inner-dot');
    if (dot) dot.style.backgroundColor = stInfo.color;

    const liveTime = document.getElementById('live-latest-time');
    if (liveTime && pt.timeStr) liveTime.innerText = pt.timeStr.slice(11, 19);
    const liveSpeed = document.getElementById('live-latest-speed');
    if (liveSpeed) {
      const sp = typeof pt.speed === 'number' ? pt.speed : 0;
      liveSpeed.innerText = sp > 0 ? `${sp.toFixed(1)} km/h` : '0.0 km/h';
      liveSpeed.style.color = stInfo.type === 'moving' ? sColor.hex : '#94a3b8';
    }

    const spVal = typeof pt.speed === 'number' ? pt.speed : 0;
    timelineDisplay.liveLatestSpeed = spVal > 0 ? `${spVal.toFixed(1)} km/h` : '0.0 km/h';
    timelineDisplay.speedTagColor = stInfo.type === 'moving' ? sColor.hex : '#94a3b8';
    if (pt.timeStr) timelineDisplay.liveLatestTime = pt.timeStr.slice(11, 19);

    const drawerSpeed = document.getElementById('drawer-speed-badge');
    if (drawerSpeed) {
      const sp = typeof pt.speed === 'number' ? pt.speed : 0;
      drawerSpeed.innerText = sp > 0 ? `${sp.toFixed(1)} km/h` : '0.0 km/h';
    }

    const timeBox = document.getElementById('current-point-time');
    if (timeBox && pt.timeStr) timeBox.innerText = pt.isMultiDay ? pt.timeStr.slice(5, 16) : pt.timeStr.slice(11, 16);

    const speedTag = document.getElementById('current-speed-tag');
    if (speedTag) {
      if (stInfo.type === 'offline') {
        speedTag.style.backgroundColor = 'rgba(225, 29, 72, 0.25)';
        speedTag.style.borderColor = 'rgba(244, 63, 94, 0.7)';
        speedTag.style.color = '#fda4af';
        speedTag.innerText = '📡 信号中断 · 盲区';
      } else if (stInfo.type === 'dwell') {
        speedTag.style.backgroundColor = 'rgba(14, 116, 144, 0.28)';
        speedTag.style.borderColor = 'rgba(56, 189, 248, 0.6)';
        speedTag.style.color = '#38bdf8';
        speedTag.innerText = '⏱️ 原地静止 · 0 km/h';
      } else {
        speedTag.style.backgroundColor = sColor.rgba(0.25);
        speedTag.style.borderColor = sColor.rgba(0.65);
        speedTag.style.color = sColor.hex;
        speedTag.innerText = `🧭 移动中 · ${pt.speed} km/h`;
      }
    }

    // 同步地图上车辆标点位置，实现滑块拖拽平滑跟跑
    if ((window as any).__vehicleMarker && typeof TMap !== 'undefined' && typeof pt.lat === 'number' && typeof pt.lng === 'number') {
      const pos = new TMap.LatLng(pt.lat, pt.lng);
          // #ifdef MP-WEIXIN
    if (typeof pt.lat === 'number' && typeof pt.lng === 'number') {
      wxMarkers.value = [{
        id: 1,
        latitude: pt.lat,
        longitude: pt.lng,
        width: 32,
        height: 32
      }];
    }
    // #endif
(window as any).__vehicleMarker.setGeometries([{
        id: 'v1',
        styleId: 'car_icon',
        position: pos,
        properties: { title: `${pt.speed} km/h` }
      }]);
    }
  }

  if (typeof pt.lat === 'number' && typeof pt.lng === 'number') {
    const cText = `${pt.lat.toFixed(4)}°N, ${pt.lng.toFixed(4)}°E`;
    activeTelemetry.coordsText = cText;
    const elCoord = document.getElementById('drawer-coord-text');
    if (elCoord) elCoord.innerText = cText;
    const elCoordDetail = document.getElementById('drawer-coord-detail');
    if (elCoordDetail) elCoordDetail.innerText = cText;
    const elTagCoord = document.getElementById('tel-tag-coords');
    if (elTagCoord) elTagCoord.innerText = cText;
  }
  
  const spText = stInfo.type === 'moving' ? `${pt.speed} km/h` : stInfo.label;
  activeTelemetry.speedText = spText;
  activeTelemetry.speedColor = stInfo.color;
  const drawerSpeed = document.getElementById('drawer-speed-badge');
  if (drawerSpeed) {
    drawerSpeed.style.backgroundColor = sColor.rgba(0.2);
    drawerSpeed.style.color = stInfo.color;
    drawerSpeed.innerText = spText;
  }
  const telSpeed = document.getElementById('tel-tag-speed');
  if (telSpeed) {
    telSpeed.style.color = stInfo.color;
    telSpeed.innerText = spText;
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
  if (isDragging || activePointerAction || !TRACK_POINTS.length) return;

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
  const stInfo = getPointStateInfo(idx);

  const bubbleTime = pt.isMultiDay ? pt.timeStr.slice(5, 16) : pt.timeStr.slice(11, 19);
  const elBTime = document.getElementById('hover-bubble-time');
  if (elBTime) elBTime.innerText = bubbleTime;
  const speedBubble = document.getElementById('hover-bubble-speed');
  if (speedBubble) {
    speedBubble.innerText = stInfo.label;
    speedBubble.style.color = stInfo.color;
  }

  renderStateAtPosition(p, true);
}

function onTimelineUserClick(e: MouseEvent) {
  if (isDragging) return;

  const container = document.getElementById('timeline-track-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const p = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));

  committedPlayhead = p;
  isHovering = false;

  const hoverNeedle = document.getElementById('hover-needle');
  if (hoverNeedle) hoverNeedle.classList.add('hidden');
  renderStateAtPosition(committedPlayhead, false);

  if (masterMode === 'live' && p < 98) {
    const btnLiveSnap = document.getElementById('btn-live-snap');
    if (btnLiveSnap) btnLiveSnap.classList.remove('hidden');
  }
}

function onTimelineMouseLeave() {
  if (isDragging || !isHovering) return;
  isHovering = false;

  const hoverNeedle = document.getElementById('hover-needle');
  if (hoverNeedle) hoverNeedle.classList.add('hidden');
  renderStateAtPosition(committedPlayhead, false);

  if (masterMode === 'live' && p < 98) {
    const btnLiveSnap = document.getElementById('btn-live-snap');
    if (btnLiveSnap) btnLiveSnap.classList.remove('hidden');
  }
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
  isPlayingState.value = true;
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
  isPlayingState.value = false;
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

  // ==================== 0017: PC 端滚轮缩放与平移 ====================
  container.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!TRACK_POINTS.length) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const cursorRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    if (e.shiftKey) {
      // Shift + 滚轮：平移时间窗口
      const panStepMs = viewportSpanMs * 0.08 * (e.deltaY > 0 ? 1 : -1);
      shiftTimeWindow(panStepMs);
    } else {
      // 纯滚轮：以光标为中心缩放时间跨度
      const zoomFactor = e.deltaY > 0 ? 1.15 : 0.85;
      zoomTimeWindow(zoomFactor, cursorRatio);
    }
  }, { passive: false });

  // ==================== 0017: PC 端鼠标按住游标拖拽与空白平移 ====================
  let pointerDownTime = 0;
  let pointerDownClientX = 0;

  container.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const target = e.target as HTMLElement;
    if (target.closest('#range-capsule') || target.closest('.handle-hit-zone')) return;

    pointerDownTime = Date.now();
    pointerDownClientX = e.clientX;
    e.stopPropagation();

    const playheadNeedle = document.getElementById('playhead-needle');
    const needleRect = playheadNeedle?.getBoundingClientRect();
    const isNearNeedle = needleRect && Math.abs(e.clientX - (needleRect.left + needleRect.width / 2)) <= 36;

    if (isNearNeedle) {
      activePointerAction = 'scrub';
    } else {
      activePointerAction = 'pan';
      panStartClientX = e.clientX;
    }
    try { (container as HTMLElement).setPointerCapture(e.pointerId); } catch (err) {}
  });

  container.addEventListener('pointermove', (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !activePointerAction) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;

    if (activePointerAction === 'scrub') {
      const p = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      committedPlayhead = p;
      renderStateAtPosition(p, false);

      if (masterMode === 'live') {
        const btnLiveSnap = document.getElementById('btn-live-snap');
        if (btnLiveSnap) btnLiveSnap.classList.remove('hidden');
      }
    } else if (activePointerAction === 'pan') {
      const deltaX = e.clientX - panStartClientX;
      panStartClientX = e.clientX;
      const dtMs = -(deltaX / rect.width) * viewportSpanMs;
      shiftTimeWindow(dtMs);
    }
  });

  const onPointerUpGlobal = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !activePointerAction) return;
    try { (container as HTMLElement).releasePointerCapture(e.pointerId); } catch (err) {}

    const clickDuration = Date.now() - pointerDownTime;
    const clickDist = Math.abs(e.clientX - pointerDownClientX);
    if (clickDuration < 300 && clickDist < 6) {
      const rect = container.getBoundingClientRect();
      const p = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      committedPlayhead = p;
      renderStateAtPosition(committedPlayhead, false);

      if (masterMode === 'live' && p < 98) {
        const btnLiveSnap = document.getElementById('btn-live-snap');
        if (btnLiveSnap) btnLiveSnap.classList.remove('hidden');
      }
    }
    activePointerAction = null;
  };
  container.addEventListener('pointerup', onPointerUpGlobal);
  container.addEventListener('pointercancel', onPointerUpGlobal);

  // ==================== 0017: 鼠标悬停与移开自愈吸附 ====================
  container.addEventListener('mousemove', onTimelineMouseMove);
  container.addEventListener('mouseleave', () => {
    if (isDragging || activePointerAction) return;
    isHovering = false;
    const hoverNeedle = document.getElementById('hover-needle');
    if (hoverNeedle) hoverNeedle.classList.add('hidden');

    // 鼠标移出时消除悬停预览，还原为用户已确认的播放点位
    renderStateAtPosition(committedPlayhead, false);
  });

  // ==================== 0017: 移动端【策略 A】触控手势管线 ====================
  container.addEventListener('touchstart', (e: TouchEvent) => {
    const target = e.target as HTMLElement;
    if (isDragging || target.closest('#range-capsule') || target.closest('.handle-hit-zone')) return;

    const playheadNeedle = document.getElementById('playhead-needle');
    if (playheadNeedle) playheadNeedle.style.transition = '';

    if (snapTimeout) {
      clearTimeout(snapTimeout);
      snapTimeout = null;
    }

    e.stopPropagation();

    // 1. 双指手势 -> 缩放时间窗口 (Pinch to Zoom)
    if (e.touches.length === 2) {
      touchMode = 'pinch';
      initialPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      e.preventDefault();
      return;
    }

    // 2. 单指手势 -> 按住游标拖拽 vs 空白轨身平移
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartClientX = touch.clientX;
      const needleRect = playheadNeedle?.getBoundingClientRect();
      const isNearNeedle = needleRect && Math.abs(touch.clientX - (needleRect.left + needleRect.width / 2)) <= 36;

      if (isNearNeedle) {
        touchMode = 'scrub';
      } else {
        touchMode = 'pan';
      }
    }
  }, { passive: false });

  container.addEventListener('touchmove', (e: TouchEvent) => {
    if (!touchMode) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;

    if (touchMode === 'pinch' && e.touches.length === 2) {
      const curDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (Math.abs(curDist - initialPinchDist) > DRAG_SLOP_PX) {
        const factor = initialPinchDist / curDist;
        zoomTimeWindow(factor, 0.5);
        initialPinchDist = curDist;
      }
    } else if (touchMode === 'scrub' && e.touches.length === 1) {
      const x = e.touches[0].clientX;
      const p = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
      committedPlayhead = p;
      renderStateAtPosition(p, false);

      if (masterMode === 'live') {
        const btnLiveSnap = document.getElementById('btn-live-snap');
        if (btnLiveSnap) btnLiveSnap.classList.remove('hidden');
      }
    } else if (touchMode === 'pan' && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - touchStartClientX;
      if (Math.abs(deltaX) > DRAG_SLOP_PX) {
        touchStartClientX = e.touches[0].clientX;
        const dtMs = -(deltaX / rect.width) * viewportSpanMs;
        shiftTimeWindow(dtMs);
      }
    }
  }, { passive: false });

  container.addEventListener('touchend', (e: TouchEvent) => {
    if (!touchMode) return;
    e.stopPropagation();
    touchMode = null;

    if (masterMode === 'live') {
      const btnLiveSnap = document.getElementById('btn-live-snap');
      if (btnLiveSnap) btnLiveSnap.classList.remove('hidden');

      snapTimeout = setTimeout(() => {
        snapToLatestRealtime();
      }, 1500);
    }
  });
}

function renderFullColoredTrackOnMap() {
  // #ifndef MP-WEIXIN
  if (!(window as any).__map || !(window as any).__trackLines || !TRACK_POINTS.length) return;
  // #endif
  // #ifdef MP-WEIXIN
  if (!TRACK_POINTS.length) return;
  // #endif
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
    (window as any).__trackLines.setGeometries([]);
    // #ifdef MP-WEIXIN
    wxPolylines.value = [];
    const pCenterWx = TRACK_POINTS[Math.floor(numPoints / 2)];
    wxCircles.value = [{
      latitude: pCenterWx.lat,
      longitude: pCenterWx.lng,
      radius: 35,
      color: 'rgba(0, 240, 255, 0.75)',
      fillColor: 'rgba(0, 240, 255, 0.18)',
      strokeWidth: 1.5
    }];
    // #endif
    if ((window as any).__stationaryCircle) {
      const pCenter = TRACK_POINTS[Math.floor(numPoints / 2)];
      (window as any).__stationaryCircle.setGeometries([{
        id: 'dwell_circle',
        center: new TMap.LatLng(pCenter.lat, pCenter.lng),
        radius: 35,
        styleId: 'dwell_style'
      }]);
    }
    return;
  }

  if ((window as any).__stationaryCircle) {
    (window as any).__stationaryCircle.setGeometries([]);
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

  // #ifdef MP-WEIXIN
  wxCircles.value = [];
  wxPolylines.value = [{
    points: TRACK_POINTS.map(p => ({ latitude: p.lat, longitude: p.lng })),
    color: '#00f0ff',
    width: 6,
    arrowLine: true
  }];
  if (TRACK_POINTS.length > 0) {
    const lastP = TRACK_POINTS[TRACK_POINTS.length - 1];
    wxMarkers.value = [{
      id: 1,
      latitude: lastP.lat,
      longitude: lastP.lng,
      width: 32,
      height: 32
    }];
  }
  // #endif
  (window as any).__trackLines.setGeometries([{
    id: 'track_rainbow',
    styleId: 'rainbow_style',
    rainbowPaths: rainbowPaths
  }]);
}

function renderRangeTrackOnMap() {
  // #ifndef MP-WEIXIN
  if (!(window as any).__map || !(window as any).__trackLines || !TRACK_POINTS.length) return;
  // #endif
  // #ifdef MP-WEIXIN
  if (!TRACK_POINTS.length) return;
  // #endif
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
    // #ifdef MP-WEIXIN
    wxPolylines.value = [];
    const pCenterWx = TRACK_POINTS[Math.floor((idxStart + idxEnd) / 2)];
    wxCircles.value = [{
      latitude: pCenterWx.lat,
      longitude: pCenterWx.lng,
      radius: 35,
      color: 'rgba(0, 240, 255, 0.75)',
      fillColor: 'rgba(0, 240, 255, 0.18)',
      strokeWidth: 1.5
    }];
    // #endif
    if ((window as any).__stationaryCircle) {
      const pCenter = TRACK_POINTS[Math.floor((idxStart + idxEnd) / 2)];
      (window as any).__stationaryCircle.setGeometries([{
        id: 'dwell_circle',
        center: new TMap.LatLng(pCenter.lat, pCenter.lng),
        radius: 35,
        styleId: 'dwell_style'
      }]);
    }
    return;
  }

  if ((window as any).__stationaryCircle) {
    (window as any).__stationaryCircle.setGeometries([]);
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

  // #ifdef MP-WEIXIN
  wxCircles.value = [];
  wxPolylines.value = [{
    points: TRACK_POINTS.map(p => ({ latitude: p.lat, longitude: p.lng })),
    color: '#00f0ff',
    width: 6,
    arrowLine: true
  }];
  if (TRACK_POINTS.length > 0) {
    const lastP = TRACK_POINTS[TRACK_POINTS.length - 1];
    wxMarkers.value = [{
      id: 1,
      latitude: lastP.lat,
      longitude: lastP.lng,
      width: 32,
      height: 32
    }];
  }
  // #endif
    // #ifdef MP-WEIXIN
  wxCircles.value = [];
  const rangePts = TRACK_POINTS.slice(idxStart, idxEnd + 1);
  wxPolylines.value = [{
    points: rangePts.map(p => ({ latitude: p.lat, longitude: p.lng })),
    color: '#00f0ff',
    width: 6,
    arrowLine: true
  }];
  if (rangePts.length > 0) {
    const curP = rangePts[Math.min(playheadIdx, rangePts.length - 1)];
    wxMarkers.value = [{
      id: 1,
      latitude: curP.lat,
      longitude: curP.lng,
      width: 32,
      height: 32
    }];
  }
  // #endif
(window as any).__trackLines.setGeometries([{
    id: 'track_rainbow',
    styleId: 'rainbow_style',
    rainbowPaths: rainbowPaths
  }]);
}

const mobileSheetState = ref<'peek' | 'half' | 'full'>('peek');

function setMobileSheetState(state: 'peek' | 'half' | 'full') {
  mobileSheetState.value = state;
  // #ifndef MP-WEIXIN
  const drawer = document.getElementById('inspector-drawer');
  const chevron = document.getElementById('icon-sheet-chevron');
  if (!drawer) return;

  drawer.classList.remove('sheet-peek', 'sheet-half', 'sheet-full');
  drawer.classList.add('sheet-' + state);

  if (chevron) {
    if (state === 'peek' || state === 'half') {
      chevron.setAttribute('data-lucide', 'chevron-up');
    } else if (state === 'full') {
      chevron.setAttribute('data-lucide', 'chevron-down');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
  // #endif
}

const drawerDynamicStyle = computed(() => {
  // #ifndef MP-WEIXIN
  if (typeof window !== 'undefined' && window.innerWidth >= 768) {
    return '';
  }
  // #endif
  if (mobileSheetState.value === 'peek') {
    return 'height: calc(74px + env(safe-area-inset-bottom, 0px)) !important; overflow: hidden !important;';
  } else if (mobileSheetState.value === 'half') {
    return 'height: 48vh !important; overflow: hidden !important;';
  } else {
    return 'height: 86vh !important; overflow: hidden !important;';
  }
});

let sheetTouchStartY = 0;
function onSheetTouchStart(e: any) {
  // #ifndef MP-WEIXIN
  if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
  // #endif
  const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (touch) {
    sheetTouchStartY = touch.clientY;
  }
}

function onSheetTouchEnd(e: any) {
  // #ifndef MP-WEIXIN
  if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
  // #endif
  const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  if (!touch) return;
  const deltaY = touch.clientY - sheetTouchStartY;
  if (Math.abs(deltaY) > 25) {
    if (deltaY < -25) {
      if (mobileSheetState.value === 'peek') setMobileSheetState('half');
      else if (mobileSheetState.value === 'half') setMobileSheetState('full');
    } else if (deltaY > 25) {
      if (mobileSheetState.value === 'full') setMobileSheetState('half');
      else if (mobileSheetState.value === 'half') setMobileSheetState('peek');
    }
  }
}

function cycleMobileSheet() {
  // #ifndef MP-WEIXIN
  if (typeof window !== 'undefined' && window.innerWidth >= 768) return;
  // #endif
  if (mobileSheetState.value === 'peek') setMobileSheetState('half');
  else if (mobileSheetState.value === 'half') setMobileSheetState('full');
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

let isDockOpen = true;
function toggleDeviceDock() {
  if (window.innerWidth < 768) return;
  isDockOpen = !isDockOpen;
  const dock = document.getElementById('device-dock');
  const btnExpand = document.getElementById('btn-dock-expand');
  if (dock) {
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
  if (btnExpand) {
    if (isDockOpen) {
      btnExpand.classList.add('hidden');
      btnExpand.classList.remove('flex');
    } else {
      btnExpand.classList.remove('hidden');
      btnExpand.classList.add('flex');
    }
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
  const btnExpand = document.getElementById('btn-inspector-expand');
  if (drawer) {
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
  if (btnExpand) {
    if (isInspectorOpen) {
      btnExpand.classList.add('hidden');
      btnExpand.classList.remove('flex');
    } else {
      btnExpand.classList.remove('hidden');
      btnExpand.classList.add('flex');
    }
  }
}

function toggleOfficialModal(forceOpen?: boolean) {
  const willOpen = forceOpen !== undefined ? forceOpen : !showAccountModal.value;
  showAccountModal.value = willOpen;
  if (willOpen) {
    refreshAccountStates();
    runSequentialHealthProbe();
  }
}

async function submitTokenForExchange(rawText?: string) {
  if (isMpExchangingToken.value) return;

  const raw = (rawText !== undefined ? rawText : mpManualTokenText.value).trim();
  const cleanToken = apiClient.extractToken(raw);

  if (!cleanToken || cleanToken.length < 60) {
    showToast('未能提取到有效 Token，请确认已复制', 'warn', 2500);
    showMpManualInput.value = true;
    return;
  }

  isMpExchangingToken.value = true;
  showToast('正在验证凭据...', 'info', 2000);

  try {
    const pending = apiClient.consumePendingAccount() || apiClient.getActivePhone();
    const result = await apiClient.exchangeOAuthToken(cleanToken, pending);
    if (result.ok) {
      consumedTokens.add(cleanToken);
      showToast('✓ 账号授权绑定成功！', 'success', 3000);
      closeMpOAuthGuide();
      showAccountModal.value = false;
      await refreshAccountStates();
      await loadRealDevices();
    } else {
      // 现场保全：绝不关闭弹窗，展开手动输入框，保留当前文本供用户修改或重试
      showMpManualInput.value = true;
      mpManualTokenText.value = cleanToken;
      showToast(result.message || '换票失败，请检查网络或重新复制', 'error', 3500);
    }
  } catch (e: any) {
    showMpManualInput.value = true;
    showToast(e?.message || '网络连接异常，请重试', 'error', 3500);
  } finally {
    isMpExchangingToken.value = false;
  }
}

function handleMpPasteAndExchange() {
  if (isMpExchangingToken.value) return;

  // #ifdef MP-WEIXIN
  uni.getClipboardData({
    success: (res) => {
      const raw = (res.data || '').trim();
      const clean = apiClient.extractToken(raw);
      if (clean && clean.length >= 60) {
        submitTokenForExchange(clean);
      } else {
        // 剪贴板中无有效 Token 或格式不符，优雅平滑展开手动输入框
        showMpManualInput.value = true;
        if (raw) {
          mpManualTokenText.value = raw;
        }
        showToast('剪贴板未检测到有效 Token，请手动粘贴', 'warn', 2500);
      }
    },
    fail: () => {
      // 权限受限或系统读取失败，平滑降级至展开手动输入框
      showMpManualInput.value = true;
      showToast('无法读取剪贴板，请在此长按粘贴', 'info', 2500);
    }
  });
  // #endif

  // #ifndef MP-WEIXIN
  showMpManualInput.value = true;
  // #endif
}

function checkClipboardToken() {
  // #ifdef MP-WEIXIN
  if (awaitingOAuthSince.value <= 0 || isMpExchangingToken.value) return;
  const elapsed = Date.now() - awaitingOAuthSince.value;
  if (elapsed > OAUTH_AWAIT_TIMEOUT_MS) {
    awaitingOAuthSince.value = 0;
    showMpOAuthGuide.value = false;
    return;
  }

  uni.getClipboardData({
    success: (res) => {
      const raw = (res.data || '').trim();
      const cleanToken = apiClient.extractToken(raw);
      if (cleanToken && /^[A-Za-z0-9_\-\.]{60,}$/.test(cleanToken)) {
        if (consumedTokens.has(cleanToken) || ignoredTokens.has(cleanToken)) {
          return;
        }
        uni.showModal({
          title: '检测到授权凭据',
          content: '检测到您刚刚复制的合宙官方授权凭据，是否立即接入绑定？',
          confirmText: '立即接入',
          confirmColor: '#00f0ff',
          cancelText: '暂不接入',
          success: async (modalRes) => {
            if (modalRes.confirm) {
              await submitTokenForExchange(cleanToken);
            } else {
              ignoredTokens.add(cleanToken);
            }
          }
        });
      }
    }
  });
  // #endif
}

onShow(() => {
  // #ifdef MP-WEIXIN
  checkClipboardToken();
  // #endif
});

function redirectToOfficialOAuth() {
  openOAuthAuthorization();
}

async function syncOfficialData() {
  await loadRealDevices();
  toggleOfficialModal();
}

onMounted(() => {
  // #ifdef MP-WEIXIN
  try {
    const rect = uni.getMenuButtonBoundingClientRect();
    if (rect && rect.bottom) {
      menuButtonRect.value = rect;
      headerTopStyle.value = `top: ${rect.bottom + 28}px !important;`;
      capsuleTopStyle.value = `top: ${rect.bottom + 84}px !important;`;
    }
  } catch (e) {}
  // #endif

  refreshIcons();
  setTimeout(refreshIcons, 100);
  setTimeout(refreshIcons, 500);

  if (typeof window !== 'undefined') {
    (window as any).apiClient = apiClient;
    (window as any).switchAccount = switchAccount;
    (window as any).recenterVehicle = recenterVehicle;
    (window as any).__loadTrackPoints = (pts: any[]) => {
      TRACK_POINTS = pts;
      updateTimelineScaleTicks(pts[0]?.isMultiDay || false);
      drawSpeedWaveCanvas();
      renderStateAtPosition(committedPlayhead, false);
      if (masterMode === 'range') {
        renderRangeTrackOnMap();
      } else {
        renderFullColoredTrackOnMap();
      }
    };
  }

  // 嗅探本地桌面独立守护站 (Desktop Station)
  stationClient.probe().then(async (connected) => {
    isStationConnected.value = connected;
    if (connected) {
      // 成功接入守护站时，立即触发一次守护站本地 SQLite 设备与轨迹刷新
      await loadRealDevices();
      if (activeDeviceId.value) {
        loadTrackDataForScope(masterMode === 'range' ? currentMacroScope : 'recent_window');
      }
      stationClient.subscribe((event) => {
        if (event.type === 'DEVICE_UPDATE' && event.data) {
          // 实时打卡同步
          const d = event.data;
          const idx = accountDevices.value.findIndex(item => item.imei === d.imei);
          if (idx !== -1) {
            accountDevices.value[idx].lat = d.lat;
            accountDevices.value[idx].lng = d.lng;
            accountDevices.value[idx].status = d.is_online ? '在线' : '离线';
          }
        }
      });
    }
  });

  // #ifndef MP-WEIXIN
  // 注册 postMessage 监听器，接收内嵌 iframe 或弹出窗的 OAuth 回调 token（真正零跳转）
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('message', async (event) => {
      if (event.data && event.data.type === 'LUAT_OAUTH_TOKEN' && event.data.token) {
        console.info('[AirTrack] 收到站内 postMessage 授权凭据:', event.data.token);
        closeInPageOAuth();
        const pending = apiClient.consumePendingAccount() || apiClient.getActivePhone();
        showToast(`已获取授权，正在连接账号 ${pending}...`, 'info', 2000);
        const res = await apiClient.exchangeOAuthToken(event.data.token, pending);
        if (res.ok) {
          showToast(`✓ 账号 ${pending} 授权连接成功！`, 'success');
          showAccountModal.value = false;
          refreshAccountStates();
          await loadRealDevices();
        } else {
          showToast('授权连接失败，请重试', 'error');
        }
      }
    });
  }

  // 捕获合宙官方 OAuth 回调 token，并写入「发起登录的那个账号」
  if (typeof window !== 'undefined' && window.location) {
    const searchStr = window.location.search || (window.location.hash?.includes('?') ? window.location.hash.split('?')[1] : '');
    const urlParams = new URLSearchParams(searchStr);
    const oauthToken = urlParams.get('token');
    if (oauthToken) {
      const pending = apiClient.consumePendingAccount() || apiClient.getActivePhone();
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      apiClient.exchangeOAuthToken(oauthToken, pending).then(res => {
        console.info(res.ok ? `[AirTrack] 账号 ${pending} OAuth 授权成功` : `[AirTrack] 账号 ${pending} 授权失败`);
        refreshAccountStates();
        loadRealDevices();
      });
    }
  }
  // #endif

  // 注册 Capacitor 原生深度链接 (Deep Link) 监听器，响应 airtrack://oauth?token=xxx
  if (Capacitor.isNativePlatform()) {
    try {
      CapApp.addListener('appUrlOpen', async (data) => {
        console.info('[AirTrack] 收到原生 Deep Link 唤醒:', data.url);
        try {
          await CapBrowser.close(); // 自动关闭应用内授权悬浮窗
        } catch (e) {}

        if (data.url && (data.url.includes('token=') || data.url.startsWith('airtrack://'))) {
          try {
            const raw = data.url.replace('airtrack://', 'https://dummy.local/');
            const parsed = new URL(raw);
            const oauthToken = parsed.searchParams.get('token');
            if (oauthToken) {
              const pending = apiClient.consumePendingAccount() || apiClient.getActivePhone();
              const res = await apiClient.exchangeOAuthToken(oauthToken, pending);
              console.info(res.ok ? `[AirTrack] DeepLink 账号 ${pending} OAuth 授权成功` : `[AirTrack] DeepLink 授权失败`);
              showAccountModal.value = false;
              refreshAccountStates();
              await loadRealDevices();
            }
          } catch (err) {
            console.error('[AirTrack] 解析 Deep Link 失败:', err);
          }
        }
      });
    } catch (e) {
      console.warn('[AirTrack] 注册 appUrlOpen 监听器失败', e);
    }
  }

  // #ifndef MP-WEIXIN
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', () => {
      drawSpeedWaveCanvas();
    });
  }
  // #endif

  // #ifndef MP-WEIXIN
  try {
    if (typeof TMap !== 'undefined' && typeof document !== 'undefined' && typeof document.getElementById === 'function') {
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
          geometries: [{ id: 'v1', styleId: 'car_icon', position: center, properties: { title: '待连接设备' } }]
        });

        (window as any).__fenceCircle = new TMap.MultiCircle({
          map: map,
          geometries: [{ center: center, radius: 1000, styleId: 'fence' }],
          styles: {
            fence: new TMap.CircleStyle({ color: 'rgba(0, 240, 255, 0.12)', showBorder: true, borderColor: '#00f0ff', borderWidth: 1.5 })
          }
        });

        (window as any).__stationaryCircle = new TMap.MultiCircle({
          map: map,
          geometries: [],
          styles: {
            dwell_style: new TMap.CircleStyle({
              color: 'rgba(0, 240, 255, 0.18)',
              showBorder: true,
              borderColor: 'rgba(0, 240, 255, 0.75)',
              borderWidth: 1.5
            })
          }
        });
      }
    }
  } catch (e) {
    console.warn('Map error:', e);
  }
  // #endif

  // 从合宙官方网关拉取当前账号的真实设备清单
  refreshAccountStates();
  const curAccounts = apiClient.getAccountStates();
  if (curAccounts.length === 0) {
    toggleOfficialModal(true);
  } else {
    setTimeout(() => {
      if (isStationConnected.value) return;
      const anyAuth = apiClient.getAccountStates().some((s: any) => s.hasAuth);
      if (!anyAuth) {
        toggleOfficialModal(true);
      }
      refreshIcons();
    }, 1500);
  }
  loadRealDevices();

  // #ifndef MP-WEIXIN
  setupSilkyTimelineInteractions();
  setupMobileSheetTouchGestures();
  // #endif
  switchMasterMode('live');

  // 全局点击空白处自动收起手机 APP 引导气泡
  const onGlobalClick = () => {
    if (showDownloadPopover.value) {
      showDownloadPopover.value = false;
    }
  };
  // #ifndef MP-WEIXIN
  if (typeof window !== 'undefined') {
    window.addEventListener('click', onGlobalClick);
  }
  // #endif

  setTimeout(() => {
    drawSpeedWaveCanvas();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }, 200);
});

onUnmounted(() => {
  if (playTimer) clearInterval(playTimer);
  if ((window as any).__map) {
    (window as any).__map.destroy();
    (window as any).__map = null;
  }
});
</script>

<style>
/* 跨端通用抽屉与面板类 */
.glass-panel {
  background: rgba(7, 13, 29, 0.92);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.drawer-transition {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.sheet-peek {
  height: calc(74px + env(safe-area-inset-bottom, 0px)) !important;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow: hidden !important;
}

.sheet-half {
  height: 48vh !important;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.sheet-full {
  height: 86vh !important;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* 全局暗黑背景覆盖 */
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  background-color: #030712 !important;
  overflow: hidden;
}

/* 移动端状态栏与安全区适配 (Safe Area Insets) */
/* #ifdef MP-WEIXIN */
.mobile-safe-header {
  top: max(calc(env(safe-area-inset-top, 0px) + 72px), 96px) !important;
}
.map-capsule-safe {
  top: max(calc(env(safe-area-inset-top, 0px) + 140px), 168px) !important;
}
/* #endif */
.mobile-safe-header {
  top: max(calc(env(safe-area-inset-top, 0px) + 8px), 36px);
}
@media (min-width: 768px) {
  .mobile-safe-header {
    top: 12px;
  }
}

.map-capsule-safe {
  top: max(calc(env(safe-area-inset-top, 0px) + 64px), 92px);
}
@media (min-width: 768px) {
  .map-capsule-safe {
    top: 96px;
  }
}

.toast-safe {
  top: max(calc(env(safe-area-inset-top, 0px) + 60px), 88px);
}
@media (min-width: 768px) {
  .toast-safe {
    top: 64px;
  }
}

.timeline-hud-safe {
  position: fixed;
  bottom: calc(96px + env(safe-area-inset-bottom, 0px));
}
@media (min-width: 768px) {
  .timeline-hud-safe {
    bottom: 12px;
  }
}

.mobile-fab-safe {
  bottom: calc(248px + env(safe-area-inset-bottom, 0px));
}

/* 移动端地图右上角控件（指北针与缩放）避让顶部悬浮胶囊栏 */
@media (max-width: 768px) {
  .tmap-control-container,
  .tmap-control-container > div[style*="top"],
  .tmap-zoom-control,
  .tmap-rotate-control,
  .tmap-control-right-top {
    top: calc(env(safe-area-inset-top, 0px) + 92px) !important;
  }
}

/* 渐隐过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -4px);
}
</style>
