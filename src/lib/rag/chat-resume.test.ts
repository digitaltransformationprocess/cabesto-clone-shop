import { afterEach, describe, expect, it } from "vitest";
import {
  CHAT_RESUME_KEY,
  clearChatResume,
  saveChatResume,
  takeChatResume,
} from "./chat-resume";

afterEach(() => {
  clearChatResume();
});

describe("chat-resume", () => {
  it("saves and consumes a prompt once", () => {
    saveChatResume("Je veux suivre ma commande");
    expect(sessionStorage.getItem(CHAT_RESUME_KEY)).toBeTruthy();
    const first = takeChatResume();
    expect(first?.prompt).toBe("Je veux suivre ma commande");
    expect(takeChatResume()).toBeNull();
  });
});
