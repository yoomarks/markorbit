import fs from 'node:fs';
const file = 'scripts/order-http.integration.test.ts';
let text = fs.readFileSync(file, 'utf8');
const old = `  const sources = new InMemoryOrderCommercialSourceProvider();
  const repository = new PostgresOrderRepository(database, database.getPool());
  let tick = 0;
  let orderSequence = 0;
  let matterSequence = 0;
  const now = () => new Date(Date.parse(SOURCE_AT) + tick++ * 60_000).toISOString();
  const orderService = new OrderService(
    repository,
    sources,
    now,
    () => \`order_wp05-\${++orderSequence}\` as never
  );
  const conversionService = new PostgresOrderMatterConversionService(
    database,
    database.getPool(),
    now,
    () => \`formal-matter_wp05-\${++matterSequence}\` as never
  );
  let markreg = createMarkReg({
    port: 0,
    internalServiceSecret: internalKey,
    orderService,
    orderMatterConversionService: conversionService
  });`;
const replacement = `  const sources = new InMemoryOrderCommercialSourceProvider();
  let repository!: PostgresOrderRepository;
  let tick = 0;
  let orderSequence = 0;
  let matterSequence = 0;
  const now = () => new Date(Date.parse(SOURCE_AT) + tick++ * 60_000).toISOString();
  let markreg!: ReturnType<typeof createMarkReg>;`;
if (!text.includes(old)) throw new Error('initialization anchor not found');
text = text.replace(old, replacement);
const before = `  beforeAll(async () => {
    await database.start();
    await resetAndMigrateMarkRegTestDatabase({`;
const after = `  beforeAll(async () => {
    await database.start();
    repository = new PostgresOrderRepository(database, database.getPool());
    const orderService = new OrderService(
      repository,
      sources,
      now,
      () => \`order_wp05-\${++orderSequence}\` as never
    );
    const conversionService = new PostgresOrderMatterConversionService(
      database,
      database.getPool(),
      now,
      () => \`formal-matter_wp05-\${++matterSequence}\` as never
    );
    markreg = createMarkReg({
      port: 0,
      internalServiceSecret: internalKey,
      orderService,
      orderMatterConversionService: conversionService
    });
    await resetAndMigrateMarkRegTestDatabase({`;
if (!text.includes(before)) throw new Error('beforeAll anchor not found');
fs.writeFileSync(file, text.replace(before, after));
fs.rmSync('scripts/wp05-db-start-fix.mjs');
