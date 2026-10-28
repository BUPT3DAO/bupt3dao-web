import type { ComponentType } from 'react';

import * as chains from './chains';
import * as defiNft from './defi-nft';
import * as firstTransaction from './first-transaction';
import * as keys from './keys';
import * as next from './next';
import * as safety from './safety';
import * as signatures from './signatures';
import * as testnet from './testnet';
import * as wallet from './wallet';
import * as whatIsWeb3 from './what-is-web3';

export type ChapterContent = {
  toc: { id: string; title: string }[];
  Body: ComponentType;
};

// 新章节写好后在这里登记，并把 lib/handbook.ts 里对应章节的 ready 改成 true
export const CHAPTER_CONTENT: Record<string, ChapterContent> = {
  'what-is-web3': whatIsWeb3,
  keys,
  safety,
  wallet,
  testnet,
  'first-transaction': firstTransaction,
  chains,
  signatures,
  'defi-nft': defiNft,
  next,
};
