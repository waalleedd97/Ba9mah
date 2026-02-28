import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { topic, imageStyleRules, imageAvoidRules } = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `المستخدم رفض صورة تم توليدها لبوست LinkedIn عن موضوع: "${topic}"

${imageStyleRules.length > 0 ? `الأنماط اللي يفضلها المستخدم: ${imageStyleRules.join('، ')}` : ''}
${imageAvoidRules.length > 0 ? `أنماط يتجنبها: ${imageAvoidRules.join('، ')}` : ''}

بناءً على الموضوع والسياق، اقترح سبب محتمل لرفض الصورة وقاعدة لتحسين الصور القادمة.

رد بصيغة JSON فقط بدون backticks:
{"reason":"سبب الرفض المحتمل بجملة واحدة","rule":"قاعدة تحسين للصور القادمة بجملة واحدة"}`
        }],
      }),
    });

    const data = await response.json();
    let text = '';
    if (data.content) {
      data.content.forEach((block: any) => {
        if (block.type === 'text') text += block.text;
      });
    }

    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json({
      reason: parsed.reason || '',
      rule: parsed.rule || '',
    });

  } catch (err: any) {
    return NextResponse.json({ reason: '', rule: '' });
  }
}
