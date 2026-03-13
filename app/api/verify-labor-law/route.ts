import { NextRequest, NextResponse } from 'next/server';
import { LABOR_LAW_TEXT } from '@/app/lib/labor-law-text';

export async function POST(req: NextRequest) {
  let posts: any[] = [];
  try {
    const body = await req.json();
    posts = body.posts || [];

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ posts });
    }

    const systemPrompt = `أنت مدقق قانوني صارم متخصص في نظام العمل السعودي. مهمتك الوحيدة: التأكد أن كل رقم ونسبة ومدة ومعلومة قانونية في البوستات مطابقة تمامًا للنص الرسمي.

=== النص الكامل لنظام العمل السعودي ولائحته التنفيذية ===
${LABOR_LAW_TEXT}
=== نهاية النص ===

=== أمثلة على أخطاء شائعة يجب تصحيحها ===
- "العمل الإضافي بأجر +25%" ← خطأ. الصحيح: 50% من الأجر الأساسي (المادة 107)
- "الإجازة السنوية 30 يوم من البداية" ← خطأ. الصحيح: 21 يوم لأقل من 5 سنوات، 30 يوم بعد 5 سنوات (المادة 109)
- "فترة التجربة 3 أشهر" ← خطأ. الصحيح: لا تزيد عن 180 يوم (المادة 53)
- "مكافأة نهاية الخدمة راتب شهر عن كل سنة" ← خطأ. الصحيح: أجر نصف شهر عن كل سنة من الخمس الأولى، وأجر شهر عن كل سنة بعدها (المادة 84)
=== نهاية الأمثلة ===

التعليمات:
1. افحص كل بوست كلمة كلمة. ركّز على: الأرقام، النسب المئوية، المدد الزمنية، أرقام المواد، حقوق العامل وصاحب العمل.
2. قارن كل معلومة قانونية بالنص الرسمي أعلاه. إذا وجدت تعارض، صحح المعلومة لتطابق النص الرسمي.
3. حافظ على نفس الأسلوب واللهجة والطول والتنسيق — فقط غيّر المعلومة الخاطئة وأعد حساب أي أمثلة رقمية تعتمد عليها.
4. إذا البوست لا يتعلق بنظام العمل أو معلوماته صحيحة، أعده كما هو بدون أي تغيير.
5. لا تضف معلومات جديدة ولا تغير الموضوع.

رد بصيغة JSON فقط بدون backticks:
{"posts":[{"content":"نص البوست (مصحح أو كما هو)","topic":"نفس عنوان الموضوع"}]}`;

    const userMsg = `البوستات المطلوب مراجعتها:
${posts.map((p: any, i: number) => `--- بوست ${i + 1} ---\nالموضوع: ${p.topic}\nالنص: ${p.content}`).join('\n\n')}`;

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
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('[verify-labor-law] API error:', JSON.stringify(data.error));
      return NextResponse.json({ posts });
    }

    let text = '';
    if (data.content) {
      data.content.forEach((block: any) => {
        if (block.type === 'text') text += block.text;
      });
    }

    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (!parsed.posts || !Array.isArray(parsed.posts) || parsed.posts.length !== posts.length) {
      // Shape mismatch — return originals
      return NextResponse.json({ posts });
    }

    // Merge: only replace content, keep original shape
    const verified = posts.map((original: any, i: number) => ({
      ...original,
      content: parsed.posts[i]?.content || original.content,
      topic: parsed.posts[i]?.topic || original.topic,
    }));

    // Log corrections
    verified.forEach((v: any, i: number) => {
      if (v.content !== posts[i].content) {
        console.log(`[verify-labor-law] ✏️ تصحيح بوست ${i + 1} (${v.topic}):`);
        console.log(`  قبل: ${posts[i].content.slice(0, 120)}...`);
        console.log(`  بعد: ${v.content.slice(0, 120)}...`);
      } else {
        console.log(`[verify-labor-law] ✅ بوست ${i + 1} (${v.topic}): سليم`);
      }
    });

    return NextResponse.json({ posts: verified });

  } catch (err: any) {
    console.error('[verify-labor-law] catch error:', err?.message || err);
    return NextResponse.json({ posts });
  }
}
