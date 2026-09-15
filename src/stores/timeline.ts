import { defineStore } from 'pinia';
import type { TrackPoint } from '../api/types';
import { AirCloudClient } from '../api/client';

export const useTimelineStore = defineStore('timeline', {
  state: () => ({
    mode: 'live' as 'live' | 'range',
    scope: 'recent_window' as string,
    trackPoints: [] as TrackPoint[],
    committedPlayhead: 100, // 0 ~ 100%
    hoverPlayhead: 100,
    isHovering: false,
    rangeStart: 37.0, // 区间模式起始百分比
    rangeEnd: 50.5,   // 区间模式结束百分比
    isPlaying: false,
    playSpeed: 1,
    playTimer: null as any
  }),

  getters: {
    currentPoint(state): TrackPoint | null {
      if (!state.trackPoints.length) return null;
      const idx = Math.min(
        Math.floor((state.committedPlayhead / 100) * (state.trackPoints.length - 1)),
        state.trackPoints.length - 1
      );
      return state.trackPoints[idx];
    },
    hoverPoint(state): TrackPoint | null {
      if (!state.trackPoints.length || !state.isHovering) return null;
      const idx = Math.min(
        Math.floor((state.hoverPlayhead / 100) * (state.trackPoints.length - 1)),
        state.trackPoints.length - 1
      );
      return state.trackPoints[idx];
    }
  },

  actions: {
    async loadTrackData(imei: string, scope = 'recent_window') {
      this.scope = scope;
      const client = AirCloudClient.getInstance();
      const points = await client.getHistoricalTrack(imei, scope);
      this.trackPoints = points;
      if (this.mode === 'live') {
        this.committedPlayhead = 100;
      } else {
        this.committedPlayhead = this.rangeEnd;
      }
    },

    setMode(mode: 'live' | 'range') {
      this.mode = mode;
      this.stopPlayback();
      if (mode === 'live') {
        this.committedPlayhead = 100;
      } else {
        this.committedPlayhead = this.rangeEnd;
      }
    },

    setCommittedPlayhead(percent: number) {
      this.committedPlayhead = Math.max(0, Math.min(100, percent));
    },

    setHover(isHover: boolean, percent: number) {
      this.isHovering = isHover;
      this.hoverPlayhead = Math.max(0, Math.min(100, percent));
    },

    setRange(start: number, end: number) {
      this.rangeStart = Math.max(0, Math.min(end - 2, start));
      this.rangeEnd = Math.min(100, Math.max(start + 2, end));
    },

    startPlayback() {
      this.isPlaying = true;
      if (this.committedPlayhead >= this.rangeEnd || this.committedPlayhead < this.rangeStart) {
        this.committedPlayhead = this.rangeStart;
      }
      this.playTimer = setInterval(() => {
        this.committedPlayhead += 0.5 * this.playSpeed;
        if (this.committedPlayhead >= this.rangeEnd) {
          this.committedPlayhead = this.rangeEnd;
          this.stopPlayback();
        }
      }, 100);
    },

    stopPlayback() {
      this.isPlaying = false;
      if (this.playTimer) {
        clearInterval(this.playTimer);
        this.playTimer = null;
      }
    },

    togglePlayback() {
      if (this.isPlaying) this.stopPlayback();
      else this.startPlayback();
    },

    setPlaySpeed(speed: number) {
      this.playSpeed = speed;
    }
  }
});
