import { describe, expect, it } from 'vitest';
import { getSnapshot, getCharity } from './mock-api';
describe('mock dataset rules', () => {
 it('contains exactly one fictional Edinburgh charity for all requests', async () => { const data = await getSnapshot(); expect(new Set(data.requests.map(r => r.charityId))).toEqual(new Set([data.charity.id])); expect((await getCharity()).address).toContain('Edinburgh'); });
 it('returns independent copies so screen changes cannot mutate the fixtures', async () => { const first = await getSnapshot(); first.charity.name = 'Changed'; expect((await getSnapshot()).charity.name).toBe('Thistle Community Care'); });
});
