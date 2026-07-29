export const applications = {
  lite: { package: '@markorbit/lite-web', port: 4171 },
  markreg: { package: '@markorbit/markreg-web', port: 4172 },
  operations: { package: '@markorbit/operations-console', port: 4173 }
} as const;

export type ApplicationName = keyof typeof applications;

export function applicationUrl(name: ApplicationName) {
  return `http://127.0.0.1:${applications[name].port}`;
}
