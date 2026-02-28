import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { postContent } = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `حلل هذا البوست وقل لي بجملة واحدة مختصرة ما السبب المحتمل لعدم إعجاب القارئ به.
رد بجملة عربية واحدة فقط تصف العيب الرئيسي بدون أي شيء آخر.
مثال: "أسلوب رسمي زيادة عن اللزوم" أو "طويل ومكرر" أو "نبرة وعظية مزعجة"

البوست:
${postContent}`
        }],
      }),
    });

    const data = await response.json();
    let reason = '';

    if (data.content) {
      data.content.forEach((block: any) => {
        if (block.type === 'text') reason += block.text;
      });
    }

    return NextResponse.json({ reason: reason.trim() });

  } catch (err: any) {
    return NextResponse.json({ reason: '' });
  }
}
