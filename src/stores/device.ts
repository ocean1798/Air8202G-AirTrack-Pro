import { defineStore } from 'pinia';
import type { DeviceInfo } from '../api/types';
import { AirCloudClient, DEFAULT_DEVICES } from '../api/client';
import { analyzeBattery } from '../utils/battery-model';
import type { BatteryStatus } from '../utils/battery-model';

export const useDeviceStore = defineStore('device', {
  state: () => ({
    devices: [] as DeviceInfo[],
    activeImei: '864317087172311',
    isArmed: true, // 创新功能 P1: 一键智能布防
    loading: false,
    lastRefreshed: 0
  }),

  getters: {
    activeDevice(state): DeviceInfo {
      return state.devices.find(d => d.imei === state.activeImei) || state.devices[0] || DEFAULT_DEVICES[0];
    },
    batteryAnalysis(): BatteryStatus {
      const dev = this.activeDevice;
      return analyzeBattery(dev.voltageMv || 4080);
    }
  },

  actions: {
    async fetchDevices() {
      this.loading = true;
      try {
        const client = AirCloudClient.getInstance();
        const list = await client.getDeviceList();
        this.devices = list;
        this.lastRefreshed = Date.now();
      } finally {
        this.loading = false;
      }
    },

    setActiveDevice(imei: string) {
      this.activeImei = imei;
    },

    toggleArmed() {
      this.isArmed = !this.isArmed;
    }
  }
});
