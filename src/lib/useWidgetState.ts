import { useEffect } from 'react';

type WidgetStatePayload = {
  currentRoute: string;
  routeName: string;
  data: unknown;
  summary: string;
};

const isWidgetStatePayload = (value: unknown): value is WidgetStatePayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<WidgetStatePayload> & { data?: unknown };
  if (typeof candidate.currentRoute !== 'string') return false;
  if (typeof candidate.routeName !== 'string') return false;
  if (!('data' in candidate)) return false;
  if (typeof candidate.summary !== 'string') return false;
  return true;
};

export function useWidgetState(
  isEmbeddedApp: boolean,
  payload: WidgetStatePayload | null | undefined,
): void {
  useEffect(() => {
    if (!isEmbeddedApp) return;
    if (!payload || !isWidgetStatePayload(payload)) return;

    const setState = async () => {
      try {
        await window.openai?.setWidgetState?.(payload);
      } catch (error) {
        console.error('Failed to update widget state', error);
      }
    };

    void setState();
  }, [isEmbeddedApp, payload]);
}

export type { WidgetStatePayload };
