import fs from 'node:fs';

function replaceOnce(file, needle, replacement) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(needle)) throw new Error(`${file}: patch anchor not found`);
  fs.writeFileSync(file, text.replace(needle, replacement));
}

replaceOnce(
  'apps/gateway/src/index.ts',
  `        ...createGatewayOrderRoutes({
          markRegUrl,
          authenticationClient,
          internalServiceSecret:
            options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET,
          csrfSecret,
          allowedOrigins
        }),`,
  `        ...createGatewayOrderRoutes({
          markRegUrl,
          ...(authenticationClient ? { authenticationClient } : {}),
          ...((options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET)
            ? {
                internalServiceSecret: (options.internalServiceSecret ??
                  process.env.MO_INTERNAL_SERVICE_SECRET)!
              }
            : {}),
          csrfSecret,
          allowedOrigins
        }),`
);

replaceOnce(
  'services/markreg/src/index.ts',
  `        ...createOrderHttpRoutes({
          orderService: options.orderService,
          conversionService: options.orderMatterConversionService,
          internalServiceSecret
        }),`,
  `        ...createOrderHttpRoutes({
          ...(options.orderService ? { orderService: options.orderService } : {}),
          ...(options.orderMatterConversionService
            ? { conversionService: options.orderMatterConversionService }
            : {}),
          ...(internalServiceSecret ? { internalServiceSecret } : {})
        }),`
);

replaceOnce(
  'services/markreg/src/order-http.ts',
  `import {
  AuthenticationError,
  parseInternalWorkspacePrincipal,
  type WorkspacePrincipal
} from '@markorbit/contracts';`,
  `import {
  AuthenticationError,
  channels,
  parseInternalWorkspacePrincipal,
  relationshipModels,
  type WorkspacePrincipal
} from '@markorbit/contracts';`
);
replaceOnce(
  'services/markreg/src/order-http.ts',
  `import {
  isOrderStatus,`,
  `import {
  isOrderStatus,
  orderTypes,`
);
replaceOnce(
  'services/markreg/src/order-http.ts',
  `function requiredText(body: Readonly<Record<string, unknown>>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new HttpError(400, 'INVALID_REQUEST', \`${'${field}'} is required.\`);
  return value;
}
`,
  `function requiredText(body: Readonly<Record<string, unknown>>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new HttpError(400, 'INVALID_REQUEST', \`${'${field}'} is required.\`);
  return value;
}

function requiredEnum<const T extends readonly string[]>(
  body: Readonly<Record<string, unknown>>,
  field: string,
  values: T
): T[number] {
  const value = requiredText(body, field);
  if (!(values as readonly string[]).includes(value))
    throw new HttpError(400, 'INVALID_REQUEST', \`${'${field}'} is invalid.\`);
  return value as T[number];
}
`
);
replaceOnce(
  'services/markreg/src/order-http.ts',
  `          orderType: requiredText(body, 'orderType') as CreateOrderCommand['orderType'],`,
  `          orderType: requiredEnum(body, 'orderType', orderTypes),`
);
replaceOnce(
  'services/markreg/src/order-http.ts',
  `          channel: requiredText(body, 'channel') as CreateOrderCommand['channel'],
          relationshipModel: requiredText(
            body,
            'relationshipModel'
          ) as CreateOrderCommand['relationshipModel'],`,
  `          channel: requiredEnum(body, 'channel', channels),
          relationshipModel: requiredEnum(body, 'relationshipModel', relationshipModels),`
);

fs.rmSync('scripts/wp05-typefix.mjs');
