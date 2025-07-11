// app/api/extract/route.ts
import { NextRequest, NextResponse } from "next/server";
/* --- fs は不要なので削除 ---
import { readFileSync } from "fs";
--------------------------------*/
import { lookup } from "mime-types";          // ← ここ
import Together from "together-ai";       // ← default import に書き換え

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File;
  const buf = Buffer.from(await file.arrayBuffer());

  // MIME 判定
  const mimeType = lookup(file.name) || "image/jpeg";
  const dataUri = `data:${mimeType};base64,${buf.toString("base64")}`;

  const client = new Together({ apiKey: process.env.TOGETHER_API_KEY! });
  const resp = await client.chat.completions.create({
    model: "meta-llama/Llama-Vision-Free",
    max_tokens: 512,
    messages: [{
      role: "user",
      content: [
        { type: "text",  text: "Extract all items and prices from this receipt." },
        { type: "image_url", image_url: { url: dataUri } }
      ]
    }]
  });

  return NextResponse.json({ result: resp.choices[0].message.content });
}
