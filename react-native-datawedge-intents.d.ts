declare module 'react-native-datawedge-intents' {
  type BroadcastReceiverConfig = {
    filterActions: string[];
    filterCategories?: string[];
  };

  type BroadcastIntentPayload = {
    action: string;
    extras?: Record<string, unknown>;
  };

  interface DataWedgeIntentsModule {
    registerBroadcastReceiver(config: BroadcastReceiverConfig): void;
    registerReceiver?(action: string, category?: string): void;
    sendBroadcastWithExtras(config: BroadcastIntentPayload): void;
    sendIntent?(action: string, extra?: unknown): void;
    ACTION_SOFTSCANTRIGGER?: string;
    START_SCANNING?: string;
    STOP_SCANNING?: string;
    TOGGLE_SCANNING?: string;
  }

  const DataWedgeIntents: DataWedgeIntentsModule;
  export default DataWedgeIntents;
}
