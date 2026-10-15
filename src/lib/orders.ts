import type { Order, Status } from "./data";
import { statuses } from "./data";
import { getSupabase } from "./supabase";

type ShippingAddr = { name: string; street: string; zip: string; city: string; phone: string };

type DbOrder = {
  id: string;
  customer_name: string;
  email: string;
  status: string;
  carrier: string;
  ordered_at: string;
  shipping: ShippingAddr | Record<string, unknown> | null;
  tracking_code: string | null;
};

type DbItem = {
  order_id: string;
  product_sku: string;
  qty: number;
};

function asStatus(s: string): Status {
  return (statuses as readonly string[]).includes(s) ? (s as Status) : "En préparation";
}

function asShipping(raw: DbOrder["shipping"]): ShippingAddr | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o["name"] !== "string" || typeof o["street"] !== "string") return undefined;
  return {
    name: String(o["name"] ?? ""),
    street: String(o["street"] ?? ""),
    zip: String(o["zip"] ?? ""),
    city: String(o["city"] ?? ""),
    phone: String(o["phone"] ?? ""),
  };
}

/** Load demo / real orders from Supabase (public read for POC). */
export async function fetchOrdersFromSupabase(): Promise<Order[]> {
  const sb = getSupabase();
  const { data: rows, error } = await sb
    .from("orders")
    .select("id, customer_name, email, status, carrier, ordered_at, shipping, tracking_code")
    .order("ordered_at", { ascending: false });
  if (error) throw new Error(`orders: ${error.message}`);

  const list = (rows ?? []) as DbOrder[];
  if (!list.length) return [];

  const ids = list.map((o) => o.id);
  const { data: items, error: itemsErr } = await sb
    .from("order_items")
    .select("order_id, product_sku, qty")
    .in("order_id", ids);
  if (itemsErr) throw new Error(`order_items: ${itemsErr.message}`);

  const byOrder = new Map<string, { id: string; qty: number }[]>();
  for (const it of (items ?? []) as DbItem[]) {
    const arr = byOrder.get(it.order_id) ?? [];
    arr.push({ id: it.product_sku, qty: it.qty });
    byOrder.set(it.order_id, arr);
  }

  return list.map((o) => {
    const shipping = asShipping(o.shipping);
    const order: Order = {
      id: o.id,
      customer: o.customer_name,
      email: o.email,
      date: o.ordered_at,
      items: byOrder.get(o.id) ?? [],
      status: asStatus(o.status),
      carrier: o.carrier,
      ...(shipping ? { shipping } : {}),
      ...(o.tracking_code ? { trackingCode: o.tracking_code } : {}),
    };
    return order;
  });
}
