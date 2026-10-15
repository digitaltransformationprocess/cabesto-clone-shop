import type React from "react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initialOrders, products, testUsers, type Order, type Status, type User } from "./data";

export type Address = { name: string; street: string; zip: string; city: string; phone: string };
export type Profile = { newsletter: boolean; billing?: Address; shipping?: Address };
export type Ticket = { id: string; email: string; subject: string; message: string; date: string; status: "Ouvert" | "Résolu" };

type Ctx = {
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
  addTicket: (subject: string, message: string) => Ticket | null;
  setTicketStatus: (id: string, s: Ticket["status"]) => void;
};
const g = globalThis as unknown as { __storeCtx?: React.Context<Ctx | null> };
const StoreCtx = (g.__storeCtx ??= createContext<Ctx | null>(null));

const STORE_VERSION = "catalog-v2";
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
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCartState] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Order[]>(() => initialOrders);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
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
      const rawOrders = read<Order[]>("demo-orders", initialOrders);
      const cleanOrders = (Array.isArray(rawOrders) ? rawOrders : [])
        .map((o) => ({
          ...o,
          items: (o.items ?? []).filter((i) => products.some((p) => p.id === i.id)),
        }))
        .filter((o) => o.items.length > 0);
      const ordersToUse = cleanOrders.length ? cleanOrders : initialOrders;
      setOrders(ordersToUse);
      write("demo-orders", ordersToUse);
      setProfiles(read("demo-profiles", {}));
      setTickets(read("demo-tickets", []));
    } catch (e) {
      console.error("[StoreProvider] init failed", e);
    }
  }, []);

  const setCart = (u: User | null, c: Record<string, number>) => { write(cartKey(u), c); setCartState(c); };
  const saveOrders = (o: Order[]) => { write("demo-orders", o); setOrders(o); };

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
      user, login, logout, cart, orders, profile, updateProfile, placeOrder, setQty, tickets,
      addToCart: (id, qty = 1) => setQty(id, (cart[id] ?? 0) + qty),
      clearCart: () => setCart(user, {}),
      setStatus: (id, s) => saveOrders(orders.map((o) => (o.id === id ? { ...o, status: s } : o))),
      addTicket: (subject, message) => {
        if (!user) return null;
        const ticket: Ticket = {
          id: `T-${Date.now().toString().slice(-5)}`,
          email: user.email,
          subject,
          message,
          date: new Date().toISOString().slice(0, 10),
          status: "Ouvert",
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
