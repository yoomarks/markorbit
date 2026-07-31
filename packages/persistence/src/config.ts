import { PersistenceError } from './errors.js';

export type DatabaseSslMode = 'disable' | 'require';
export interface DatabaseConfig {
  connection:
    | { url: string }
    | { host: string; port: number; database: string; user: string; password: string };
  poolMaximum: number;
  connectionTimeoutMs: number;
  idleTimeoutMs: number;
  statementTimeoutMs: number;
  applicationName: string;
  sslMode: DatabaseSslMode;
  migrationNamespace: string;
  testDatabaseIdentifier?: string;
}

const positive = (value: string | undefined, fallback: number, name: string): number => {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new PersistenceError(
      'INVALID_DATABASE_CONFIGURATION',
      `${name} must be a positive integer.`
    );
  return parsed;
};
const identifier = (value: string | undefined, name: string): string => {
  if (!value || !/^[a-z][a-z0-9_]{0,62}$/u.test(value))
    throw new PersistenceError(
      'INVALID_DATABASE_CONFIGURATION',
      `${name} must be a safe PostgreSQL identifier.`
    );
  return value;
};

export function parseDatabaseConfig(env: NodeJS.ProcessEnv): DatabaseConfig {
  const ssl = env.DB_SSL_MODE ?? 'disable';
  if (ssl !== 'disable' && ssl !== 'require')
    throw new PersistenceError(
      'INVALID_DATABASE_CONFIGURATION',
      'DB_SSL_MODE must be disable or require.'
    );
  let connection: DatabaseConfig['connection'];
  if (env.DATABASE_URL) {
    let url: URL;
    try {
      url = new URL(env.DATABASE_URL);
    } catch (cause) {
      throw new PersistenceError('INVALID_DATABASE_CONFIGURATION', 'DATABASE_URL is malformed.', {
        cause
      });
    }
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      !url.pathname.slice(1)
    )
      throw new PersistenceError(
        'INVALID_DATABASE_CONFIGURATION',
        'DATABASE_URL must identify a PostgreSQL database.'
      );
    connection = { url: env.DATABASE_URL };
  } else {
    connection = {
      host: env.DB_HOST ?? '',
      port: positive(env.DB_PORT, 5432, 'DB_PORT'),
      database: identifier(env.DB_NAME, 'DB_NAME'),
      user: env.DB_USER ?? '',
      password: env.DB_PASSWORD ?? ''
    };
    if (
      !connection.host ||
      !connection.user ||
      (!connection.password && env.NODE_ENV === 'production')
    )
      throw new PersistenceError(
        'INVALID_DATABASE_CONFIGURATION',
        'Explicit database host, user, and production password are required.'
      );
  }
  return {
    connection,
    poolMaximum: positive(env.DB_POOL_MAX, 10, 'DB_POOL_MAX'),
    connectionTimeoutMs: positive(env.DB_CONNECTION_TIMEOUT_MS, 5000, 'DB_CONNECTION_TIMEOUT_MS'),
    idleTimeoutMs: positive(env.DB_IDLE_TIMEOUT_MS, 30000, 'DB_IDLE_TIMEOUT_MS'),
    statementTimeoutMs: positive(env.DB_STATEMENT_TIMEOUT_MS, 10000, 'DB_STATEMENT_TIMEOUT_MS'),
    applicationName: env.DB_APPLICATION_NAME ?? 'markorbit',
    sslMode: ssl,
    migrationNamespace: identifier(env.DB_MIGRATION_NAMESPACE, 'DB_MIGRATION_NAMESPACE'),
    ...(env.DB_TEST_DATABASE
      ? { testDatabaseIdentifier: identifier(env.DB_TEST_DATABASE, 'DB_TEST_DATABASE') }
      : {})
  };
}
