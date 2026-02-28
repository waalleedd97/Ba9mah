import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { postContent, instruction, goldenRules, spec } = await req.json();

    if (!postContent || !instruction) {
      return NextResponse.json({ error: 'Missing postContent or instruction' }, { status: 400 });
    }

    const systemPrompt = `أنت كاتب محتوى LinkedIn محترف متخصص في السوق السعودي.
التخصص: ${spec || 'ريادة الأعمال'}

مهمتك: عدّل على البوست التالي حسب تعليمات المستخدم.
${goldenRules && goldenRules.length > 0 ? `\nالقواعد الذهبية (التزم بها):\n${goldenRules.map((r: string) => `- ${r}`).join('\n')}\n` : ''}
حافظ على نفس الأسلوب والنبرة واللهجة الأصلية للبوست.
رد بالنص المعدّل فقط بدون أي شرح أو مقدمة.`;

    const userMsg = `البوست الأصلي:
${postContent}

التعديل المطلوب:
${instruction}

اكتب البوست المعدّل فقط:`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: data.error.message || 'API Error' }, { status: 500 });
    }

    let text = '';
    if (data.content) {
      data.content.forEach((block: any) => {
        if (block.type === 'text') text += block.text;
      });
    }

    return NextResponse.json({ editedContent: text.trim() });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
