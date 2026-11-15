import { fixtures } from './fixtures';
const copy = <T,>(value: T): T => structuredClone(value);
export async function getSnapshot() { return copy(fixtures); }
export async function getRequests() { return copy(fixtures.requests); }
export async function getVolunteer(id = 'v1') { return copy(fixtures.volunteers.find(v => v.id === id) ?? null); }
export async function getCharity() { return copy(fixtures.charity); }
export async function getCommitments() { return copy(fixtures.commitments); }
export async function getVerifications() { return copy(fixtures.verifications); }
