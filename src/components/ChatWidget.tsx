import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildOrderTrackingReply,
  ordersToSession,
  ticketsToSession,
} from "@/lib/rag/account-assist";
import {
  CHAT_CARRIERS,
  defaultShippingAddress,
  detectCartIntent,
  formatCartReply,
  formatCheckoutPrompt,
  parseCarrier,
  type ChatCarrier,
} from "@/lib/rag/chat-cart";
import {
  detectChatIntent,
  HANDOFF_REPLY,
  LOGIN_REQUIRED_REPLY,
  requiresAuth,
} from "@/lib/rag/chat-intents";
import {
  buildTicketDraft,
  detectSavIssue,
  emptyMemory,
  findOrder,
  formatSavOrderCard,
  isMostlyOrderId,
  issueLabel,
  parseOrderId,
  SAV_ISSUE_OPTIONS,
  type ConversationMemory,
  type SavIssue,
} from "@/lib/rag/chat-flow";
import {
  CHAT_RESUME_REDIRECT,
  saveChatResume,
  takeChatResume,
} from "@/lib/rag/chat-resume";
import { streamRagChat, type RagMetaProduct } from "@/lib/rag/client-chat";
import { logChatEvent } from "@/lib/rag/chat-log";
import { productImage, products } from "@/lib/data";
import { useStore } from "@/lib/store";

function formatEuro(cents: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
}

type MsgAction = { id: string; label: string; primary?: boolean };
type MsgKind = "default" | "login" | "success" | "cart";

type Msg = {
  role: "user" | "assistant";
  content: string;
  products?: RagMetaProduct[];
  actions?: MsgAction[];
  kind?: MsgKind;
};

type CheckoutDraft = { carrier: ChatCarrier };

const quickActions: { label: string; prompt: string; needsAuth?: boolean }[] = [
  { label: "Trouver un produit", prompt: "Je cherche un produit" },
  { label: "Suivre ma commande", prompt: "Je veux suivre ma commande", needsAuth: true },
  { label: "Livraison et délais", prompt: "Quels sont les délais de livraison ?" },
  { label: "Retour ou réclamation", prompt: "J'ai un problème avec une commande", needsAuth: true },
];

function parseCreateTicket(text: string): { subject: string; message: string } | null {
  const m = text.match(/\[CREER_TICKET\]\s*([^|\n]+)\|\s*([\s\S]+?)(?:\n|$)/i);
  if (!m?.[1] || !m[2]) return null;
  const subject = m[1].trim().slice(0, 120);
  const message = m[2].trim().slice(0, 2000);
  if (!subject || !message) return null;
  return { subject, message };
}

function stripTicketMarker(text: string): string {
  return text.replace(/\n?\[CREER_TICKET\][^\n]*/gi, "").trim();
}

/** Drop markdown tables / verbose product dumps when UI cards already show products. */
function formatDisplayText(text: string, hasProductCards: boolean): string {
  let t = stripTicketMarker(text);
  // Remove GFM tables
  t = t
    .split("\n")
    .filter((line) => {
      const s = line.trim();
      if (!s) return true;
      if (/^\|/.test(s) && s.includes("|")) return false;
      if (/^[\s|:-]+$/.test(s)) return false;
      return true;
    })
    .join("\n");

  if (hasProductCards) {
    // Drop bullet lines that look like product dumps (prix / stock / voir)
    t = t
      .split("\n")
      .filter((line) => {
        const s = line.trim();
        if (/^[-*]\s*(prix|stock|voir)\b/i.test(s)) return false;
        if (/^[-*]\s*.+\s[—–-]\s*\d+[.,]\d{2}\s*€/i.test(s)) return false;
        if (/^\*\*[^*]+\*\*\s*$/.test(s) && s.length > 40) return false;
        return true;
      })
      .join("\n");
  }

  return t.replace(/\n{3,}/g, "\n\n").trim();
}

function inlineMd(line: string, keyPrefix: string) {
  return line.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g).map((p, j) => {
    const l = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (l) {
      return (
        <a
          key={`${keyPrefix}-${j}`}
          href={l[2]}
          className="font-semibold text-accent underline underline-offset-2"
        >
          {l[1]}
        </a>
      );
    }
    const b = p.match(/^\*\*([^*]+)\*\*$/);
    return b ? <strong key={`${keyPrefix}-${j}`}>{b[1]}</strong> : p;
  });
}

/** Turn leftover markdown tables into compact rows (fallback if no product cards). */
function tableToBlocks(text: string): { intro: string; rows: string[][] } | null {
  const lines = text.split("\n");
  const tableLines = lines.filter((l) => /^\|/.test(l.trim()) && l.includes("|"));
  if (tableLines.length < 2) return null;
  const parsed = tableLines
    .filter((l) => !/^[\s|:-]+$/.test(l.replace(/\|/g, "").trim() ? l : "|---|"))
    .filter((l) => !/^\|\s*[-:| ]+\s*\|/.test(l.trim()))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim()),
    )
    .filter((cells) => cells.some((c) => c && !/^[-:]+$/.test(c)));
  if (parsed.length < 2) return null;
  const intro = lines
    .filter((l) => !/^\|/.test(l.trim()))
    .join("\n")
    .trim();
  return { intro, rows: parsed.slice(1) }; // skip header
}

function render(text: string, hasProductCards = false) {
  const cleaned = formatDisplayText(text, hasProductCards);
  if (!cleaned) return null;

  if (!hasProductCards) {
    const table = tableToBlocks(text);
    if (table && table.rows.length) {
      return (
        <div className="space-y-2">
          {table.intro ? (
            <div className="space-y-1 text-sm leading-relaxed">{render(table.intro, false)}</div>
          ) : null}
          <ul className="space-y-2">
            {table.rows.map((cells, i) => (
              <li
                key={i}
                className="rounded-lg border bg-background/80 px-3 py-2 text-xs leading-snug"
              >
                <p className="font-semibold">{inlineMd(cells[0] ?? "", `t${i}`)}</p>
                <p className="mt-1 text-muted-foreground">
                  {[cells[1], cells[2]].filter(Boolean).join(" · ")}
                  {cells[3] ? <> · {inlineMd(cells[3], `tl${i}`)}</> : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      );
    }
  }

  return cleaned.split("\n").map((line, i) => {
    const t = line.trim();
    if (!t) return <div key={i} className="h-1.5" />;
    return (
      <p
        key={i}
        className={
          t.startsWith("-") || t.startsWith("*")
            ? "pl-2 text-sm leading-relaxed"
            : "text-sm leading-relaxed"
        }
      >
        {inlineMd(line, `l${i}`)}
      </p>
    );
  });
}

function LoginGate() {
  const href = `/connexion?redirect=${encodeURIComponent(CHAT_RESUME_REDIRECT)}`;
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-accent/30 bg-accent/5">
      <div className="border-b border-accent/20 px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-accent">Compte requis</p>
      </div>
      <div className="space-y-2 p-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Suivi de commande, SAV et validation panier nécessitent une connexion. Après connexion,
          votre demande reprend automatiquement.
        </p>
        <a
          href={href}
          className="flex w-full items-center justify-center rounded-lg bg-accent px-3 py-2.5 text-sm font-bold text-accent-foreground transition hover:opacity-90"
        >
          Se connecter
        </a>
        <p className="text-center text-[10px] text-muted-foreground">
          Démo : client@test.fr / client123
        </p>
      </div>
    </div>
  );
}

function ProductCards({
  products: list,
  onAdd,
  addedSku,
}: {
  products: RagMetaProduct[];
  onAdd: (sku: string) => void;
  addedSku?: string | null;
}) {
  if (!list.length) return null;
  return (
    <div className="mt-2 space-y-2">
      {list.slice(0, 3).map((p) => {
        const catalog = products.find((x) => x.id === p.sku);
        const img =
          (p.imageUrl && p.imageUrl.trim()) ||
          (catalog ? productImage(catalog) : "") ||
          "";
        const inStock = p.stock > 0;
        const justAdded = addedSku === p.sku;
        return (
          <div
            key={p.sku}
            className="overflow-hidden rounded-xl border bg-background transition hover:border-accent/40"
          >
            <div className="flex gap-3 p-2.5">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {img ? (
                  <img
                    src={img}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="grid h-full place-items-center text-[10px] text-muted-foreground">
                    —
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-semibold leading-snug">{p.name}</p>
                <p className="mt-1 text-sm font-bold text-primary">{formatEuro(p.priceCents)}</p>
                <span
                  className={
                    inStock
                      ? "mt-1 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400"
                      : "mt-1 inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
                  }
                >
                  {inStock ? `${p.stock} en stock` : "Rupture"}
                </span>
              </div>
            </div>
            <div className="flex border-t">
              <a
                href={`/produit/${p.sku}`}
                className="flex-1 py-2 text-center text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Voir la fiche
              </a>
              <button
                type="button"
                disabled={!inStock}
                onClick={() => onAdd(p.sku)}
                className="flex-1 border-l py-2 text-center text-xs font-bold text-accent transition hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {justAdded ? "Ajouté" : "Ajouter au panier"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionRow({
  actions,
  busy,
  onAction,
}: {
  actions: MsgAction[];
  busy: boolean;
  onAction: (id: string) => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          disabled={busy}
          onClick={() => onAction(a.id)}
          className={
            a.primary
              ? "rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground disabled:opacity-50"
              : "rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:border-accent hover:text-accent disabled:opacity-50"
          }
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="mr-4 flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-3 py-2.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
    </div>
  );
}

export function ChatWidget() {
  const {
    ready,
    user,
    orders,
    tickets,
    cart,
    addToCart,
    addTicket,
    placeOrder,
    profile,
  } = useStore();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [misses, setMisses] = useState(0);
  const [checkout, setCheckout] = useState<CheckoutDraft | null>(null);
  const [memory, setMemory] = useState<ConversationMemory>(() => emptyMemory());
  const [addedSku, setAddedSku] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const memoryRef = useRef(memory);
  memoryRef.current = memory;
  const askRef = useRef<(text: string) => Promise<void>>(async () => {});
  const resumeDoneRef = useRef(false);

  const cartCount = useMemo(
    () => Object.values(cart).reduce((s, q) => s + q, 0),
    [cart],
  );

  const session = useMemo(() => {
    if (!user) return { authenticated: false as const };
    return {
      authenticated: true as const,
      userName: user.name,
      email: user.email,
      orders: ordersToSession(orders, user.email),
      tickets: ticketsToSession(tickets, user.email),
    };
  }, [user, orders, tickets]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!addedSku) return;
    const t = window.setTimeout(() => setAddedSku(null), 1800);
    return () => window.clearTimeout(t);
  }, [addedSku]);

  const pushAssistant = (
    next: Msg[],
    content: string,
    extra?: { products?: RagMetaProduct[]; actions?: MsgAction[]; kind?: MsgKind },
  ) => {
    const msg: Msg = {
      role: "assistant",
      content,
      kind: extra?.kind ?? "default",
      ...(extra?.products?.length ? { products: extra.products } : {}),
      ...(extra?.actions?.length ? { actions: extra.actions } : {}),
    };
    setMsgs([...next, msg]);
  };

  const pushLogin = (next: Msg[], reason?: string) => {
    const lastUser = [...next].reverse().find((m) => m.role === "user");
    if (lastUser?.content) saveChatResume(lastUser.content);
    if (reason) logChatEvent("auth_blocked", { detail: reason });
    else logChatEvent("auth_blocked");
    pushAssistant(next, reason || LOGIN_REQUIRED_REPLY, { kind: "login" });
  };

  const createSavTicket = (fromMsgs: Msg[], flow = memoryRef.current.sav) => {
    if (!user) {
      pushLogin(fromMsgs, LOGIN_REQUIRED_REPLY);
      return;
    }
    const draft = buildTicketDraft(flow, user.name);
    const ticket = addTicket({
      subject: draft.subject,
      message: draft.message,
      priority: draft.priority,
      targetSla: draft.targetSla,
      issueType: draft.issueType,
      ...(draft.orderId ? { orderId: draft.orderId } : {}),
      channel: "Chatbot site web",
      contactConsent: true,
    });
    setMemory(emptyMemory());
    if (ticket?.id) logChatEvent("ticket_created", { detail: ticket.id });
    pushAssistant(
      fromMsgs,
      ticket
        ? `Ticket **${ticket.id}** créé (Ouvert) — priorité **${ticket.priority ?? draft.priority}**.\n\nDélai cible de première réponse : **${ticket.targetSla ?? draft.targetSla}**.\nVous recevrez un suivi à chaque étape (démo).\n\nRécapitulatif :\n${draft.message}\n\nAucun remboursement n'est promis — un conseiller traitera la demande.`
        : "Impossible de créer le ticket. Réessayez depuis Mon compte.",
      ticket
        ? { kind: "success", actions: [{ id: "go_account", label: "Voir mon compte" }] }
        : { kind: "success" },
    );
  };

  const handleAction = (id: string) => {
    if (id === "create_sav_ticket" || id === "sav_confirm_ticket") {
      createSavTicket(msgs);
      return;
    }
    if (id.startsWith("sav_order:")) {
      void ask(id.slice("sav_order:".length));
      return;
    }
    if (id.startsWith("sav_issue:")) {
      const issue = id.slice("sav_issue:".length) as SavIssue;
      void ask(issueLabel(issue));
      return;
    }
    if (id === "sav_start_with_last") {
      const oid = memoryRef.current.lastOrderId;
      void ask(
        oid
          ? `J'ai un problème avec la commande ${oid}`
          : "J'ai un problème avec une commande",
      );
      return;
    }
    if (id === "go_account") {
      window.location.href = "/compte";
      return;
    }
    if (id === "go_login") {
      const lastUser = [...msgs].reverse().find((m) => m.role === "user");
      if (lastUser?.content) saveChatResume(lastUser.content);
      window.location.href = `/connexion?redirect=${encodeURIComponent(CHAT_RESUME_REDIRECT)}`;
      return;
    }
    if (id.startsWith("carrier:")) {
      const name = id.slice("carrier:".length);
      void ask(name);
      return;
    }
    if (id === "view_cart") void ask("mon panier");
    if (id === "start_checkout") void ask("commander");
    if (id === "confirm_order") void ask("Je confirme");
  };

  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const userText = text.trim();
    const next: Msg[] = [...msgs, { role: "user", content: userText }];
    setMsgs(next);
    setInput("");
    setBusy(true);

    const cartIntent = detectCartIntent(userText);
    const intent = detectChatIntent(userText);
    logChatEvent("message", { intent, detail: userText });

    if (checkout) {
      const carrierPick = parseCarrier(userText);
      if (carrierPick) {
        setCheckout({ carrier: carrierPick });
        const addr = defaultShippingAddress(user?.name ?? "", profile.shipping);
        pushAssistant(next, formatCheckoutPrompt(cart, carrierPick, addr), {
          kind: "cart",
          actions: [
            ...CHAT_CARRIERS.filter((c) => c !== carrierPick).map((c) => ({
              id: `carrier:${c}`,
              label: c,
            })),
            { id: "confirm_order", label: "Je confirme", primary: true },
          ],
        });
        setBusy(false);
        return;
      }
      if (cartIntent === "confirm_order" || /^(oui|ok)\.?$/i.test(userText)) {
        if (!user) {
          pushLogin(next);
          setCheckout(null);
          setBusy(false);
          return;
        }
        if (!Object.keys(cart).length) {
          pushAssistant(next, "Votre panier est vide — impossible de commander.");
          setCheckout(null);
          setBusy(false);
          return;
        }
        const addr = defaultShippingAddress(user.name, profile.shipping);
        const order = placeOrder(checkout.carrier, addr);
        setCheckout(null);
        if (order?.id) logChatEvent("order_placed", { detail: order.id });
        pushAssistant(
          next,
          order
            ? `Commande **${order.id}** créée (paiement démo).\nStatut : **En préparation** · ${checkout.carrier}`
            : "La commande n'a pas pu être créée. Réessayez via le panier.",
          {
            kind: "success",
            actions: order
              ? [
                  { id: "go_account", label: "Suivre la commande", primary: true },
                  { id: "view_cart", label: "Continuer mes achats" },
                ]
              : [{ id: "view_cart", label: "Voir le panier" }],
          },
        );
        setBusy(false);
        return;
      }
      if (cartIntent === "view_cart") {
        setCheckout(null);
        logChatEvent("view_cart");
        pushAssistant(next, formatCartReply(cart), {
          kind: "cart",
          ...(Object.keys(cart).length
            ? { actions: [{ id: "start_checkout", label: "Commander", primary: true }] }
            : {}),
        });
        setBusy(false);
        return;
      }
      setCheckout(null);
    }

    if (cartIntent === "view_cart") {
      logChatEvent("view_cart");
      pushAssistant(next, formatCartReply(cart), {
        kind: "cart",
        ...(Object.keys(cart).length
          ? { actions: [{ id: "start_checkout", label: "Commander", primary: true }] }
          : {}),
      });
      setBusy(false);
      return;
    }
    if (cartIntent === "start_checkout") {
      if (!user) {
        pushLogin(next);
        setBusy(false);
        return;
      }
      if (!Object.keys(cart).length) {
        pushAssistant(next, formatCartReply(cart));
        setBusy(false);
        return;
      }
      const carrier: ChatCarrier = "Colissimo";
      setCheckout({ carrier });
      logChatEvent("checkout_start");
      const addr = defaultShippingAddress(user.name, profile.shipping);
      pushAssistant(next, formatCheckoutPrompt(cart, carrier, addr), {
        kind: "cart",
        actions: [
          ...CHAT_CARRIERS.filter((c) => c !== carrier).map((c) => ({
            id: `carrier:${c}`,
            label: c,
          })),
          { id: "confirm_order", label: "Je confirme", primary: true },
        ],
      });
      setBusy(false);
      return;
    }

    if (requiresAuth(intent) && !user) {
      pushLogin(next);
      setBusy(false);
      return;
    }

    if (/^(je\s+cherche\s+un\s+produit|trouver\s+un\s+produit)\.?$/i.test(userText)) {
      pushAssistant(
        next,
        "Que cherchez-vous ? Indiquez l'usage, la marque ou le budget — par exemple « masque snorkeling adulte autour de 30 € ».",
      );
      setBusy(false);
      return;
    }

    if (intent === "handoff") {
      const summary = next
        .slice(-6)
        .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
        .join("\n");
      const ticket = user ? addTicket("Demande conseiller (chat)", summary || userText) : null;
      if (ticket?.id) logChatEvent("handoff", { detail: ticket.id });
      else logChatEvent("handoff");
      setMemory(emptyMemory());
      pushAssistant(
        next,
        HANDOFF_REPLY +
          (ticket
            ? `\n\nTicket **${ticket.id}** créé.`
            : "\n\nConnectez-vous pour laisser un ticket suivi."),
        {
          kind: "success",
          actions: ticket
            ? [{ id: "go_account", label: "Voir mon compte", primary: true }]
            : [{ id: "go_login", label: "Se connecter", primary: true }],
        },
      );
      setMisses(0);
      setBusy(false);
      return;
    }

    const userOrders = session.authenticated ? (session.orders ?? []) : [];
    let mem = memoryRef.current;

    const promptSavIssue = (orderId: string, orderStatus: string, knownIssue?: SavIssue) => {
      if (knownIssue) {
        const nextSav = {
          step: (knownIssue === "autre" ? "need_details" : "ready") as ConversationMemory["sav"]["step"],
          orderId,
          orderStatus,
          issue: knownIssue,
        };
        mem = { activeFlow: "sav", lastOrderId: orderId, sav: nextSav };
        setMemory(mem);
        if (knownIssue === "autre") {
          pushAssistant(
            next,
            `Commande **${orderId}** — décrivez brièvement le problème, puis je crée le ticket.`,
          );
        } else {
          const draft = buildTicketDraft(nextSav, user!.name);
          pushAssistant(
            next,
            `Motif retenu : **${issueLabel(knownIssue)}** pour **${orderId}**.\n\nSouhaitez-vous ajouter un détail, ou créer le ticket maintenant ?\n\n_Aperçu_ : ${draft.subject}`,
            {
              actions: [
                { id: "sav_confirm_ticket", label: "Créer le ticket SAV", primary: true },
                { id: "go_account", label: "Voir mon compte" },
              ],
            },
          );
        }
        setMisses(0);
        setBusy(false);
        return;
      }
      mem = {
        activeFlow: "sav",
        lastOrderId: orderId,
        sav: { step: "need_issue", orderId, orderStatus },
      };
      setMemory(mem);
      const order = findOrder(userOrders, orderId);
      pushAssistant(
        next,
        `${order ? formatSavOrderCard(order) + "\n\n" : ""}Quel est le problème avec cette commande ?`,
        {
          actions: SAV_ISSUE_OPTIONS.map((o) => ({
            id: `sav_issue:${o.id}`,
            label: o.label,
            primary: o.id === "endommagé",
          })),
        },
      );
      setMisses(0);
      setBusy(false);
    };

    const advanceSavToIssue = (orderId: string, knownIssue?: SavIssue) => {
      const order = findOrder(userOrders, orderId);
      if (!order) {
        pushAssistant(
          next,
          `Je ne trouve pas **${orderId}** sur votre compte. Vérifiez le numéro ou choisissez une commande ci-dessous.`,
          {
            actions: userOrders.slice(0, 5).map((o) => ({
              id: `sav_order:${o.id}`,
              label: o.id,
            })),
          },
        );
        setBusy(false);
        return false;
      }
      promptSavIssue(order.id, order.status, knownIssue ?? mem.sav.issue);
      return true;
    };

    /** Multi-turn SAV — keep context until ticket or Effacer */
    if (mem.activeFlow === "sav" && user) {
      const oid = parseOrderId(userText);
      const issue = detectSavIssue(userText);
      const wantsTicket =
        /^(cr[eé]er(\s+le)?\s+ticket|je\s+confirme|confirmer|ok\s+ticket)\.?$/i.test(
          userText,
        );

      if (oid && mem.sav.step !== "idle") {
        advanceSavToIssue(oid, issue ?? undefined);
        return;
      }

      if (mem.sav.step === "need_order") {
        if (issue) {
          mem = { ...mem, sav: { ...mem.sav, issue } };
          setMemory(mem);
          pushAssistant(
            next,
            `Motif noté : **${issueLabel(issue)}**. Indiquez maintenant le **numéro de commande** (ex. CMD-1101) :`,
            {
              actions: userOrders.slice(0, 5).map((o) => ({
                id: `sav_order:${o.id}`,
                label: `${o.id} · ${o.status}`,
              })),
            },
          );
          setBusy(false);
          return;
        }
        pushAssistant(
          next,
          "Indiquez le **numéro de commande** (ex. CMD-1101) ou choisissez parmi vos commandes récentes :",
          {
            actions: userOrders.slice(0, 5).map((o) => ({
              id: `sav_order:${o.id}`,
              label: `${o.id} · ${o.status}`,
            })),
          },
        );
        setBusy(false);
        return;
      }

      if (mem.sav.step === "need_issue") {
        if (issue && mem.sav.orderId && mem.sav.orderStatus) {
          promptSavIssue(mem.sav.orderId, mem.sav.orderStatus, issue);
          return;
        }
        pushAssistant(
          next,
          "Précisez le motif ou choisissez une option :",
          {
            actions: SAV_ISSUE_OPTIONS.map((o) => ({
              id: `sav_issue:${o.id}`,
              label: o.label,
            })),
          },
        );
        setBusy(false);
        return;
      }

      if (mem.sav.step === "need_details" || mem.sav.step === "ready") {
        if (wantsTicket) {
          createSavTicket(next, mem.sav);
          setBusy(false);
          return;
        }
        const withDetails = {
          ...mem.sav,
          details: userText.slice(0, 1500),
          step: "ready" as const,
          ...(issue ? { issue } : {}),
        };
        mem = { ...mem, sav: withDetails };
        setMemory(mem);
        const draft = buildTicketDraft(withDetails, user.name);
        pushAssistant(
          next,
          `Merci, j'ai noté votre message.\n\n${draft.message}\n\nJe crée le ticket ?`,
          {
            actions: [
              { id: "sav_confirm_ticket", label: "Créer le ticket SAV", primary: true },
            ],
          },
        );
        setMisses(0);
        setBusy(false);
        return;
      }
    }

    /** Start guided SAV */
    if (intent === "sav" && user) {
      const prefill = parseOrderId(userText);
      if (prefill && findOrder(userOrders, prefill)) {
        advanceSavToIssue(prefill);
        return;
      }
      mem = {
        activeFlow: "sav",
        sav: { step: "need_order" },
        ...(mem.lastOrderId ? { lastOrderId: mem.lastOrderId } : {}),
      };
      setMemory(mem);
      const list =
        userOrders.length > 0
          ? userOrders
              .slice(0, 5)
              .map((o) => `- **${o.id}** (${o.date}) — ${o.status}`)
              .join("\n")
          : "_Aucune commande récente sur ce compte._";
      const example = userOrders[0]?.id ?? "CMD-1101";
      pushAssistant(
        next,
        `Bonjour ${user.name.split(" ")[0]}, je vous guide pour le SAV.\n\n**Étape 1/3** — Quelle commande est concernée ?\n\n${list}\n\nDonnez le numéro (ex. ${example}) ou touchez une commande :`,
        {
          actions: [
            ...userOrders.slice(0, 4).map((o) => ({
              id: `sav_order:${o.id}`,
              label: o.id,
              primary: o === userOrders[0],
            })),
          ],
        },
      );
      setMisses(0);
      setBusy(false);
      return;
    }

    /** Bare order id keeps context (tracking, not FAQ) */
    if (user && (intent === "order_tracking" || isMostlyOrderId(userText))) {
      const oid = parseOrderId(userText);
      if (oid) {
        setMemory({
          ...mem,
          lastOrderId: oid,
          activeFlow: "tracking",
          sav: { step: "idle" },
        });
      }
      const reply = buildOrderTrackingReply(userOrders, userText);
      const actions: MsgAction[] = [{ id: "go_account", label: "Ouvrir mon compte" }];
      if (oid && findOrder(userOrders, oid)) {
        actions.unshift({
          id: "sav_start_with_last",
          label: "Problème avec cette commande",
          primary: true,
        });
      }
      pushAssistant(next, reply, { actions });
      setMisses(0);
      setBusy(false);
      return;
    }

    setMsgs([...next, { role: "assistant", content: "" }]);

    let assembled = "";
    let sawError = false;
    let metaProducts: RagMetaProduct[] = [];

    try {
      await streamRagChat(next, {
        signal: ac.signal,
        session,
        onMeta: (plist) => {
          metaProducts = plist;
        },
        onToken: (chunk) => {
          assembled += chunk;
          const snapshot = assembled;
          const mid: Msg = metaProducts.length
            ? {
                role: "assistant",
                content: stripTicketMarker(snapshot),
                products: metaProducts,
              }
            : { role: "assistant", content: stripTicketMarker(snapshot) };
          setMsgs([...next, mid]);
        },
        onError: (message) => {
          sawError = true;
          setMsgs([...next, { role: "assistant", content: `Impossible de répondre : ${message}` }]);
        },
        onDone: () => {
          if (sawError) return;
          if (!assembled.trim()) {
            const n = misses + 1;
            setMisses(n);
            logChatEvent("dont_know");
            const missMsg: Msg =
              n >= 2
                ? {
                    role: "assistant",
                    content:
                      "Je n'ai pas bien compris. Reformulez, ou demandez à parler à un conseiller.",
                    actions: [
                      { id: "handoff_ask", label: "Parler à un conseiller", primary: true },
                    ],
                  }
                : {
                    role: "assistant",
                    content:
                      "Je ne trouve pas d'information utile. Reformulez ou choisissez un sujet.",
                  };
            setMsgs([...next, missMsg]);
            return;
          }

          setMisses(0);
          const ticketSpec = parseCreateTicket(assembled);
          let content = stripTicketMarker(assembled);
          const actions: MsgAction[] = [];

          if (ticketSpec && user) {
            const ticket = addTicket({
              subject: ticketSpec.subject,
              message: ticketSpec.message,
              priority: "P3",
              targetSla: "2 jours ouvrés",
              channel: "Chatbot site web",
              contactConsent: true,
            });
            if (ticket) {
              content += `\n\nTicket **${ticket.id}** créé (Ouvert) — priorité **${ticket.priority}**, délai cible **${ticket.targetSla}**.`;
              setMemory(emptyMemory());
              logChatEvent("ticket_created", { detail: ticket.id });
              actions.push({ id: "go_account", label: "Voir mon compte" });
            }
          }

          if (metaProducts.length) {
            actions.push({ id: "view_cart", label: "Voir mon panier" });
          }

          setMsgs([
            ...next,
            {
              role: "assistant",
              content,
              ...(metaProducts.length ? { products: metaProducts } : {}),
              ...(actions.length ? { actions } : {}),
            },
          ]);
        },
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : String(e);
      setMsgs([...next, { role: "assistant", content: `Impossible de joindre l'assistant (${msg}).` }]);
    } finally {
      setBusy(false);
    }
  };

  askRef.current = ask;

  /** After login: reopen chat and replay the blocked request (wait for store hydrate) */
  useEffect(() => {
    if (!ready || !user || resumeDoneRef.current) return;
    let fromRedirect = false;
    try {
      fromRedirect = new URLSearchParams(window.location.search).get("chat") === "resume";
    } catch {
      fromRedirect = false;
    }
    if (!fromRedirect) return;
    resumeDoneRef.current = true;
    setOpen(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("chat");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* ignore */
    }
    const payload = takeChatResume();
    if (!payload?.prompt) return;
    const t = window.setTimeout(() => {
      void askRef.current(payload.prompt);
    }, 200);
    return () => window.clearTimeout(t);
  }, [ready, user]);

  // wire handoff_ask action
  const onAction = (id: string) => {
    if (id === "handoff_ask") {
      void ask("Je veux parler à un conseiller");
      return;
    }
    handleAction(id);
  };

  const onAddProduct = (sku: string, name: string) => {
    addToCart(sku, 1);
    setAddedSku(sku);
    logChatEvent("add_to_cart", { detail: sku });
    setMsgs((prev) => [
      ...prev,
      {
        role: "assistant",
        content: `**${name}** est dans votre panier.`,
        kind: "success",
        actions: [
          { id: "view_cart", label: "Voir mon panier" },
          { id: "start_checkout", label: "Commander", primary: true },
        ],
      },
    ]);
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMsgs([]);
    setCheckout(null);
    setMemory(emptyMemory());
    setMisses(0);
    setBusy(false);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[min(640px,78vh)] w-[min(400px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 bg-primary px-4 py-3 text-primary-foreground">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">
              M
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-bold leading-tight">Assistant Marinéo</p>
              <p className="truncate text-[11px] opacity-80">
                {user ? `${user.name.split(" ")[0]} · connecté` : "Invité · catalogue & infos"}
                {checkout
                  ? " · commande en cours"
                  : memory.activeFlow === "sav"
                    ? " · SAV en cours"
                    : memory.lastOrderId
                      ? ` · ${memory.lastOrderId}`
                      : ""}
              </p>
            </div>
            {msgs.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="rounded-md px-2 py-1 text-[11px] font-semibold opacity-80 hover:bg-white/10 hover:opacity-100"
              >
                Effacer
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
              className="grid h-8 w-8 place-items-center rounded-md text-lg leading-none hover:bg-white/10"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-3 text-sm">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-2xl rounded-tl-md bg-card p-3.5 shadow-sm ring-1 ring-border">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Assistant virtuel
                  </p>
                  <p className="mt-1.5 leading-relaxed">
                    Bonjour{user ? ` ${user.name.split(" ")[0]}` : ""} ! Je peux vous aider sur le
                    catalogue, la livraison et les retours.
                    {user
                      ? " Votre compte permet aussi le suivi, le panier et le SAV."
                      : ""}
                  </p>
                </div>

                {!user && (
                  <div className="rounded-xl border border-dashed border-accent/40 bg-accent/5 p-3">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Connectez-vous pour suivre une commande ou ouvrir un ticket SAV.
                    </p>
                    <a
                      href="/connexion"
                      className="mt-2 inline-flex rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground"
                    >
                      Se connecter
                    </a>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((q) => {
                    const locked = Boolean(q.needsAuth && !user);
                    return (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => void ask(q.prompt)}
                        className="rounded-xl border bg-card px-3 py-2.5 text-left text-xs font-semibold leading-snug transition hover:border-accent hover:text-accent"
                      >
                        <span className="block">{q.label}</span>
                        {locked && (
                          <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                            Connexion requise
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => void ask("Je veux parler à un conseiller")}
                  className="w-full rounded-lg py-2 text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Parler à un conseiller
                </button>
              </div>
            )}

            {msgs.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div
                    key={i}
                    className="ml-10 rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-primary-foreground"
                  >
                    {m.content}
                  </div>
                );
              }
              if (!m.content && !m.products?.length) return null;
              return (
                <div key={i} className="mr-6 max-w-[95%]">
                  <div
                    className={
                      m.kind === "success"
                        ? "rounded-2xl rounded-bl-md border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2.5"
                        : m.kind === "cart"
                          ? "rounded-2xl rounded-bl-md border border-accent/25 bg-accent/5 px-3.5 py-2.5"
                          : m.kind === "login"
                            ? "rounded-2xl rounded-bl-md border bg-card px-3.5 py-2.5"
                            : "rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 shadow-sm ring-1 ring-border"
                    }
                  >
                    {(() => {
                      const hasCards = Boolean(m.products?.length);
                      const body = render(m.content, hasCards);
                      if (body) return body;
                      if (hasCards) {
                        const oos = m.products!.every((p) => p.stock <= 0);
                        return (
                          <p className="text-sm leading-relaxed">
                            {oos
                              ? "Voici les articles trouvés — actuellement en rupture de stock :"
                              : "Voici les articles trouvés :"}
                          </p>
                        );
                      }
                      return null;
                    })()}
                    {m.kind === "login" && <LoginGate />}
                    {m.products && m.products.length > 0 && (
                      <ProductCards
                        products={m.products}
                        addedSku={addedSku}
                        onAdd={(sku) => {
                          const p = m.products?.find((x) => x.sku === sku);
                          onAddProduct(sku, p?.name ?? sku);
                        }}
                      />
                    )}
                    {m.actions && m.actions.length > 0 && (
                      <ActionRow actions={m.actions} busy={busy} onAction={onAction} />
                    )}
                  </div>
                </div>
              );
            })}

            {busy && <TypingDots />}
            <div ref={end} />
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="border-t bg-card p-3"
          >
            {checkout && (
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                Validation commande — confirmez ou changez le transporteur
              </p>
            )}
            {memory.activeFlow === "sav" && !checkout && (
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                {memory.sav.step === "need_order"
                  ? "SAV — indiquez le n° de commande"
                  : memory.sav.step === "need_issue"
                    ? `SAV — motif pour ${memory.sav.orderId}`
                    : memory.sav.step === "need_details"
                      ? "SAV — décrivez le problème"
                      : "SAV — confirmez le ticket"}
              </p>
            )}
            <div className="flex gap-2">
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  checkout
                    ? "Je confirme ou Chronopost…"
                    : memory.activeFlow === "sav"
                      ? memory.sav.step === "need_order"
                        ? "Ex. CMD-1101…"
                        : memory.sav.step === "need_issue"
                          ? "Endommagé, pas reçu…"
                          : "Détail ou « créer le ticket »…"
                      : user
                        ? "Produit, panier, commande, SAV…"
                        : "Produit, livraison, magasin…"
                }
                className="min-w-0 flex-1 rounded-xl border bg-muted/50 px-3.5 py-2.5 text-sm outline-none ring-accent focus:ring-2"
              />
              <button
                disabled={busy || !input.trim()}
                type="submit"
                className="rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-40"
              >
                Envoyer
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant"}
        className="fixed bottom-4 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-foreground shadow-xl transition hover:scale-105"
      >
        {open ? (
          <span className="text-2xl leading-none">×</span>
        ) : (
          <span className="relative">
            <span className="font-display text-lg font-bold">M</span>
            {cartCount > 0 && (
              <span className="absolute -right-3 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </span>
        )}
      </button>
    </>
  );
}
