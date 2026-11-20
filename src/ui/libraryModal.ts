// Studio Library Modal: Beautiful 4K IFP Dark Glass UI for local presentations, videos & photos
import { libraryStore, LibraryItem, LibraryItemType } from '../library/libraryStore';
import { slideView } from '../presenter/slideView';
import { overlayManager } from '../media/overlayManager';
import { store } from '../state/store';

export class LibraryModal {
  private modalEl!: HTMLElement;
  private currentTab: 'all' | LibraryItemType = 'all';
  private searchQuery: string = '';
  private items: LibraryItem[] = [];
  private isBound = false;

  init(): void {
    let el = document.getElementById('libraryModal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'libraryModal';
      el.className = 'library-modal z-modal hidden';
      document.body.appendChild(el);
    }
    this.modalEl = el;

    // Listen for custom trigger events
    window.addEventListener('open-library-modal', () => {
      this.show();
    });

    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('#btnLibraryHeader, #btnToolLibrary, #btnWelcomeLibrary, [data-action="open-library"]');
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        this.show();
      }
    });
  }

  async show(): Promise<void> {
    this.modalEl.classList.remove('hidden');
    await this.refresh();
  }

  hide(): void {
    this.modalEl.classList.add('hidden');
  }

  async refresh(): Promise<void> {
    this.items = await libraryStore.getAllItems();
    const storageInfo = await libraryStore.getStorageInfo();
    this.render(storageInfo);
    if (!this.isBound) {
      this.bindEvents();
      this.isBound = true;
    }
  }

  private render(storageInfo: { usedFormatted: string; quotaFormatted: string; percent: number }): void {
    const filtered = this.items.filter((item) => {
      const matchesTab = this.currentTab === 'all' || item.type === this.currentTab;
      const matchesSearch = !this.searchQuery || item.name.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });

    this.modalEl.innerHTML = `
      <div class="library-dialog" role="dialog" aria-modal="true" aria-label="Studio Library">
        <!-- Top Header -->
        <header class="library-header">
          <div class="lib-header-left">
            <div class="lib-header-icon">
              <span class="material-symbols-outlined">folder_special</span>
            </div>
            <div class="lib-header-text">
              <div class="lib-title-row">
                <h2 class="lib-title">Studio Library</h2>
                <span class="lib-badge">100% In-Device Private</span>
              </div>
              <p class="lib-caption">Store your favorite presentations, teaching videos, and images directly on your device</p>
            </div>
          </div>

          <!-- Top Right Controls -->
          <div class="lib-header-right">
            <!-- Storage Meter Pill -->
            <div class="lib-storage-pill" title="IndexedDB Persistent Storage Quota">
              <span class="material-symbols-outlined" style="font-size:18px; color:#e9c258;">hard_drive</span>
              <div class="lib-storage-text">
                <span style="font-weight:700; color:#fff7eb;">${storageInfo.usedFormatted} used</span>
                <span style="color:#d0c5b1; font-size:11px;">/ ~${storageInfo.quotaFormatted} available</span>
              </div>
            </div>

            <!-- Add Files Button -->
            <button type="button" class="lib-btn-primary" id="btnLibAddFile" title="Add PPT, video, or images">
              <span class="material-symbols-outlined">add_circle</span>
              <span>➕ Add File</span>
            </button>
            <input type="file" id="libFileInputHidden" accept=".pdf,.pptx,.ppt,.mp4,.webm,.png,.jpg,.jpeg,.webp" multiple style="display:none;" />

            <!-- Close Button -->
            <button type="button" class="lib-btn-close" id="btnLibClose" aria-label="Close Library">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </header>

        <!-- Search & Filter Bar -->
        <div class="lib-toolbar">
          <!-- Filter Tabs -->
          <div class="lib-tabs">
            <button type="button" class="lib-tab-btn ${this.currentTab === 'all' ? 'active' : ''}" data-tab="all">
              <span class="material-symbols-outlined" style="font-size:18px;">auto_awesome_motion</span>
              <span>All (${this.items.length})</span>
            </button>
            <button type="button" class="lib-tab-btn ${this.currentTab === 'presentation' ? 'active' : ''}" data-tab="presentation">
              <span class="material-symbols-outlined" style="font-size:18px;">slideshow</span>
              <span>Presentations (${this.items.filter(i => i.type === 'presentation').length})</span>
            </button>
            <button type="button" class="lib-tab-btn ${this.currentTab === 'video' ? 'active' : ''}" data-tab="video">
              <span class="material-symbols-outlined" style="font-size:18px;">play_circle</span>
              <span>Videos (${this.items.filter(i => i.type === 'video').length})</span>
            </button>
            <button type="button" class="lib-tab-btn ${this.currentTab === 'image' ? 'active' : ''}" data-tab="image">
              <span class="material-symbols-outlined" style="font-size:18px;">image</span>
              <span>Images (${this.items.filter(i => i.type === 'image').length})</span>
            </button>
          </div>

          <!-- Search Input -->
          <div class="lib-search-box">
            <span class="material-symbols-outlined lib-search-icon">search</span>
            <input type="text" id="libSearchInput" class="lib-search-input" placeholder="Search files..." value="${this.searchQuery}" />
          </div>
        </div>

        <!-- Files Content Grid -->
        <div class="lib-content-area">
          ${filtered.length === 0 ? `
            <div class="lib-empty-state">
              <div class="lib-empty-icon">
                <span class="material-symbols-outlined">folder_open</span>
              </div>
              <h3 style="font-size:18px; font-weight:700; color:#fff7eb; margin:0;">
                ${this.searchQuery ? 'No files found' : 'Library is currently empty'}
              </h3>
              <p style="font-size:13.5px; color:#d0c5b1; margin:6px 0 16px 0; max-width:420px; line-height:1.5;">
                ${this.searchQuery ? `No files matching "${this.searchQuery}".` : 'Add your teaching presentations, videos, and images here for 1-click instant access during class!'}
              </p>
              ${!this.searchQuery ? `
                <button type="button" class="lib-btn-primary" id="btnLibAddFileEmpty">
                  <span class="material-symbols-outlined">upload_file</span>
                  <span>Add your first file</span>
                </button>
              ` : ''}
            </div>
          ` : `
            <div class="lib-cards-grid">
              ${filtered.map(item => this.renderCard(item)).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  private renderCard(item: LibraryItem): string {
    const isPres = item.type === 'presentation';
    const isVid = item.type === 'video';
    const sizeStr = libraryStore.formatBytes(item.size);
    const dateStr = new Date(item.dateAdded).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const iconName = isPres ? 'slideshow' : isVid ? 'movie' : 'image';
    const typeLabel = isPres ? 'Presentation' : isVid ? 'Video' : 'Image';
    const badgeColor = isPres ? '#eab308' : isVid ? '#38bdf8' : '#34d399';

    return `
      <div class="lib-card" data-id="${item.id}">
        <!-- Thumbnail / Preview -->
        <div class="lib-card-preview">
          ${item.thumbnail ? `
            <img src="${item.thumbnail}" class="lib-card-img" alt="${item.name}" />
          ` : `
            <div class="lib-card-placeholder" style="color:${badgeColor};">
              <span class="material-symbols-outlined" style="font-size:44px;">${iconName}</span>
            </div>
          `}
          <span class="lib-card-type-tag" style="background:${badgeColor};">${typeLabel}</span>
        </div>

        <!-- Meta info -->
        <div class="lib-card-body">
          <div class="lib-card-name" title="${item.name}">${item.name}</div>
          <div class="lib-card-meta">
            <span>${sizeStr}</span>
            <span>•</span>
            <span>${dateStr}</span>
          </div>

          <!-- Action buttons -->
          <div class="lib-card-actions">
            <button type="button" class="lib-action-open" data-open-id="${item.id}" title="Open immediately on screen">
              <span class="material-symbols-outlined" style="font-size:18px;">open_in_new</span>
              <span>Open</span>
            </button>
            <button type="button" class="lib-action-delete" data-delete-id="${item.id}" title="Remove from library">
              <span class="material-symbols-outlined" style="font-size:18px;">delete</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    // 1. Close Modal
    this.modalEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('#btnLibClose') || target.classList.contains('library-modal')) {
        this.hide();
      }
    });

    // 2. Add File Pickers
    this.modalEl.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('#btnLibAddFile, #btnLibAddFileEmpty');
      if (target) {
        const fileInput = this.modalEl.querySelector('#libFileInputHidden') as HTMLInputElement;
        fileInput?.click();
      }
    });

    this.modalEl.addEventListener('change', async (e) => {
      const fileInput = (e.target as HTMLElement).closest('#libFileInputHidden') as HTMLInputElement;
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const files = Array.from(fileInput.files);
        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { message: `⏳ Adding ${files.length} file(s) to library...`, isError: false }
          })
        );

        for (const file of files) {
          try {
            await libraryStore.addItem(file);
          } catch (err: any) {
            console.error('Library add error:', err);
          }
        }

        window.dispatchEvent(
          new CustomEvent('app-toast', {
            detail: { message: `✅ ${files.length} file(s) safely added to library!`, isError: false }
          })
        );

        fileInput.value = '';
        await this.refresh();
      }
    });

    // 3. Tab switching
    this.modalEl.addEventListener('click', (e) => {
      const tabBtn = (e.target as HTMLElement).closest('.lib-tab-btn') as HTMLElement;
      if (tabBtn) {
        const tab = tabBtn.getAttribute('data-tab') as any;
        if (tab) {
          this.currentTab = tab;
          this.refresh();
        }
      }
    });

    // 4. Real-time Search Input
    this.modalEl.addEventListener('input', (e) => {
      const input = (e.target as HTMLElement).closest('#libSearchInput') as HTMLInputElement;
      if (input) {
        this.searchQuery = input.value;
        const storageInfo = { usedFormatted: '', quotaFormatted: '', percent: 0 };
        this.render(storageInfo);
      }
    });

    // 5. Open File Action
    this.modalEl.addEventListener('click', async (e) => {
      const openBtn = (e.target as HTMLElement).closest('[data-open-id]') as HTMLElement;
      if (openBtn) {
        const id = openBtn.getAttribute('data-open-id');
        const item = this.items.find(i => i.id === id);
        if (item) {
          await this.openItem(item);
        }
      }
    });

    // 6. Delete File Action
    this.modalEl.addEventListener('click', async (e) => {
      const deleteBtn = (e.target as HTMLElement).closest('[data-delete-id]') as HTMLElement;
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-delete-id');
        const item = this.items.find(i => i.id === id);
        if (item) {
          const ok = window.confirm(`Are you sure you want to remove "${item.name}" from your library?`);
          if (ok) {
            await libraryStore.deleteItem(id!);
            window.dispatchEvent(
              new CustomEvent('app-toast', {
                detail: { message: `🗑️ "${item.name}" removed.`, isError: false }
              })
            );
            await this.refresh();
          }
        }
      }
    });
  }

  private async openItem(item: LibraryItem): Promise<void> {
    const mime = item.blob.type || (item.type === 'presentation' ? 'application/pdf' : item.type === 'video' ? 'video/mp4' : 'image/jpeg');
    const file = new File([item.blob], item.name, { type: mime });

    this.hide();

    if (item.type === 'presentation') {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: `📄 Loading presentation: ${item.name}...`, isError: false }
        })
      );
      try {
        await (slideView as any).handleIncomingFiles([file]);
      } catch (err: any) {
        console.error('Failed to open presentation from library:', err);
      }
    } else {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: `🎬 Opening media on screen: ${item.name}...`, isError: false }
        })
      );
      try {
        await overlayManager.addMediaFile(file);
      } catch (err: any) {
        console.error('Failed to open media from library:', err);
      }
    }
  }
}

export const libraryModal = new LibraryModal();
