import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, imageStyleRules, imageAvoidRules, isStudio, inputImage, inputMimeType } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });
    }

    // Nano Banana 2 (Gemini 3.1 Flash Image) for fast, high-quality generation
    const model = 'gemini-3.1-flash-image-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    let imagePrompt: string;

    if (isStudio && inputImage) {
      // Studio edit mode: editing an uploaded image
      imagePrompt = `Edit this image according to these instructions:\n\n${prompt}`;
    } else if (isStudio) {
      // Studio create mode: general image generation
      imagePrompt = `Create an image based on this description:\n\n${prompt}`;
    } else {
      // LinkedIn post mode (original behavior)
      imagePrompt = `Create a cartoon-style illustration for a LinkedIn post about the following topic.

Style requirements:
- Simple cartoon/illustration style with clean lines (like editorial cartoons)
- Any text in the image MUST be in Arabic (العربية) — the audience is Arab
- Use characters/people in a simple cartoon style to tell the story
- Clean white or light background
- Warm, friendly color palette
- The illustration should visually explain the concept in a clever, metaphorical way
- Similar style to motivational LinkedIn infographics and cartoon illustrations
- NOT photorealistic — must be drawn/illustrated style
- IMPORTANT: All labels, titles, or any written text inside the image must be in Arabic, never English`;
    }

    // Inject learned style preferences
    if (imageStyleRules && imageStyleRules.length > 0) {
      imagePrompt += `\n\nUser preferred styles (MUST follow):`;
      imageStyleRules.forEach((r: string) => { imagePrompt += `\n- ${r}`; });
    }

    if (imageAvoidRules && imageAvoidRules.length > 0) {
      imagePrompt += `\n\nStyles to AVOID:`;
      imageAvoidRules.forEach((r: string) => { imagePrompt += `\n- ${r}`; });
    }

    // Add topic suffix only for LinkedIn mode
    if (!isStudio) {
      imagePrompt += `\n\nTopic: ${prompt}`;
    }

    console.log('[generate-image] Calling Gemini API, model:', model, isStudio ? '(studio)' : '(linkedin)', inputImage ? '(edit)' : '(create)');

    // Build parts array
    const parts: any[] = [{ text: imagePrompt }];

    // Add input image for edit mode
    if (inputImage) {
      parts.push({
        inlineData: {
          mimeType: inputMimeType || 'image/jpeg',
          data: inputImage,
        },
      });
    }

    const response = await fetch(`${url}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('[generate-image] API Error:', JSON.stringify(data.error));
      return NextResponse.json({ error: data.error.message || JSON.stringify(data.error) }, { status: 500 });
    }

    // Extract image and text from response
    let imageBase64 = null;
    let mimeType = null;
    let responseText = '';

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const responseParts = data.candidates[0].content.parts || [];
      for (const part of responseParts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType;
        }
        if (part.text) {
          responseText += part.text;
        }
      }
    }

    if (!imageBase64) {
      return NextResponse.json({ error: 'No image in response' }, { status: 500 });
    }

    return NextResponse.json({
      image: `data:${mimeType};base64,${imageBase64}`,
      text: responseText,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}
