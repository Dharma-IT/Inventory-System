export type ProductRecord = {
  id: string;
  name: string;
  sku: string;
  opening: number;
  received: number;
  shipped: number;
  weekly: number;
  lead: number;
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!url || !key)
    throw new Error("Supabase environment variables are missing.");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Supabase request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const database = {
  products: () =>
    request<ProductRecord[]>(
      "products?select=id,name,sku,opening,received,shipped,weekly,lead&order=created_at.asc",
    ),
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
};
