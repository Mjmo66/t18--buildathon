import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesRegistry, namesMatch } from './charityNumber.js';

test('names match despite case, punctuation, word order and legal filler', () => {
  assert.ok(namesMatch('St Andrews Reading Buddies', 'Reading Buddies (St Andrews)'));
  assert.ok(namesMatch('The Lade Braes Wildlife Trust SCIO', 'Lade Braes Wildlife Trust'));
  assert.ok(namesMatch('Fife Food Share', 'Fife Food Share Network'));
  assert.ok(namesMatch('Arts & Crafts Club', 'Arts and Crafts Club'));
});

test('unrelated or much shorter names do not match', () => {
  assert.ok(!namesMatch('Charity Niklas', 'Kinburn Companions'));
  assert.ok(!namesMatch('Fife', 'Fife Food Share Network'));
  assert.ok(!namesMatch('', 'Anything'));
  assert.ok(!namesMatch('The Limited Company', 'The Limited Company')); // only filler words
});

test('the "known as" name counts too', () => {
  const entry = { org_name: 'Royal Scottish Forestry Society', known_as: 'RSFS' };
  assert.ok(matchesRegistry('RSFS', entry));
  assert.ok(!matchesRegistry('RSFS', null));
});
