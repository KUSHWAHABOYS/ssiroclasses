import { store } from '../state/store';
import { annotationStore } from '../draw/annotationStore';
import { slideRenderer } from './renderer';

export class NavigationController {
  private isNavigating = false;

  async goToPage(targetPage: number): Promise<void> {
    const state = store.getState();
    const deck = state.currentDeck;
    if (!deck || this.isNavigating) return;

    const total = deck.totalPages;
    const clamped = Math.max(1, Math.min(targetPage, total));
    if (clamped === state.currentPage) return;

    this.isNavigating = true;
    const oldPage = state.currentPage;

    // Guaranteed Auto-erase: synchronously clear before new slide is painted
    annotationStore.onSlideChange(oldPage, clamped);

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
    if (state.currentPage < state.totalPages) {
      this.goToPage(state.currentPage + 1);
    }
  }

  prevPage(): void {
    const state = store.getState();
    if (state.currentPage > 1) {
      this.goToPage(state.currentPage - 1);
    }
  }

  firstPage(): void {
    this.goToPage(1);
  }

  lastPage(): void {
    const state = store.getState();
    this.goToPage(state.totalPages);
  }
}

export const navigationController = new NavigationController();
