import { describe, it, expect } from 'vitest';

// This is the function we are testing
function displayAmount(amount) {
  return Math.abs(amount);
}

describe('displayAmount', () => {
  it('flips a negative amount to positive', () => {
    expect(displayAmount(-100)).toBe(100);
  });

  it('keeps a positive amount as positive', () => {
    expect(displayAmount(45.99)).toBe(45.99);
  });

  it('handles zero', () => {
    expect(displayAmount(0)).toBe(0);
  });
});