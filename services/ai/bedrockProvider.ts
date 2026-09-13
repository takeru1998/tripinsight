import { mockAiProvider } from './mockProvider';

// MVPではモックで動作させ、AWS連携時に同じインターフェースで差し替えます。
export const bedrockProvider = mockAiProvider;
