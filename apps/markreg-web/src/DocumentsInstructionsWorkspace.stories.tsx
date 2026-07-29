import type { Meta, StoryObj } from '@storybook/react';
import { DocumentsInstructionsWorkspace } from './DocumentsInstructionsWorkspace.js';
const meta = {
  title: 'MarkReg/Documents and Instructions',
  component: DocumentsInstructionsWorkspace
} satisfies Meta<typeof DocumentsInstructionsWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SourceLoading: Story = { args: { state: 'SOURCE_LOADING' } };
export const SourceUnavailable: Story = { args: { state: 'SOURCE_ERROR' } };
export const NoDocumentsSupplied: Story = { args: { state: 'NEEDS_DOCUMENTS' } };
export const SomeRequiredDocumentsMissing = NoDocumentsSupplied;
export const DocumentReviewNeeded: Story = { args: { state: 'DOCUMENT_REVIEW_NEEDED' } };
export const DocumentRejected = DocumentReviewNeeded;
export const SupersededDocument: Story = { args: { state: 'DOCUMENTS_READY' } };
export const DocumentsReady = SupersededDocument;
export const InstructionsIncomplete: Story = { args: { state: 'INSTRUCTIONS_INCOMPLETE' } };
export const InstructionsCompleteUnconfirmed: Story = { args: { state: 'READY_TO_LOCK' } };
export const ConfirmationAcknowledgements = InstructionsCompleteUnconfirmed;
export const ReadyToLock = InstructionsCompleteUnconfirmed;
export const LockedReceipt: Story = { args: { state: 'LOCKED_FOR_PREPARATION' } };
export const StalePackage: Story = { args: { state: 'STALE' } };
export const WithdrawnPackage: Story = { args: { state: 'WITHDRAWN' } };
export const RecoverableError: Story = { args: { state: 'RECOVERABLE_ERROR' } };
export const LongFilenames: Story = { args: { state: 'DOCUMENTS_READY', long: true } };
export const LongGoodsServices = LongFilenames;
export const Mobile390: Story = {
  args: { state: 'READY_TO_LOCK', long: true },
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};
