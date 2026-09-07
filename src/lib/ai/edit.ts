import 'server-only';
import { getSpec, latestProfile, ruleTexts } from '@/lib/db/repo';
import { structuredCall } from './gemini';
import { EditSchema } from './schemas';
import { buildEditSystem } from './prompts';

export async function editWithAI(content: string, instruction: string): Promise<{ content: string; summary: string }> {
  const spec = getSpec() || 'ريادة الأعمال';
  const { data } = await structuredCall({
    kind: 'edit',
    schema: EditSchema,
    system: buildEditSystem(spec, latestProfile(), ruleTexts('golden')),
    user: `البوست الأصلي:\n${content}\n\nالتعديل المطلوب:\n${instruction}\n\nأعد البوست المعدّل كاملاً.`,
    effort: 'medium',
    maxTokens: 4000,
    mockHint: content,
  });
  return { content: data.content.trim(), summary: data.changes_summary };
}
