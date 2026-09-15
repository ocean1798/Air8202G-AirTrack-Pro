<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="glass-panel max-w-sm w-full p-6 rounded-2xl border border-cyber-primary/40 shadow-glow-cyan relative">
      <button @click="$emit('close')" class="absolute top-4 right-4 text-slate-400 hover:text-white p-1">
        ✕
      </button>

      <div class="text-center">
        <div class="w-10 h-10 rounded-xl bg-cyber-primary/20 border border-cyber-primary text-cyber-primary flex items-center justify-center mx-auto mb-3 shadow-glow-cyan text-lg">
          🔑
        </div>
        <h3 class="text-sm font-bold text-white">评测账号与会话接入</h3>
        <p class="text-xs text-slate-400 mt-1">AirCloud Open API v5 凭据管理</p>
      </div>

      <div class="mt-5 space-y-3">
        <div class="bg-cyber-900/80 p-3 rounded-xl border border-cyber-primary/30 text-xs font-mono space-y-1">
          <div class="text-slate-400">官方在网评测主账号:</div>
          <div class="text-cyber-primary font-bold">账号: 18101796680</div>
          <div class="text-slate-300">密码: Hz8202</div>
          <div class="text-cyber-emerald text-[10px] pt-1">● 5 台真机已全部完成时空对齐</div>
        </div>

        <button
          @click="$emit('close')"
          class="w-full py-2.5 rounded-xl text-xs font-bold bg-cyber-primary text-cyber-950 hover:bg-cyan-300 transition shadow-glow-cyan"
        >
          确认保持连接
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isOpen: boolean;
}>();

defineEmits(['close']);
</script>
