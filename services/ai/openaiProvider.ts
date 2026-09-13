import { mockAiProvider } from './mockProvider';

// OpenAI API連携を追加する場合も、UI側はAiProviderだけを参照します。
export const openaiProvider = mockAiProvider;
