// PWA Install Manager: One-tap installation for PC Chrome & Android Digital Board
let deferredPrompt: any = null;

export class PwaInstallManager {
  init(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      this.updateInstallButtonsVisibility(true);
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      this.updateInstallButtonsVisibility(false);
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: '🎉 स्मार्ट स्टूडियो सफलतापूर्वक इंस्टॉल हो गया! (App Installed)', isError: false }
        })
      );
    });

    // Bind all buttons with data-action="install-pwa"
    document.addEventListener('click', (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('#btnWelcomeInstallApp, #btnInstallHeader, .btn-pwa-install');
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        this.promptInstall();
      }
    });
  }

  private updateInstallButtonsVisibility(hasPrompt: boolean): void {
    const btns = document.querySelectorAll('.btn-pwa-install, #btnWelcomeInstallApp, #btnInstallHeader');
    btns.forEach((el) => {
      (el as HTMLElement).style.display = 'inline-flex';
    });
  }

  async promptInstall(): Promise<void> {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          deferredPrompt = null;
        }
      } catch (err) {
        console.warn('PWA install prompt error:', err);
      }
    } else {
      // Guide user for 1-tap Chrome install
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            message: '💡 Google Chrome के ऊपर 3-डॉट्स (⋮) पर क्लिक करें ➔ "Install Smart Studio" (या "Add to Home Screen") चुनें।',
            isError: false
          }
        })
      );
    }
  }
}

export const pwaInstallManager = new PwaInstallManager();
