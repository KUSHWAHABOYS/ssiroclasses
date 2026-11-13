import { store } from '../state/store';
import { layerManager } from './layers';
import { slideRenderer } from '../presenter/renderer';

class FullscreenService {
  private wakeLock: any = null;

  constructor() {
    const handleFullscreenState = () => {
      const isFs = !!document.fullscreenElement;
      if (store.getState().isZen !== isFs) {
        store.setState({ isZen: isFs });
      }
      // Trigger instant dimension recomputation and slide cache clearance for 4K Full View
      setTimeout(() => {
        layerManager.updateDimensions();
        slideRenderer.clearCache();
        window.dispatchEvent(new CustomEvent('app-fullscreen-changed', { detail: { isZen: isFs } }));
      }, 60);
    };

    document.addEventListener('fullscreenchange', handleFullscreenState);
    document.addEventListener('webkitfullscreenchange', handleFullscreenState);

    // Request wake lock to prevent screen dimming on 4K smart boards
    this.requestWakeLock();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.requestWakeLock();
      }
    });
  }

  async enterZen(): Promise<void> {
    const stage = document.getElementById('stage');
    try {
      if (stage && !document.fullscreenElement) {
        if (stage.requestFullscreen) {
          await stage.requestFullscreen();
        } else if ((stage as any).webkitRequestFullscreen) {
          await (stage as any).webkitRequestFullscreen();
        }
      }
    } catch (err) {
      console.warn('Browser fullscreen request failed (allowed if user gesture restricted):', err);
    }
    store.setState({ isZen: true, isToolbarVisibleInZen: true });
    setTimeout(() => {
      layerManager.updateDimensions();
      slideRenderer.clearCache();
      window.dispatchEvent(new CustomEvent('app-fullscreen-changed', { detail: { isZen: true } }));
    }, 60);
  }

  async exitZen(): Promise<void> {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Browser exit fullscreen failed:', err);
    }
    store.setState({ isZen: false, isToolbarVisibleInZen: true });
    setTimeout(() => {
      layerManager.updateDimensions();
      slideRenderer.clearCache();
      window.dispatchEvent(new CustomEvent('app-fullscreen-changed', { detail: { isZen: false } }));
    }, 60);
  }

  toggleZen(): void {
    if (store.getState().isZen) {
      this.exitZen();
    } else {
      this.enterZen();
    }
  }

  private async requestWakeLock(): Promise<void> {
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
      }
    } catch (e) {
      // Non-critical, wakeLock may not be allowed or supported in all WebViews
    }
  }
}

export const fullscreenService = new FullscreenService();
