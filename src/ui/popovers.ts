import { store } from '../state/store';

export class PopoverManager {
  private activePopover: HTMLElement | null = null;
  private idleTimer: number = 0;

  showPenPopover(anchorEl: HTMLElement): void {
    this.close();
    const state = store.getState();

    const popover = document.createElement('div');
    popover.className = 'popover';
    popover.innerHTML = `
      <div class="popover-header">
        <span>पेन सेटिंग्स (Pen)</span>
      </div>
      <div class="popover-row">
        <label>
          <span>आकार (Size)</span>
          <span id="penSizeVal">${state.penSize}px</span>
        </label>
        <input type="range" class="popover-slider" id="penSizeSlider" min="1" max="40" value="${state.penSize}" />
      </div>
      <div class="popover-row">
        <label>
          <span>घनत्व (Opacity)</span>
          <span id="penAlphaVal">${Math.round(state.penAlpha * 100)}%</span>
        </label>
        <input type="range" class="popover-slider" id="penAlphaSlider" min="20" max="100" value="${Math.round(state.penAlpha * 100)}" />
      </div>
      <div class="brush-preview">
        <div class="brush-dot" id="penPreviewDot" style="width: ${state.penSize}px; height: ${state.penSize}px; background-color: ${state.activeColor}; opacity: ${state.penAlpha}"></div>
      </div>
    `;

    this.positionPopover(popover, anchorEl);
    document.body.appendChild(popover);
    this.activePopover = popover;

    const sizeSlider = popover.querySelector('#penSizeSlider') as HTMLInputElement;
    const alphaSlider = popover.querySelector('#penAlphaSlider') as HTMLInputElement;
    const dot = popover.querySelector('#penPreviewDot') as HTMLElement;
    const sizeVal = popover.querySelector('#penSizeVal') as HTMLElement;
    const alphaVal = popover.querySelector('#penAlphaVal') as HTMLElement;

    sizeSlider.addEventListener('input', () => {
      const sz = Number(sizeSlider.value);
      sizeVal.textContent = `${sz}px`;
      dot.style.width = `${sz}px`;
      dot.style.height = `${sz}px`;
      store.setState({ penSize: sz });
      this.resetIdleTimer();
    });

    alphaSlider.addEventListener('input', () => {
      const a = Number(alphaSlider.value) / 100;
      alphaVal.textContent = `${Math.round(a * 100)}%`;
      dot.style.opacity = `${a}`;
      store.setState({ penAlpha: a });
      this.resetIdleTimer();
    });

    this.bindOutsideAndIdle(popover, anchorEl);
  }

  showHighlighterPopover(anchorEl: HTMLElement): void {
    this.close();
    const state = store.getState();

    const popover = document.createElement('div');
    popover.className = 'popover';
    popover.innerHTML = `
      <div class="popover-header">
        <span>हाइलाइटर सेटिंग्स (Highlighter)</span>
      </div>
      <div class="popover-row">
        <label>
          <span>चौड़ाई (Width)</span>
          <span id="hlWidthVal">${state.highlighterWidth}px</span>
        </label>
        <input type="range" class="popover-slider" id="hlWidthSlider" min="10" max="80" value="${state.highlighterWidth}" />
      </div>
      <div class="popover-row">
        <label>
          <span>घनत्व (Density)</span>
          <span id="hlAlphaVal">${Math.round(state.highlighterAlpha * 100)}%</span>
        </label>
        <input type="range" class="popover-slider" id="hlAlphaSlider" min="10" max="60" value="${Math.round(state.highlighterAlpha * 100)}" />
      </div>
      <div class="brush-preview" style="background: #ffffff;">
        <div style="width: 80%; height: ${state.highlighterWidth / 2}px; background-color: ${state.activeColor}; opacity: ${state.highlighterAlpha}; border-radius: 2px;"></div>
      </div>
    `;

    this.positionPopover(popover, anchorEl);
    document.body.appendChild(popover);
    this.activePopover = popover;

    const widthSlider = popover.querySelector('#hlWidthSlider') as HTMLInputElement;
    const alphaSlider = popover.querySelector('#hlAlphaSlider') as HTMLInputElement;
    const widthVal = popover.querySelector('#hlWidthVal') as HTMLElement;
    const alphaVal = popover.querySelector('#hlAlphaVal') as HTMLElement;

    widthSlider.addEventListener('input', () => {
      const w = Number(widthSlider.value);
      widthVal.textContent = `${w}px`;
      store.setState({ highlighterWidth: w });
      this.resetIdleTimer();
    });

    alphaSlider.addEventListener('input', () => {
      const a = Number(alphaSlider.value) / 100;
      alphaVal.textContent = `${Math.round(a * 100)}%`;
      store.setState({ highlighterAlpha: a });
      this.resetIdleTimer();
    });

    this.bindOutsideAndIdle(popover, anchorEl);
  }

  showEraserPopover(anchorEl: HTMLElement): void {
    this.close();
    const state = store.getState();

    const popover = document.createElement('div');
    popover.className = 'popover';
    popover.innerHTML = `
      <div class="popover-header">
        <span>रबर सेटिंग्स (Eraser)</span>
      </div>
      <div class="popover-row">
        <label>
          <span>मोड (Eraser Mode)</span>
        </label>
        <div class="toggle-group">
          <button class="toggle-btn ${state.eraserMode === 'pixel' ? 'active' : ''}" id="btnModePixel">Pixel</button>
          <button class="toggle-btn ${state.eraserMode === 'stroke' ? 'active' : ''}" id="btnModeStroke">Stroke</button>
        </div>
      </div>
      <div class="popover-row">
        <label>
          <span>आकार (Size)</span>
          <span id="eraserSizeVal">${state.eraserSize}px</span>
        </label>
        <input type="range" class="popover-slider" id="eraserSizeSlider" min="10" max="150" value="${state.eraserSize}" />
      </div>
    `;

    this.positionPopover(popover, anchorEl);
    document.body.appendChild(popover);
    this.activePopover = popover;

    const sizeSlider = popover.querySelector('#eraserSizeSlider') as HTMLInputElement;
    const sizeVal = popover.querySelector('#eraserSizeVal') as HTMLElement;
    const btnPixel = popover.querySelector('#btnModePixel') as HTMLElement;
    const btnStroke = popover.querySelector('#btnModeStroke') as HTMLElement;

    sizeSlider.addEventListener('input', () => {
      const s = Number(sizeSlider.value);
      sizeVal.textContent = `${s}px`;
      store.setState({ eraserSize: s });
      this.resetIdleTimer();
    });

    btnPixel.addEventListener('click', () => {
      btnPixel.classList.add('active');
      btnStroke.classList.remove('active');
      store.setState({ eraserMode: 'pixel' });
      this.resetIdleTimer();
    });

    btnStroke.addEventListener('click', () => {
      btnStroke.classList.add('active');
      btnPixel.classList.remove('active');
      store.setState({ eraserMode: 'stroke' });
      this.resetIdleTimer();
    });

    this.bindOutsideAndIdle(popover, anchorEl);
  }

  private positionPopover(popover: HTMLElement, anchorEl: HTMLElement): void {
    const rect = anchorEl.getBoundingClientRect();
    const anchorCenter = rect.left + rect.width / 2;
    const anchorTop = rect.top;

    // Default above anchor, flip below if not enough room (< 220px from top)
    if (anchorTop < 220) {
      popover.style.top = `${rect.bottom + 12}px`;
      popover.style.left = `${anchorCenter}px`;
      popover.style.transform = 'translateX(-50%)';
    } else {
      popover.style.bottom = `${window.innerHeight - anchorTop + 12}px`;
      popover.style.left = `${anchorCenter}px`;
      popover.style.transform = 'translateX(-50%)';
    }
  }

  private bindOutsideAndIdle(popover: HTMLElement, anchorEl: HTMLElement): void {
    this.resetIdleTimer();

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (!popover.contains(target) && !anchorEl.contains(target)) {
        this.close();
        document.removeEventListener('pointerdown', handleOutside);
      }
    };

    setTimeout(() => {
      document.addEventListener('pointerdown', handleOutside);
    }, 50);
  }

  private resetIdleTimer(): void {
    window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.close();
    }, 5000); // 5s idle per B5.4
  }

  close(): void {
    window.clearTimeout(this.idleTimer);
    if (this.activePopover) {
      this.activePopover.remove();
      this.activePopover = null;
    }
  }
}

export const popoverManager = new PopoverManager();
