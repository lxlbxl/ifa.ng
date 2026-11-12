import { describe, expect, it } from 'vitest';
import { walletSplit } from './walletSplit';

describe('walletSplit', () => {
  it('uses the wallet alone when it covers the price', () => {
    expect(walletSplit(15000, 10000)).toEqual({ covered: true, wallet: 10000, card: 0 });
    expect(walletSplit(10000, 10000)).toEqual({ covered: true, wallet: 10000, card: 0 });
  });
  it('takes what the wallet holds and charges the rest by card', () => {
    expect(walletSplit(4000, 10000)).toEqual({ covered: false, wallet: 4000, card: 6000 });
  });
  it('always leaves at least the card minimum for the card', () => {
    expect(walletSplit(9950, 10000, 100)).toEqual({ covered: false, wallet: 9900, card: 100 });
  });
  it('charges everything by card with an empty wallet', () => {
    expect(walletSplit(0, 10000)).toEqual({ covered: false, wallet: 0, card: 10000 });
  });
});
