/**
 * Shared Application Event Emitter for Real-Time Cross-Screen Reactivity
 * Decouples mutations from view layers and guarantees automatic, instant
 * re-renders across Homepage, Groups, Activity, and Group Detail screens.
 */

type Listener<T = any> = (data: T) => void;

export interface AppDataChangedEvent {
  groupId?: string;
  type?:
    | 'expense_created'
    | 'expense_updated'
    | 'expense_deleted'
    | 'settlement_recorded'
    | 'settlement_deleted'
    | 'group_created'
    | 'group_updated'
    | 'group_archived'
    | 'group_deleted'
    | 'budget_updated'
    | 'members_updated'
    | 'auth_logout'
    | 'notifications_updated';
}

class AppEventEmitter {
  private listeners: Map<string, Listener[]> = new Map();

  /**
   * Register a subscriber listener. Returns an unsubscribe callback for clean useEffect teardowns.
   */
  on(event: 'data-changed', listener: Listener<AppDataChangedEvent>): () => void;
  on(event: string, listener: Listener): () => void;
  on(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
    return () => this.off(event, listener);
  }

  /**
   * Unregister a subscriber listener.
   */
  off(event: string, listener: Listener): void {
    const list = this.listeners.get(event);
    if (!list) return;
    this.listeners.set(
      event,
      list.filter((l) => l !== listener)
    );
  }

  /**
   * Emit an event to all active listeners.
   */
  emit(event: 'data-changed', data?: AppDataChangedEvent): void;
  emit(event: string, data?: any): void;
  emit(event: string, data?: any): void {
    const list = this.listeners.get(event);
    if (!list || list.length === 0) return;
    list.forEach((fn) => {
      try {
        fn(data);
      } catch {
        // Suppress listener errors in production
      }
    });
  }
}

export const appEventEmitter = new AppEventEmitter();
