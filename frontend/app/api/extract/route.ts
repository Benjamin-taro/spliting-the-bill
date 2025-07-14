// app/api/extract/route.ts
export const runtime = "nodejs";                 // Node ランタイムを明示

import { NextRequest, NextResponse } from "next/server";
import { lookup } from "mime-types";
import Together from "together-ai";
import fs from "fs";
import path from "path";

/* 価格表をサーバ起動時に 1 度ロード */
const MENU: Record<string, number> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "data/menu.json"), "utf8")
);

export async function POST(req: NextRequest) {
  /* 1. 画像を Data URI 化 */
  const form = await req.formData();
  const file = form.get("file") as File;
  const buf  = Buffer.from(await file.arrayBuffer());
  const mime = lookup(file.name) || "image/jpeg";
  const dataUri = `data:${mime};base64,${buf.toString("base64")}`;

  /* 2. LLM へ問い合わせ */
  const SYSTEM_PROMPT = `
You are an expert receipt parser.

Return ONLY valid JSON in exactly this shape:
{
  "items":[{ "name":string, "quantity":number, "price":number }],
  "total":number,
  "service_charge_10_percent":boolean
}

Guidelines:
• "quantity" = number of units (1, 2 …).
• "price"    = unit price (not subtotal).
• Ignore tips and discounts.
• If a 10 % service charge is present, service_charge_10_percent=true.
• Reply with JSON only—no additional text.
`;

  const client = new Together({ apiKey: process.env.TOGETHER_API_KEY! });
  const resp   = await client.chat.completions.create({
    model: "meta-llama/Llama-Vision-Free",
    max_tokens: 512,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Parse this receipt." },
          { type: "image_url", image_url: { url: dataUri } }
        ]
      }
    ]
  });

  /* 3. JSON 解析 & 検証 */
  const raw = resp.choices?.[0]?.message?.content ?? "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "LLM returned invalid JSON", raw });
  }

  const items = (parsed.items ?? []).map((it: any) => {
    const menuPrice = MENU[it.name] ?? null;
    return {
      ...it,
      valid:
        menuPrice !== null && Math.abs(menuPrice - it.price) < 0.01,
      expectedPrice: menuPrice
    };
  });

  const total = items.reduce(
    (sum: number, it: any) =>
      sum + (it.expectedPrice ?? it.price) * (it.quantity ?? 1),
    0
  );

  /* 4. 構造化して返却 */
  return NextResponse.json({
    items,
    total: Number(total.toFixed(2)),
    service_charge_10_percent: parsed.service_charge_10_percent ?? false
  });
}
