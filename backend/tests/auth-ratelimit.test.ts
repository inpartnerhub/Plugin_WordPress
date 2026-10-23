import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { computeSignature, SignatureVerifier, verifyBearerToken } from '../src/lib/auth.js';
import { AbusePenaltyTracker, DailyBudget, FixedWindowLimiter, ResponseCache } from '../src/middleware/rate-limit.js';

describe('SignatureVerifier', () => {
  const secret = 's'.repeat(40);
  const now = 1_790_000_000_000;
  const ts = String(now / 1000);
  const body = '{"message":"hi","language":"en"}';
  const nonce = '0123456789abcdef0123456789abcdef';

  it('accepts a valid signature once and rejects a replay', () => {
    const verifier = new SignatureVerifier(secret, 300, () => now);
    const sig = computeSignature(secret, ts, nonce, 'abc', body);
    assert.equal(verifier.verify(ts, nonce, 'abc', sig, body), null);
    assert.equal(verifier.verify(ts, nonce, 'abc', sig, body), 'replayed');
  });

  it('accepts identical bodies that carry different nonces', () => {
    const verifier = new SignatureVerifier(secret, 300, () => now);
    for (const n of ['a'.repeat(32), 'b'.repeat(32)]) {
      assert.equal(verifier.verify(ts, n, 'abc', computeSignature(secret, ts, n, 'abc', body), body), null);
    }
  });

  it('rejects missing, malformed, expired and tampered requests', () => {
    const verifier = new SignatureVerifier(secret, 300, () => now);
    const sig = computeSignature(secret, ts, nonce, 'abc', body);
    assert.equal(verifier.verify('', nonce, 'abc', sig, body), 'missing');
    assert.equal(verifier.verify(ts, nonce, 'abc', 'zz', body), 'malformed');
    assert.equal(verifier.verify(ts, 'short', 'abc', sig, body), 'malformed');
    assert.equal(verifier.verify(ts, '', 'abc', sig, body), 'missing');
    assert.equal(verifier.verify(ts, nonce, 'a b<c>', sig, body), 'malformed');
    const old = String(now / 1000 - 301);
    assert.equal(verifier.verify(old, nonce, 'abc', computeSignature(secret, old, nonce, 'abc', body), body), 'expired');
    assert.equal(verifier.verify(ts, nonce, 'abc', sig, body.replace('hi', 'yo')), 'invalid');
    assert.equal(verifier.verify(ts, nonce, 'other-client', sig, body), 'invalid');
    assert.equal(verifier.verify(ts, nonce, 'abc', computeSignature('w'.repeat(40), ts, nonce, 'abc', body), body), 'invalid');
  });

  it('bounds memory under signature flood', () => {
    const verifier = new SignatureVerifier(secret, 300, () => now, 100);
    // Submit 150 unique signatures
    for (let i = 0; i < 150; i++) {
      const n = i.toString(16).padStart(32, '0');
      const sig = computeSignature(secret, ts, n, 'abc', body);
      verifier.verify(ts, n, 'abc', sig, body);
    }
    assert.ok((verifier as unknown as { seen: Map<string, number> }).seen.size <= 100);
  });
});

describe('verifyBearerToken', () => {
  it('requires an exact Bearer token', () => {
    const token = 't'.repeat(40);
    assert.equal(verifyBearerToken(`Bearer ${token}`, token), true);
    assert.equal(verifyBearerToken(`bearer ${token}`, token), true);
    assert.equal(verifyBearerToken(`Bearer ${token}x`, token), false);
    assert.equal(verifyBearerToken(`Basic ${token}`, token), false);
    assert.equal(verifyBearerToken('', token), false);
    assert.equal(verifyBearerToken(undefined, token), false);
    assert.equal(verifyBearerToken(null, token), false);
    assert.equal(verifyBearerToken(`Bearer ${token}`, ''), false);
  });
});

describe('FixedWindowLimiter', () => {
  it('limits per key and resets after the window', () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(2, 60_000, () => now);
    assert.equal(limiter.hit('a').allowed, true);
    assert.equal(limiter.hit('a').allowed, true);
    const blocked = limiter.hit('a');
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterSeconds, 60);
    assert.equal(limiter.hit('b').allowed, true, 'other keys are independent');
    now = 60_000;
    assert.equal(limiter.hit('a').allowed, true);
  });

  it('bounds memory under many unique keys', () => {
    const limiter = new FixedWindowLimiter(1, 60_000, () => 0, 100);
    for (let i = 0; i < 1000; i++) limiter.hit(`k${i}`);
    assert.ok((limiter as unknown as { windows: Map<string, unknown> }).windows.size <= 100);
  });
});

describe('DailyBudget', () => {
  it('caps requests per UTC day', () => {
    let now = Date.UTC(2026, 9, 14, 23, 59, 0);
    const budget = new DailyBudget(2, () => now);
    assert.equal(budget.consume().allowed, true);
    assert.equal(budget.consume().allowed, true);
    const blocked = budget.consume();
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterSeconds, 60);
    now = Date.UTC(2026, 9, 15, 0, 0, 1);
    assert.equal(budget.consume().allowed, true);
  });
});

describe('AbusePenaltyTracker', () => {
  it('penalises clients after repeated violations and resets after cooldown', () => {
    let now = 1000;
    const tracker = new AbusePenaltyTracker(3, 300_000, 600_000, () => now);
    assert.equal(tracker.check('attacker').allowed, true);
    assert.equal(tracker.recordViolation('attacker').allowed, true);
    assert.equal(tracker.recordViolation('attacker').allowed, true);
    assert.equal(tracker.check('attacker').allowed, true);

    // 3rd violation triggers cooldown
    const penalty = tracker.recordViolation('attacker');
    assert.equal(penalty.allowed, false);
    assert.equal(penalty.retryAfterSeconds, 600);

    // Blocked on subsequent checks
    const blocked = tracker.check('attacker');
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds <= 600);

    // Clean client is not affected
    assert.equal(tracker.check('honest_user').allowed, true);

    // After penalty expires
    now += 600_001;
    assert.equal(tracker.check('attacker').allowed, true);
  });
});

describe('ResponseCache', () => {
  it('caches grounded answers with normalization and obeys TTL', () => {
    let now = 1000;
    const cache = new ResponseCache(60_000, 10, () => now);
    cache.set('en', 'What services does Inpartner offer?', {
      answer: 'Inpartner offers advisory services.',
      sources: [{ title: 'Services', url: 'https://inpartnerglobal.com/services' }],
      grounded: true,
    });

    // Exact and case/spacing normalised lookups match
    const hit1 = cache.get('en', 'What services does Inpartner offer?');
    assert.ok(hit1);
    assert.equal(hit1.answer, 'Inpartner offers advisory services.');

    const hit2 = cache.get('en', '  what services does   inpartner offer?  ');
    assert.ok(hit2);
    assert.equal(hit2.answer, 'Inpartner offers advisory services.');

    // Different language or question misses
    assert.equal(cache.get('id', 'What services does Inpartner offer?'), null);
    assert.equal(cache.get('en', 'Where is the office?'), null);

    // After TTL expires
    now += 60_001;
    assert.equal(cache.get('en', 'What services does Inpartner offer?'), null);

    // Clear works
    cache.set('en', 'hello', { answer: 'hi', sources: [], grounded: true });
    assert.equal(cache.size, 1);
    cache.clear();
    assert.equal(cache.size, 0);
  });

  it('never caches ungrounded answers, isolates namespaces, and bounds size', () => {
    let now = 1000;
    const cache = new ResponseCache(60_000, 2, () => now);
    cache.set('en', 'ungrounded query', { answer: 'fallback', sources: [], grounded: false });
    assert.equal(cache.get('en', 'ungrounded query'), null);
    assert.equal(cache.size, 0);

    cache.set('en', 'q1', { answer: 'a1', sources: [], grounded: true });
    cache.set('en', 'q2', { answer: 'a2', sources: [], grounded: true });
    cache.set('en', 'q3', { answer: 'a3', sources: [], grounded: true });
    assert.equal(cache.size, 2);
    assert.equal(cache.get('en', 'q1'), null, 'oldest entry evicted when maxSize exceeded');
    assert.equal(cache.get('en', 'q2')?.answer, 'a2');

    // Namespace change invalidates previous entries
    cache.setNamespace('v2:new-kb-hash');
    assert.equal(cache.size, 0);
    assert.equal(cache.get('en', 'q2'), null);
  });
});
