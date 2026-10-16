import type React from "react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initialOrders, products, testUsers, type Order, type Status, type User } from "./data";
import { fetchOrdersFromSupabase } from "./orders";

export type Address = { name: string; street: string; zip: string; city: string; phone: string };
export type Profile = { newsletter: boolean; billing?: Address; shipping?: Address };
export type TicketPriority = "P1" | "P2" | "P3" | "P4";
export type Ticket = {
  id: string;
  email: string;
  subject: string;
  message: string;
  date: string;
  status: "Ouvert" | "Résolu";
  /** POC fields (optional for legacy tickets) */
  orderId?: string;
  issueType?: string;
  priority?: TicketPriority;
  targetSla?: string;
  channel?: string;
  contactConsent?: boolean;
};

export type AddTicketInput = {
  subject: string;
  message: string;
  orderId?: string;
  issueType?: string;
  priority?: TicketPriority;
  targetSla?: string;
  channel?: string;
  contactConsent?: boolean;
};

type Ctx = {
  /** True after first localStorage / orders hydrate (avoids resume-before-orders). */
  ready: boolean;
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  cart: Record<string, number>;
  addToCart: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  clearCart: () => void;
  orders: Order[];
  setStatus: (id: string, s: Status) => void;
  placeOrder: (carrier: string, shipping: Address) => Order | null;
  profile: Profile;
  updateProfile: (p: Partial<Profile>) => void;
  tickets: Ticket[];
  addTicket: (subjectOrInput: string | AddTicketInput, message?: string) => Ticket | null;
  setTicketStatus: (id: string, s: Ticket["status"]) => void;
};
const g = globalThis as unknown as { __storeCtx?: React.Context<Ctx | null> };
const StoreCtx = (g.__storeCtx ??= createContext<Ctx | null>(null));

const STORE_VERSION = "orders-db-v1";
const read = <T,>(k: string, d: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* quota / private mode */
  }
};
const cartKey = (u: User | null) => `demo-cart:${u?.email ?? "guest"}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCartState] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Order[]>(() => initialOrders);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (localStorage.getItem("demo-store-version") !== STORE_VERSION) {
          for (const k of Object.keys(localStorage)) {
            if (k.startsWith("demo-")) localStorage.removeItem(k);
          }
          localStorage.setItem("demo-store-version", STORE_VERSION);
        }
        const u = testUsers.find((x) => x.email === localStorage.getItem("demo-user")) ?? null;
        setUser(u);
        const rawCart = read<Record<string, number>>(cartKey(u), {});
        const cleanCart = Object.fromEntries(
          Object.entries(rawCart).filter(([id]) => products.some((p) => p.id === id)),
        );
        setCartState(cleanCart);
        write(cartKey(u), cleanCart);
        setProfiles(read("demo-profiles", {}));
        setTickets(read("demo-tickets", []));

        // Prefer Supabase demo orders; keep locally placed orders on top
        const localExtra = read<Order[]>("demo-orders-local", []);
        let fromDb: Order[] = [];
        try {
          fromDb = await fetchOrdersFromSupabase();
        } catch (err) {
          console.warn("[StoreProvider] orders fetch failed, using catalog seed", err);
          fromDb = initialOrders;
        }
        if (cancelled) return;
        const byId = new Map<string, Order>();
        for (const o of fromDb) byId.set(o.id, o);
        for (const o of localExtra) byId.set(o.id, o);
        const merged = [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
        setOrders(merged.length ? merged : initialOrders);
      } catch (e) {
        console.error("[StoreProvider] init failed", e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setCart = (u: User | null, c: Record<string, number>) => { write(cartKey(u), c); setCartState(c); };
  const saveOrders = (o: Order[]) => {
    // Persist only orders not coming from the seeded DB set (local placements / admin edits)
    write("demo-orders-local", o);
    setOrders(o);
  };

  const login = (email: string, password: string) => {
    const u = testUsers.find((x) => x.email === email && x.password === password);
    if (!u) return false;
    // fusionne le panier invité dans le panier du compte
    const guest = read<Record<string, number>>(cartKey(null), {});
    const mine = read<Record<string, number>>(cartKey(u), {});
    for (const [id, q] of Object.entries(guest)) mine[id] = (mine[id] ?? 0) + q;
    localStorage.removeItem(cartKey(null));
    localStorage.setItem("demo-user", u.email);
    setUser(u);
    setCart(u, mine);
    return true;
  };
  const logout = () => { localStorage.removeItem("demo-user"); setUser(null); setCartState(read(cartKey(null), {})); };

  const setQty = (id: string, qty: number) => {
    const c = { ...cart };
    if (qty <= 0) delete c[id]; else c[id] = qty;
    setCart(user, c);
  };

  const profile = (user && profiles[user.email]) || { newsletter: false };
  const updateProfile = (p: Partial<Profile>) => {
    if (!user) return;
    const all = { ...profiles, [user.email]: { ...profile, ...p } };
    write("demo-profiles", all); setProfiles(all);
  };

  const placeOrder = (carrier: string, shipping: Address) => {
    if (!user || Object.keys(cart).length === 0) return null;
    const max = Math.max(...orders.map((o) => Number(o.id.split("-")[1])));
    const o: Order = {
      id: `CMD-${max + 1}`, customer: user.name, email: user.email,
      date: new Date().toISOString().slice(0, 10),
      items: Object.entries(cart).filter(([id]) => products.some((p) => p.id === id)).map(([id, qty]) => ({ id, qty })),
      status: "En préparation", carrier, shipping,
    };
    saveOrders([o, ...orders]);
    setCart(user, {});
    return o;
  };

  const saveTickets = (t: Ticket[]) => { write("demo-tickets", t); setTickets(t); };

  return (
    <StoreCtx.Provider value={{
      ready, user, login, logout, cart, orders, profile, updateProfile, placeOrder, setQty, tickets,
      addToCart: (id, qty = 1) => setQty(id, (cart[id] ?? 0) + qty),
      clearCart: () => setCart(user, {}),
      setStatus: (id, s) => saveOrders(orders.map((o) => (o.id === id ? { ...o, status: s } : o))),
      addTicket: (subjectOrInput, message) => {
        if (!user) return null;
        const input: AddTicketInput =
          typeof subjectOrInput === "string"
            ? { subject: subjectOrInput, message: message ?? "" }
            : subjectOrInput;
        if (!input.subject.trim() || !input.message.trim()) return null;
        const maxN = tickets.reduce((m, t) => {
          const n = Number(/^SAV-TEST-(\d+)$/i.exec(t.id)?.[1] ?? 0);
          return Number.isFinite(n) ? Math.max(m, n) : m;
        }, 0);
        const ticket: Ticket = {
          id: `SAV-TEST-${String(maxN + 1).padStart(4, "0")}`,
          email: user.email,
          subject: input.subject.trim().slice(0, 120),
          message: input.message.trim().slice(0, 2000),
          date: new Date().toISOString().slice(0, 10),
          status: "Ouvert",
          channel: input.channel ?? "Chatbot site web",
          contactConsent: input.contactConsent ?? true,
          priority: input.priority ?? "P3",
          targetSla: input.targetSla ?? "2 jours ouvrés",
          ...(input.orderId ? { orderId: input.orderId } : {}),
          ...(input.issueType ? { issueType: input.issueType } : {}),
        };
        saveTickets([ticket, ...tickets]);
        return ticket;
      },
      setTicketStatus: (id, s) => saveTickets(tickets.map((t) => (t.id === id ? { ...t, status: s } : t))),
    }}>{children}</StoreCtx.Provider>
  );
}
export const useStore = () => useContext(StoreCtx)!;

export const SHIPPING_FREE_FROM = 69;
export const shippingCost = (subtotal: number, carrier: string) =>
  carrier === "Retrait magasin" || subtotal >= SHIPPING_FREE_FROM ? 0 : carrier === "Chronopost" ? 9.9 : 5.9;
