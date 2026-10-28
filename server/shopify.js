const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-10";

function requireShopifyConfig() {
  if (!storeDomain || !clientId || !clientSecret) {
    throw new Error("Shopify server environment variables are missing.");
  }
}

async function getFreshAccessToken() {
  requireShopifyConfig();

  const response = await fetch(
    `https://${storeDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Shopify token exchange failed (${response.status}).`);
  }

  const result = await response.json();
  if (!result.access_token)
    throw new Error("Shopify did not return an access token.");
  return result.access_token;
}

export async function getOrders({
  first = 100,
  after = null,
  from = null,
  to = null,
} = {}) {
  // Intentionally exchange credentials for a new token on every orders fetch.
  const accessToken = await getFreshAccessToken();
  const response = await fetch(
    `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: `
        query Orders($first: Int!, $after: String, $query: String) {
          orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
            nodes {
              id
              name
              createdAt
              displayFinancialStatus
              displayFulfillmentStatus
              sourceName
              currentTotalPriceSet { shopMoney { amount currencyCode } }
              shippingAddress {
                firstName
                lastName
                address1
                city
                provinceCode
                zip
              }
              lineItems(first: 100) {
                nodes { id name sku quantity }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
        variables: {
          first,
          after,
          query:
            from && to
              ? `created_at:>='${from}' created_at:<'${to}' financial_status:paid -fulfillment_status:fulfilled`
              : "financial_status:paid -fulfillment_status:fulfilled",
        },
      }),
    },
  );

  if (!response.ok)
    throw new Error(`Shopify orders request failed (${response.status}).`);
  const result = await response.json();
  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join("; "));
  }
  return result.data.orders;
}
