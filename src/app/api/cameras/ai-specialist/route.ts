import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSonyCameras } from '@/lib/cameras/data';
import { featureList } from '@/lib/cameras/features';

const MODEL = 'claude-sonnet-5';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productIds, question, locale = 'vi' } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'No products provided' }, { status: 400 });
    }

    const allCameras = await getSonyCameras();
    const selectedProducts = allCameras.filter((c) => productIds.includes(c.id));

    if (selectedProducts.length === 0) {
      return NextResponse.json({ error: 'Products not found' }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (apiKey) {
      const client = new Anthropic({ apiKey });

      const productsSummary = selectedProducts
        .map(
          (p) =>
            `- Name: ${p.name} (${p.fullName})\n  SKU: ${p.sku}\n  Category: ${p.category}\n  Format/Sensor: ${p.subCategory1}\n  Series: ${p.subCategory2}\n  Price: ${p.priceFormatted}\n  Features: ${featureList(p.features, locale).join('; ')}`,
        )
        .join('\n\n');

      const systemPrompt = `You are Sony Specialist, an expert, objective, friendly technical camera & lens consultant for Sony products.
The user is comparing the following ${selectedProducts.length} Sony products:

${productsSummary}

Task:
Answer the user's question with precise technical insight, clear pros/cons comparison, and a direct recommendation on which model fits their specific use-case best.
Keep your response structured (using bolding and bullet points), clear, concise, and written in ${
        locale === 'vi' ? 'Vietnamese' : 'English'
      }.`;

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: question || 'Hãy phân tích so sánh chi tiết và tư vấn máy phù hợp nhất.',
          },
        ],
        system: systemPrompt,
      });

      const replyText =
        response.content[0].type === 'text'
          ? response.content[0].text
          : 'Không thể tạo phản hồi.';

      return NextResponse.json({ answer: replyText });
    }

    // Fallback rule-based Specialist synthesis when no API key present
    const isVi = locale === 'vi';
    const names = selectedProducts.map((p) => p.name).join(', ');
    const cheapest = [...selectedProducts].sort((a, b) => a.priceVnd - b.priceVnd)[0];
    const topPriced = [...selectedProducts].sort((a, b) => b.priceVnd - a.priceVnd)[0];

    const fallbackAnswer = isVi
      ? `### 🤖 Sony Specialist Phân Tích So Sánh:\n\n` +
        `Dưới đây là đánh giá so sánh chuyên sâu giữa **${names}**:\n\n` +
        `1. **Tối ưu chi phí (P/P)**: **${cheapest.name}** (${cheapest.priceFormatted}) là lựa chọn có mức giá tiếp cận dễ dàng nhất trong danh sách.\n` +
        `2. **Hiệu năng & Phân khúc cao nhất**: **${topPriced.name}** (${topPriced.priceFormatted}) sở hữu thông số kỹ thuật hàng đầu.\n\n` +
        `**Điểm mạnh nổi bật từng thiết bị:**\n` +
        selectedProducts
          .map(
            (p) =>
              `- **${p.name}** (${p.subCategory1} / ${p.subCategory2}): ${featureList(p.features, locale).slice(0, 2).join('; ')}.`,
          )
          .join('\n') +
        `\n\n💡 *Lời khuyên từ Sony Specialist*: Tùy thuộc vào nhu cầu thực tế của bạn — nếu tập trung quay phim Vlogging/Cinema nên chọn dòng FX / ZV / Alpha hỗ trợ quay phim mạnh; nếu chụp ảnh thương mại độ phân giải cao nên ưu tiên dòng Alpha R hoặc Alpha 1.`
      : `### 🤖 Sony Specialist Spec Analysis:\n\n` +
        `Here is a quick technical comparison between **${names}**:\n\n` +
        `1. **Best Value (P/P)**: **${cheapest.name}** (${cheapest.priceFormatted}) provides the most accessible entry point.\n` +
        `2. **Top Tier Spec**: **${topPriced.name}** (${topPriced.priceFormatted}) delivers flagship performance.\n\n` +
        selectedProducts
          .map(
            (p) =>
              `- **${p.name}** (${p.subCategory1}): ${featureList(p.features, locale).slice(0, 2).join('; ')}.`,
          )
          .join('\n');

    return NextResponse.json({ answer: fallbackAnswer });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
