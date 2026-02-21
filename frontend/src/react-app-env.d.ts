/// <reference types="react-scripts" />

interface Window {
  DD_RUM?: {
    onReady: (callback: () => void) => void;
    addAction: (name: string, context?: Record<string, any>) => void;
    addError: (error: Error | string, options?: { source?: string; context?: Record<string, any> }) => void;
    stopSession: () => void;
    setUser: (user: Record<string, any>) => void;
    removeUser: () => void;
    clearUser: () => void;
  };
  DD_LOGS?: {
    onReady: (callback: () => void) => void;
    logger: {
      info: (message: string, context?: Record<string, any>) => void;
      error: (message: string, context?: Record<string, any>) => void;
    };
  };
}
