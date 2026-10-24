import { store } from '../state/store';
import { annotationStore } from '../draw/annotationStore';
import { slideRenderer } from './renderer';
// SSIRO-UPDATE: Import zoom and magnifier controllers
import { zoomController } from '../zoom/zoomController';
import { magnifierLensController } from '../zoom/magnifierLens';

export class NavigationController {
  private isNavigating = false;

  async goToPage(targetPage: number): Promise<void> {
    const state = store.getState();
    // WELCOME-FIX: Navigation is inert if not in 'deck' state
    if (state.appState !== 'deck') return;
    const deck = state.currentDeck;
    if (!deck || this.isNavigating) return;

    const total = deck.totalPages;
    const clamped = Math.max(1, Math.min(targetPage, total));
    if (clamped === state.currentPage) return;

    this.isNavigating = true;
    const oldPage = state.currentPage;

    // Guaranteed Auto-erase: synchronously clear before new slide is painted
    annotationStore.onSlideChange(oldPage, clamped);

    // SSIRO-UPDATE: Reset zoom & clear pinned lenses in the same synchronous step before paint
    zoomController.onSlideChange();
    magnifierLensController.onSlideChange();

    // Cancel in-progress strokes / pending handwriting recognition
    window.dispatchEvent(new CustomEvent('cancel-in-progress-drawing'));

    store.setState({ currentPage: clamped });

    // Paint slide
    const page = deck.pages[clamped - 1];
    if (page) {
      await slideRenderer.renderSlide(page);
      // Pre-render adjacent
      slideRenderer.preRenderAdjacent(deck.pages, clamped);
    }

    this.isNavigating = false;
  }

  nextPage(): void {
    const state = store.getState();
    if (state.appState !== 'deck' || !state.currentDeck) return;
    if (state.currentPage < state.totalPages) {
      this.goToPage(state.currentPage + 1);
    }
  }

  prevPage(): void {
    const state = store.getState();
    if (state.appState !== 'deck' || !state.currentDeck) return;
    if (state.currentPage > 1) {
      this.goToPage(state.currentPage - 1);
    }
  }

  firstPage(): void {
    const state = store.getState();
    if (state.appState !== 'deck' || !state.currentDeck) return;
    this.goToPage(1);
  }

  lastPage(): void {
    const state = store.getState();
    if (state.appState !== 'deck' || !state.currentDeck) return;
    this.goToPage(state.totalPages);
  }
}

export const navigationController = new NavigationController();
