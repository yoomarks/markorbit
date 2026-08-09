import fs from 'node:fs';
const file = 'scripts/order-http.integration.test.ts';
let text = fs.readFileSync(file, 'utf8');
const needle = `    expect(create.status).toBe(201);\n    const draft = (await create.json()) as { orderId: string; version: number };`;
const replacement = `    const createBody = (await create.json()) as { orderId?: string; version?: number; code?: string; message?: string };\n    expect({ status: create.status, body: createBody }).toMatchObject({\n      status: 201,\n      body: { orderId: expect.any(String), version: 1 }\n    });\n    const draft = createBody as { orderId: string; version: number };`;
if (!text.includes(needle)) throw new Error('diagnostic anchor not found');
fs.writeFileSync(file, text.replace(needle, replacement));
fs.rmSync('scripts/wp05-diagnose-create.mjs');
