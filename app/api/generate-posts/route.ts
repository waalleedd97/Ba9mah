import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { spec, goldenRules, avoidRules, dislikeReasons, likedPosts, dislikedPosts, round, totalLiked, customTopic } = body;

    // ===== BUILD SYSTEM PROMPT (In-Context Learning) =====
    let systemPrompt = `تصرف ككاتب محتوى LinkedIn متخصص للسوق السعودي.
التخصص: ${spec || 'ريادة الأعمال'}

`;

    // Golden Rules
    if (goldenRules && goldenRules.length > 0) {
      systemPrompt += `=== القواعد الذهبية (التزم بها دائما) ===\n`;
      goldenRules.forEach((r: string) => { systemPrompt += `- ${r}\n`; });
      systemPrompt += '\n';
    }

    // Avoid Rules
    systemPrompt += `=== تجنب تماما ===\n- اللهجة المصرية\n- اللهجة الفصحى الثقيلة\n`;
    if (avoidRules && avoidRules.length > 0) {
      avoidRules.forEach((r: string) => { systemPrompt += `- ${r}\n`; });
    }
    if (dislikeReasons && dislikeReasons.length > 0) {
      dislikeReasons.slice(-5).forEach((r: string) => { systemPrompt += `- ${r}\n`; });
    }
    systemPrompt += '\n';

    // Few-Shot: Liked Examples (Dynamic Few-Shot Prompting)
    if (likedPosts && likedPosts.length > 0) {
      const examples = likedPosts.slice(-5);
      systemPrompt += `=== أمثلة ناجحة اعتمدها المستخدم (قلّد أسلوبها) ===\n`;
      examples.forEach((ex: any, i: number) => {
        systemPrompt += `\n--- مثال ${i + 1} ---\n${ex.content}\n`;
      });
      systemPrompt += '\n';
    }

    // Disliked Examples (Negative Constraints)
    if (dislikedPosts && dislikedPosts.length > 0) {
      const bad = dislikedPosts.slice(-3);
      systemPrompt += `=== بوستات رفضها المستخدم (لا تكتب بهذا الأسلوب) ===\n`;
      bad.forEach((ex: any, i: number) => {
        systemPrompt += `\n--- مرفوض ${i + 1} ---\n${ex.content}\n`;
      });
      systemPrompt += '\n';
    }

    // User message
    const roundNum = (round || 0) + 1;
    const topicInstruction = customTopic
      ? `اكتب 4 بوستات LinkedIn عن الموضوع التالي: "${customTopic}"\nكل بوست يتناول زاوية مختلفة من نفس الموضوع.`
      : `اكتب 4 بوستات LinkedIn جديدة ومختلفة تماما عن بعض.\nكل بوست عن موضوع مختلف يناسب تخصص ${spec}.`;

    const userMsg = `${topicInstruction}
الجولة رقم ${roundNum} - لا تكرر أي موضوع أو فكرة من الأمثلة السابقة.
نوّع في الأساليب لكن التزم بالقواعد الذهبية وتجنب المحظورات.
اختر مواضيع مثيرة وجديدة ومفيدة للقارئ.

رد بصيغة JSON فقط بدون backticks:
{"posts":[{"content":"نص البوست","topic":"عنوان الموضوع"},{"content":"نص البوست","topic":"عنوان الموضوع"},{"content":"نص البوست","topic":"عنوان الموضوع"},{"content":"نص البوست","topic":"عنوان الموضوع"}]}`;

    // Temperature: decreases as more posts are liked
    const temperature = Math.max(0.3, 1.0 - ((totalLiked || 0) * 0.04));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 4000,
        temperature,
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

    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);

    return NextResponse.json({
      posts: parsed.posts || [],
      temperature: Math.round(temperature * 100),
      systemPromptLength: systemPrompt.length,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
