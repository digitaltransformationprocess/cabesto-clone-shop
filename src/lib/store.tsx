import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { initialOrders, testUsers, type Order, type Status, type User } from "./data";

type Ctx = {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  cart: Record<string, number>;
  addToCart: (id: string) => void;
  clearCart: () => void;
  orders: Order[];
  setStatus: (id: string, s: Status) => void;
};
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  useEffect(() => {
    const email = localStorage.getItem("demo-user");
    setUser(testUsers.find((u) => u.email === email) ?? null);
  }, []);

  const login = (email: string, password: string) => {
    const u = testUsers.find((x) => x.email === email && x.password === password);
    if (!u) return false;
    localStorage.setItem("demo-user", u.email);
    setUser(u);
    return true;
  };
  const logout = () => { localStorage.removeItem("demo-user"); setUser(null); };

  return (
    <StoreCtx.Provider value={{
      user, login, logout, cart, orders,
      addToCart: (id) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 })),
      clearCart: () => setCart({}),
      setStatus: (id, s) => setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: s } : o))),
    }}>{children}</StoreCtx.Provider>
  );
}
export const useStore = () => useContext(StoreCtx)!;
