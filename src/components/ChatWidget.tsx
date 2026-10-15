import { useEffect, useRef, useState } from "react";
import { streamRagChat } from "@/lib/rag/client-chat";
import { useStore } from "@/lib/store";

type Msg = { role: "user" | "assistant"; content: string };

const quick = [
  "Ordinateur de plongée Mares Genius",
  "Quels sont les délais de livraison ?",
  "Comment faire un retour ?",
  "Magasin à Brest",
];

function render(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g).map((p, j) => {
      const l = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (l) {
        return (
          <a key={j} href={l[2]} className="font-semibold text-accent underline">
            {l[1]}
          </a>
        );
      }
      const b = p.match(/^\*\*([^*]+)\*\*$/);
      return b ? <b key={j}>{b[1]}</b> : p;
    });
    return (
      <p key={i} className={line.trim().startsWith("-") || line.trim().startsWith("*") ? "pl-2" : ""}>
        {parts}
      </p>
    );
  });
}

export function ChatWidget() {
  const { user } = useStore();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const next: Msg[] = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(next);
    setInput("");
    setBusy(true);

    // Placeholder assistant bubble for streaming tokens
    setMsgs([...next, { role: "assistant", content: "" }]);

    let assembled = "";
    let sawError = false;

    try {
      await streamRagChat(next, {
        signal: ac.signal,
        onToken: (chunk) => {
          assembled += chunk;
          const snapshot = assembled;
          setMsgs([...next, { role: "assistant", content: snapshot }]);
        },
        onError: (message) => {
          sawError = true;
          setMsgs([...next, { role: "assistant", content: `⚠️ ${message}` }]);
        },
        onDone: () => {
          if (!sawError && !assembled.trim()) {
            setMsgs([...next, { role: "assistant", content: "Je ne sais pas" }]);
          }
        },
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : String(e);
      setMsgs([
        ...next,
        {
          role: "assistant",
          content: `⚠️ Impossible de joindre l'assistant (${msg}). Ouvre http://localhost:8080/ puis Ctrl+Shift+R.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[560px] max-h-[75vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div>
              <p className="font-display font-bold">Capitaine Marinéo</p>
              <p className="text-xs opacity-80">
                {user ? `Bonjour ${user.name.split(" ")[0]}` : "Assistant catalogue (RAG)"}
              </p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-xl">
              ×
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {msgs.length === 0 && (
              <div>
                <p className="rounded-lg bg-muted p-3">
                  Produits (prix/stock à jour), FAQ, livraison, retours, magasins… Sinon je réponds « Je ne sais
                  pas ».
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {quick.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => ask(q)}
                      className="rounded-full border border-accent px-3 py-1 text-xs font-semibold text-accent hover:bg-accent hover:text-accent-foreground"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "ml-8 rounded-lg bg-primary p-3 text-primary-foreground"
                    : "mr-4 space-y-1"
                }
              >
                {m.role === "user" ? m.content : m.content ? render(m.content) : null}
              </div>
            ))}
            {busy && <p className="animate-pulse text-muted-foreground">Recherche catalogue…</p>}
            <div ref={end} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="flex gap-2 border-t p-3"
          >
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex. ordinateur plongée Mares…"
              className="flex-1 rounded-full border bg-muted px-4 py-2 text-sm"
            />
            <button
              disabled={busy}
              type="submit"
              className="rounded-full bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50"
            >
              Envoyer
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Assistant"
        className="fixed bottom-4 right-4 z-50 grid h-16 w-16 place-items-center rounded-full bg-accent text-2xl text-accent-foreground shadow-xl"
      >
        {open ? "×" : "💬"}
      </button>
    </>
  );
}
