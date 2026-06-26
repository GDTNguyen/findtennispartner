import { canRunAsUser } from '@devvit/web/client';

const PERMISSION_TIMEOUT_MS = 20_000;

export type UserPostPermissionResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Ask Reddit (mobile) to allow this app to submit a post as the signed-in user. */
export async function requestUserPostPermission(event: Event): Promise<UserPostPermissionResult> {
  try {
    const allowed = await Promise.race([
      canRunAsUser(event),
      new Promise<boolean>((_, reject) => {
        window.setTimeout(
          () => reject(new Error('Reddit permission request timed out')),
          PERMISSION_TIMEOUT_MS
        );
      }),
    ]);

    if (!allowed) {
      return {
        ok: false,
        reason:
          'Reddit did not grant permission to post on your behalf. Approve the prompt and try again.',
      };
    }

    return { ok: true };
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : 'Could not verify Reddit posting permission';
    return { ok: false, reason };
  }
}
