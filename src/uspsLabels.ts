import type { ShopifyOrder } from "./ordersApi";

const headers = [
  "Reference ID",
  "Shipping Date",
  "Item Description",
  "Item Quantity",
  "Item Weight (lb)",
  "Item Weight (oz)",
  "Item Value",
  "HS Tariff #",
  "Country of Origin",
  "Sender First Name",
  "Sender Middle Initial",
  "Sender Last Name",
  "Sender Company/Org Name",
  "Sender Address Line 1",
  "Sender Address Line 2",
  "Sender Address Line 3",
  "Sender Address Town/City",
  "Sender State",
  "Sender Country",
  "Sender ZIP Code",
  "Sender Urbanization Code",
  "Ship From Another ZIP Code",
  "Sender Email",
  "Sender Cell Phone",
  "Recipient Country",
  "Recipient First Name",
  "Recipient Middle Initial",
  "Recipient Last Name",
  "Recipient Company/Org Name",
  "Recipient Address Line 1",
  "Recipient Address Line 2",
  "Recipient Address Line 3",
  "Recipient Address Town/City",
  "Recipient Province",
  "Recipient State",
  "Recipient ZIP Code",
  "Recipient Urbanization Code",
  "Recipient Phone",
  "Recipient Email",
  "Service Type",
  "Package Type",
  "Package Weight (lb)",
  "Package Weight (oz)",
  "Length",
  "Width",
  "Height",
  "Girth",
  "Insured Value",
  "Contents",
  "Contents Description",
  "Package Comments",
  "Customs Form Reference #",
  "License #",
  "Certificate #",
  "Invoice #",
];

const constantRow = [
  "",
  "",
  "Supplement Berberine",
  "",
  "0",
  "1",
  "",
  "",
  "US",
  "Dharma",
  "",
  "Nutrition Clinic",
  "Dharma Nutrition Clinic",
  "1700 N Dixie Hwy",
  "Suite 116",
  "",
  "Boca Raton",
  "FL",
  "US",
  "33432",
  "",
  "",
  "info@dharmanutritionclinic.com",
  "9546680123",
  "US",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "USPS Ground Advantage",
  "Choose Your Own Box",
  "0",
  "7",
  "8.5",
  "7",
  "14.5",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
];

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function shippingDate(selectedDate?: string) {
  const [year, month, day] = (
    selectedDate || new Date().toISOString().slice(0, 10)
  ).split("-");
  return `${Number(month)}/${Number(day)}/${year.slice(-2)}`;
}

export function ordersToUspsCsv(orders: ShopifyOrder[], selectedDate?: string) {
  const rows = orders.map((order) => {
    if (!order.shippingAddress)
      throw new Error(`${order.name} has no shipping address.`);
    const row = [...constantRow];
    row[1] = shippingDate(selectedDate); // B
    row[25] = order.shippingAddress.firstName || ""; // Z
    row[27] = order.shippingAddress.lastName || ""; // AB
    row[29] = order.shippingAddress.address1 || ""; // AD
    row[32] = order.shippingAddress.city || ""; // AG
    row[34] = order.shippingAddress.provinceCode || ""; // AI
    row[35] = order.shippingAddress.zip || ""; // AJ
    return row;
  });
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

export function downloadUspsCsv(orders: ShopifyOrder[], selectedDate?: string) {
  const csv = ordersToUspsCsv(orders, selectedDate);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `USPS-labels-${selectedDate || new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
