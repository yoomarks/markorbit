import fs from 'node:fs';

const file = 'services/markreg/src/order-http.ts';
let text = fs.readFileSync(file, 'utf8');
text = text.replace(
  "  isOrderStatus,\n  orderTypes,",
  "  orderStatuses,\n  orderTypes,"
);
text = text.replace(
  "function requiredEnum<const T extends readonly string[]>(\n  body: Readonly<Record<string, unknown>>,\n  field: string,\n  values: T\n): T[number] {\n  const value = requiredText(body, field);\n  const match = values.find((candidate) => candidate === value);\n  if (!match) throw new HttpError(400, 'INVALID_REQUEST', `${field} is invalid.`);\n  return match;\n}\n",
  "function requiredEnum<const T extends readonly string[]>(\n  body: Readonly<Record<string, unknown>>,\n  field: string,\n  values: T\n): T[number] {\n  const value = requiredText(body, field);\n  const match = values.find((candidate) => candidate === value);\n  if (!match) throw new HttpError(400, 'INVALID_REQUEST', `${field} is invalid.`);\n  return match;\n}\n\nfunction optionalEnum<const T extends readonly string[]>(\n  value: string | undefined,\n  field: string,\n  values: T\n): T[number] | undefined {\n  if (value === undefined) return undefined;\n  const match = values.find((candidate) => candidate === value);\n  if (!match) throw new HttpError(400, 'INVALID_REQUEST', `${field} is invalid.`);\n  return match;\n}\n"
);
text = text.replace(
  "        const status = request.query.status;\n        if (status && !isOrderStatus(status))\n          throw new HttpError(400, 'INVALID_REQUEST', 'Order status filter is invalid.');\n        const query: OrderListQuery = { page, pageSize };",
  "        const status = optionalEnum(request.query.status, 'Order status filter', orderStatuses);\n        const query: OrderListQuery = { page, pageSize };"
);
fs.writeFileSync(file, text);
fs.rmSync('scripts/wp05-status-typefix.mjs');
