/**
 * Persist the interrupted chat intent so login can resume without retyping.
 */

export const CHAT_RESUME_KEY = "marineo-chat-resume-v1";

export type ChatResumePayload = {
  /** User message to re-run after login */
  prompt: string;
  /** Open the widget on return */
  open: true;
  savedAt: string;
};

export function saveChatResume(prompt: string): void {
  const p = prompt.trim();
  if (!p || typeof window === "undefined") return;
  try {
    const payload: ChatResumePayload = {
      prompt: p.slice(0, 500),
      open: true,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(CHAT_RESUME_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function peekChatResume(): ChatResumePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHAT_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatResumePayload;
    if (!parsed?.prompt || typeof parsed.prompt !== "string") return null;
    return { prompt: parsed.prompt, open: true, savedAt: parsed.savedAt ?? "" };
  } catch {
    return null;
  }
}

export function clearChatResume(): void {
  try {
    sessionStorage.removeItem(CHAT_RESUME_KEY);
  } catch {
    /* ignore */
  }
}

/** Consume pending resume once (returns null if none / expired > 30 min). */
export function takeChatResume(): ChatResumePayload | null {
  const p = peekChatResume();
  clearChatResume();
  if (!p) return null;
  if (p.savedAt) {
    const age = Date.now() - Date.parse(p.savedAt);
    if (Number.isFinite(age) && age > 30 * 60 * 1000) return null;
  }
  return p;
}

export const CHAT_RESUME_REDIRECT = "/?chat=resume";
