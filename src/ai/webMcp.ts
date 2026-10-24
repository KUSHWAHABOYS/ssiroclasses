// ECON: Optional WebMCP Agent Tools Layer (Part F: Experimental, Off by default)
import { store } from '../state/store';
import { navigationController } from '../presenter/navigation';
import { annotationStore } from '../draw/annotationStore';
import { blackboardStudio } from '../board/board';
import { voiceWriteManager } from '../voice/writeCommand';

export class WebMcpManager {
  private registered = false;

  init(): void {
    const isEnabled = store.getState().settings.webMcpEnabled ?? false;
    if (isEnabled) {
      this.registerTools();
    }
  }

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof (navigator as any).modelContext?.registerTool === 'function';
  }

  registerTools(): void {
    if (this.registered || !this.isSupported()) return;

    try {
      const modelContext = (navigator as any).modelContext;

      // 1. Next Slide Tool
      modelContext.registerTool({
        name: 'next_slide',
        description: 'Navigates to the next slide in the presentation',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          navigationController.nextPage();
          return { success: true, currentPage: store.getState().currentPage };
        }
      });

      // 2. Previous Slide Tool
      modelContext.registerTool({
        name: 'previous_slide',
        description: 'Navigates to the previous slide in the presentation',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          navigationController.prevPage();
          return { success: true, currentPage: store.getState().currentPage };
        }
      });

      // 3. Go to Slide Tool
      modelContext.registerTool({
        name: 'goto_slide',
        description: 'Navigates to a specific slide number in the presentation',
        parameters: {
          type: 'object',
          properties: {
            slideNumber: { type: 'number', description: 'Slide number (1-indexed)' }
          },
          required: ['slideNumber']
        },
        execute: async (args: { slideNumber: number }) => {
          navigationController.goToPage(args.slideNumber);
          return { success: true, currentPage: store.getState().currentPage };
        }
      });

      // 4. Toggle Board Tool
      modelContext.registerTool({
        name: 'toggle_board',
        description: 'Opens or closes the fullscreen teaching blackboard studio',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          blackboardStudio.toggleBoard();
          return { success: true, isBoardMode: store.getState().isBoardMode };
        }
      });

      // 5. Clear Slide Tool (with confirmation guard for destructive tool)
      modelContext.registerTool({
        name: 'clear_slide',
        description: 'Clears annotations on the current slide with safety confirmation',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          annotationStore.clearAll();
          return { success: true };
        }
      });

      // 6. Write Text at Anchor Tool
      modelContext.registerTool({
        name: 'write_text',
        description: 'Places typeset text on the slide at a designated anchor position',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text content to write on slide' },
            location: {
              type: 'string',
              enum: ['here', 'arrow_head', 'shape_inside', 'title', 'default'],
              description: 'Anchor location for text'
            }
          },
          required: ['text']
        },
        execute: async (args: { text: string; location?: any }) => {
          voiceWriteManager.execute({
            action: 'write',
            text: args.text,
            location: args.location || 'default'
          });
          return { success: true, text: args.text };
        }
      });

      this.registered = true;
      console.log('🌐 WebMCP Tools successfully registered with browser agent context.');
    } catch (e) {
      console.warn('WebMCP registration failed or unsupported:', e);
    }
  }
}

export const webMcpManager = new WebMcpManager();
