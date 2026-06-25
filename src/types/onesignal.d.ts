export interface OneSignalPushSubscription {
  id?: string | null;
  optedIn?: boolean;
  optIn: () => Promise<void>;
  optOut: () => Promise<void>;
}

export interface OneSignalUserNamespace {
  PushSubscription: OneSignalPushSubscription;
  addTag: (key: string, value: string) => Promise<void>;
}

export interface OneSignalNamespace {
  init: (options: {
    appId: string;
    serviceWorkerPath?: string;
    allowLocalhostAsSecureOrigin?: boolean;
  }) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  User: OneSignalUserNamespace;
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalNamespace) => void | Promise<void>>;
  }
}

export {};
