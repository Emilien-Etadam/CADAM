/** No-op: analytics disabled in local-only build. */
export function phCapture(_name: string, _properties?: Record<string, unknown>): void {}
