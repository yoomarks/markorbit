export const milestonePorts: Readonly<
  Record<'gateway' | 'capability' | 'execution' | 'markreg' | 'liteWeb' | 'markregWeb', number>
>;
export const milestoneAuth: Readonly<{
  corePort: number;
  coreUrl: string;
  workspaceId: string;
  userId: string;
  sessionId: string;
  sessionValue: string;
}>;
export const milestoneUrls: Readonly<
  Record<'gateway' | 'capability' | 'execution' | 'markreg' | 'liteWeb' | 'markregWeb', string>
>;
