export type ActionResult = { ok: true } | { ok: false; reason: string };

export const ok: ActionResult = { ok: true };
export const fail = (reason: string): ActionResult => ({ ok: false, reason });
