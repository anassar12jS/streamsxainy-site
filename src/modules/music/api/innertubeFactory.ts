import { Innertube, UniversalCache } from 'youtubei.js';
import { extensionBridge } from '../extension/bridge';
import { useSessionStore } from '../store/useSessionStore';

const instanceMap = new Map<string, Innertube>();
const initializingMap = new Map<string, Promise<Innertube>>();

/**
 * Returns a cached Innertube client instance bound to the provided channelId,
 * or bound to the active YouTube Music account from useSessionStore.
 */
export async function getInnertubeForChannel(channelId?: string): Promise<Innertube> {
  const targetId = channelId || useSessionStore.getState().activeChannelId || 'default';

  if (instanceMap.has(targetId)) {
    return instanceMap.get(targetId)!;
  }

  if (initializingMap.has(targetId)) {
    return initializingMap.get(targetId)!;
  }

  const initPromise = (async () => {
    try {
      // If a specific channel is selected, notify the extension
      if (channelId) {
        try {
          await extensionBridge.selectChannel(channelId);
        } catch {}
      }

      const client = await Innertube.create({
        cache: new UniversalCache(false),
        fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
          const options: RequestInit = { ...init };

          const method = (
            options.method ||
            (typeof input === 'object' && input && 'method' in input ? (input as Request).method : undefined) ||
            'GET'
          ).toUpperCase();
          options.method = method;

          if (method === 'GET' || method === 'HEAD') {
            delete options.body;
          }

          return await extensionBridge.proxyFetch(url, options);
        },
      });

      instanceMap.set(targetId, client);
      return client;
    } finally {
      initializingMap.delete(targetId);
    }
  })();

  initializingMap.set(targetId, initPromise);
  return initPromise;
}

export function resetInnertubeInstances() {
  instanceMap.clear();
  initializingMap.clear();
}
