"use client";
import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File>();
  const [result, setResult] = useState<string>("");

  async function handleSend() {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/extract", { method: "POST", body: form });
    const json = await res.json();
    setResult(json.result ?? "no result");
  }

  return (
    <main className="flex flex-col items-center gap-4 p-10">
      <input
        type="file"
        accept="image/*"
        onChange={e => setFile(e.target.files?.[0])}
      />
      <button
        onClick={handleSend}
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:bg-gray-400"
        disabled={!file}
      >
        送信
      </button>
      <pre className="whitespace-pre-wrap">{result}</pre>
    </main>
  );
}
