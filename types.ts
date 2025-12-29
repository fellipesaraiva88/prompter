
export enum AppMode {
  EDITOR = 'EDITOR',
  READER = 'READER'
}

export interface TeleprompterConfig {
  wpm: number;
  fontSize: number;
  showOrp: boolean;
  theme: 'dark' | 'glass';
}

export interface Script {
  title: string;
  content: string;
  lastUpdated: number;
}
