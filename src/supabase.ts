import { createClient } from "@supabase/supabase-js";

export type ProductRecord = {
  id: string;
  name: string;
  sku: string;
  opening: number;
  received: number;
  shipped: number;
  weekly: number;
  lead: number;
  position: number;
};

export type MovementRecord = {
  id: string;
  date: string;
  product_id: string;
  type: "Receipt" | "Shipment";
  quantity: number;
  note: string;
};

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export async function authHeaders() {
  if (!supabase) throw new Error("Supabase environment variables are missing.");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("Please sign in to continue.");
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!url || !key)
    throw new Error("Supabase environment variables are missing.");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      ...await authHeaders(),
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try {
      const error: unknown = JSON.parse(body);
      if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
        message = error.message;
      }
    } catch { /* Non-JSON errors use the response text. */ }
    throw new Error(message || `Supabase request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type LocationProduct = { id: string; name: string; storage: number; clinic: number };
export type LocationActivity = { id: string; date: string; product_id: string; product_name: string; type: "Added" | "Transfer" | "Stock added" | "Adjusted" | "Deleted"; quantity: number; note: string };

export const database = {
  locationProducts: () => request<LocationProduct[]>("location_products?select=id,name,storage,clinic&order=created_at.asc"),
  deleteLocationMovement: (id: string) => request<void>("rpc/delete_location_movement", {
    method: "POST", body: JSON.stringify({ p_id: id }),
  }),
  locationActivity: () => request<LocationActivity[]>("location_movements?select=id,date,product_id,product_name,type,quantity,note&order=created_at.desc"),
  addLocationStock: (productId: string, quantity: number, location: string) => request<void>("rpc/add_location_stock", {
    method: "POST", body: JSON.stringify({ p_product_id: productId, p_quantity: quantity, p_location: location }),
  }),
  addLocationProduct: (name: string, quantity: number, location: string) => request<void>("rpc/add_location_product", {
    method: "POST", body: JSON.stringify({ p_name: name, p_quantity: quantity, p_location: location }),
  }),
  changeLocationProduct: (id: string, quantity: number, location: string, action: "increase" | "edit" | "delete") => request<void>("rpc/change_location_product", {
    method: "POST", body: JSON.stringify({ p_id: id, p_quantity: quantity, p_location: location, p_action: action }),
  }),
  transferProduct: (id: string, quantity: number, source: string) => request<void>("rpc/transfer_location_product", {
    method: "POST", body: JSON.stringify({ p_id: id, p_quantity: quantity, p_source: source }),
  }),
  products: () =>
    request<ProductRecord[]>(
      "products?select=id,name,sku,opening,received,shipped,weekly,lead,position&order=position.asc,created_at.asc,id.asc",
    ),
  reorderProducts: (ids: string[]) =>
    request<void>("rpc/reorder_products", {
      method: "POST",
      body: JSON.stringify({ p_ids: ids }),
    }),
  movements: () =>
    request<MovementRecord[]>(
      "movements?select=id,date,product_id,type,quantity,note&order=created_at.desc",
    ),
  saveProduct: (product: ProductRecord, editing: boolean) =>
    editing
      ? request<ProductRecord[]>(
          `products?id=eq.${encodeURIComponent(product.id)}`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(product),
          },
        )
      : request<ProductRecord[]>("products", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify(product),
        }),
  seedProducts: (products: ProductRecord[]) =>
    request<ProductRecord[]>("products?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(products),
    }),
  recordMovement: (movement: Omit<MovementRecord, "id">) =>
    request<MovementRecord>("rpc/record_movement", {
      method: "POST",
      body: JSON.stringify({
        p_product_id: movement.product_id,
        p_type: movement.type,
        p_quantity: movement.quantity,
        p_date: movement.date,
        p_note: movement.note,
      }),
    }),
  deleteMovement: (id: string) =>
    request<ProductRecord>("rpc/delete_movement", {
      method: "POST",
      body: JSON.stringify({ p_id: id }),
    }),
};
