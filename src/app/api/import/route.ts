import { handle, ok, readJson } from '@/lib/api';
import { LegacyMemorySchema, importLegacyMemory } from '@/lib/import-legacy';

export const POST = handle(async (req) => {
  const mem = await readJson(req, LegacyMemorySchema);
  const report = importLegacyMemory(mem);
  return ok({ report });
});
