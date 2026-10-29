import { authHeaders } from "./supabase";
const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

function storeOffset(date: string) {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")?.value;
  return timeZoneName?.replace("GMT", "") || "-05:00";
}

export type ShopifyOrder = {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  sourceName: string;
  currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  shippingAddress: {
    firstName: string | null;
    lastName: string | null;
    address1: string | null;
    city: string | null;
    provinceCode: string | null;
    zip: string | null;
  } | null;
  lineItems: {
    nodes: Array<{
      id: string;
      name: string;
      sku: string | null;
      quantity: number;
    }>;
  };
};

export async function fetchOrders(first = 100, after?: string, date?: string) {
  if (!apiUrl) throw new Error("VITE_API_URL is missing.");
  const query = new URLSearchParams({ first: String(first) });
  if (after) query.set("after", after);
  if (date) {
    query.set("from", `${date}T00:00:00${storeOffset(date)}`);
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + 1);
    const nextDate = next.toISOString().slice(0, 10);
    query.set("to", `${nextDate}T00:00:00${storeOffset(nextDate)}`);
  }

  const response = await fetch(`${apiUrl}/api/orders?${query}`, { headers: await authHeaders() });
  if (!response.ok) throw new Error("Unable to retrieve Shopify orders.");
  return response.json() as Promise<{
    nodes: ShopifyOrder[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  }>;
}
