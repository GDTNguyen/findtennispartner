type MapLogLevel = 'info' | 'error';

type MapLogPayload = {
  level: MapLogLevel;
  message: string;
  detail?: Record<string, unknown>;
};

export function reportMapLog(
  level: MapLogLevel,
  message: string,
  detail?: Record<string, unknown>
) {
  const payload: MapLogPayload = detail
    ? { level, message, detail }
    : { level, message };

  void fetch('/api/map-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* Best-effort logging; ignore network failures. */
  });
}
