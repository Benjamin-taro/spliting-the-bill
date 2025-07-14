"use client";

import { useState } from "react";
import menuData from "../data/menu.json";

/*------------- 型定義 -------------*/
type Item = {
  name: string;
  quantity: number;
  price: number;
  valid: boolean;
  expectedPrice?: number | null;
  checked?: boolean;
  assignments: number[];   // 例: [2,0,0] = person0 が 2 個、person1/2 は 0 個
};

type Phase = "review" | "split";

/*------------- 画面コンポーネント -------------*/
export default function Home() {
  /* ステート */
  const [phase, setPhase] = useState<Phase>("review");
  const [file, setFile] = useState<File>();
  const [items, setItems] = useState<Item[]>([]);
  const [numPeople, setNumPeople] = useState(1);
  const [ocrSubtotal, setOcrSubtotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);   // ← new

  /* 先頭近くの変換テーブルは活かす */
  const menuLower = Object.fromEntries(
    Object.entries(menuData).map(([k, v]) => [k.toLowerCase(), v])
  );



  /* 画像アップロード → API 呼び出し */
  async function handleSend() {
    if (!file) return;
    setIsLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res  = await fetch("/api/extract", { method: "POST", body: form });
      const json = await res.json();

      /* ---------- ここを置き換え ---------- */
      const processed = (json.items ?? []).map((it: Item) => {
        const priceMatch = menuLower[it.name.toLowerCase()] ?? null;

        return {
          ...it,
          price: priceMatch ?? it.price,
          valid: priceMatch !== null,
          expectedPrice: priceMatch,
          checked: false,
          assignments: Array(numPeople).fill(0),
        };
      });


      setItems(processed);
      /* ------------------------------------ */

      setOcrSubtotal(json.total ?? null);
      setPhase("review");
    } catch (err) {
      alert("Failed to parse image.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }


  function addBlankItem() {
    setItems(prev => [
      ...prev,
      {
        name: "",
        quantity: 1,
        price: 0,
        valid: false,
        assignments: Array(numPeople).fill(0), // ← Split 用
      },
    ]);
  }

  /* アイテム編集ハンドラ */
  function editItem(i: number, field: keyof Item, v: string | number) {
    setItems(prev =>
      prev.map((row, idx) => {
        if (idx !== i) return row;
        const updated = { ...row, [field]: v };

        // 料理名か単価が変わった場合に再チェック
        const match = menuLower[updated.name.toLowerCase()] ?? null;
        updated.expectedPrice = match;
        updated.valid = match !== null && Math.abs(match - updated.price) < 0.01;

        return updated;
      })
    );
  }


  /* Review → Split へ */
  function confirmItems() {
    const invalid = items.some(
      it => !it.name || it.quantity <= 0 || it.price <= 0
    );
    if (invalid) {
      alert("Please fix empty or zero values.");
      return;
    }

    // assignments を付与
    const newItems = items.map(it => ({
      ...it,
      assignments: Array(numPeople).fill(0),
    }));
    setItems(newItems);
    setPhase("split");
  }

  function editAssignment(itemIdx: number, personIdx: number, newVal: number) {
    setItems(prev => {
      const next = [...prev];
      const item = next[itemIdx];

      // まず現在の割り当て合計 (この人を除く)
      const otherSum = item.assignments.reduce(
        (s, qty, idx) => s + (idx === personIdx ? 0 : qty),
        0
      );

      // 残り可能個数
      const remaining = item.quantity - otherSum;

      // 入力値が残りを超えたら残りに丸める
      const safeVal = Math.max(0, Math.min(newVal, remaining));

      // 反映
      const newAssign = [...item.assignments];
      newAssign[personIdx] = safeVal;
      next[itemIdx] = { ...item, assignments: newAssign };
      return next;
    });
  }

  /* 計算 */
  const subtotal = items.reduce(
    (s, it) => s + it.price * it.quantity,
    0
  );
  const perHead = numPeople ? (subtotal / numPeople).toFixed(2) : "0.00";

  /*------------- JSX -------------*/
  return (
    <main className="flex flex-col items-center gap-6 p-8 max-w-2xl mx-auto">
      {/* 画像選択 & 送信 */}
      <input
        type="file"
        accept="image/*"
        onChange={e => setFile(e.target.files?.[0])}
      />
      <button
        onClick={handleSend}
        className="px-4 py-2 rounded bg-blue-600 text-white disabled:bg-gray-400"
        disabled={!file || isLoading}
      >
        {isLoading ? "Processing…" : "Upload & Parse"}
      </button>

      {/* ---------- Review Phase ---------- */}
      {phase === "review" && items.length > 0 && (
        <>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left">Item</th>
                <th>Qty</th>
                <th>Unit&nbsp;¥</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className={!it.valid ? "bg-red-100" : ""}>
                  <td>
                  <input
                    value={it.name}
                    onChange={e => {
                      const newName = e.target.value;

                      // --- 完全一致（大文字小文字を無視）を探す -----------------
                      const priceMatch = menuLower[newName.toLowerCase()] ?? null;

                      // ------------------------------------------------------------

                      setItems(prev =>
                        prev.map((row, idx) => {
                          if (idx !== i) return row;

                          return {
                            ...row,
                            name: newName,
                            /* 一致したら正規価格を反映、valid=true に */
                            price: priceMatch !== null ? priceMatch : row.price,
                            valid:
                              priceMatch !== null &&
                              Math.abs(priceMatch - (priceMatch ?? row.price)) < 0.01,
                            expectedPrice: priceMatch
                          };
                        })
                      );
                    }}
                    className="w-full border px-1"
                  />

                  </td>
                  <td>
                    <input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={e =>
                        editItem(i, "quantity", Number(e.target.value))
                      }
                      className="w-16 border text-center"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={it.price}
                      onChange={e =>
                        editItem(i, "price", Number(e.target.value))
                      }
                      className="w-20 border text-right"
                    />
                    {!it.valid && it.expectedPrice && (
                      <span className="ml-1 text-xs text-gray-500">
                        → {it.expectedPrice.toFixed(2)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ---- subtotal block ---- */}
          <div className="mt-4 grid grid-cols-[auto_1fr] gap-2 items-center">
            <span className="font-medium">OCR subtotal:</span>
            <input
              type="number"
              step="0.01"
              value={ocrSubtotal ?? 0}
              onChange={e => setOcrSubtotal(Number(e.target.value))}
              className="border px-2 py-1 w-32"
            />

            <span className="font-medium">Re-calculated:</span>
            <span
              className={
                ocrSubtotal !== null &&
                Math.abs(
                  (items.reduce((s, it) => s + it.price * it.quantity, 0) - ocrSubtotal)
                ) > 0.01
                  ? "font-semibold text-red-600"
                  : "font-semibold"
              }
            >
              ¥{items
                .reduce((s, it) => s + it.price * it.quantity, 0)
                .toFixed(2)}
            </span>
          </div>
          <button
            className="mt-3 px-3 py-1 rounded bg-gray-200"
            onClick={addBlankItem}
          >
            + Add item
          </button>

          <button
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded"
            onClick={confirmItems}
          >
            Confirm items
          </button>
        </>
      )}

      {/* ---------- Split Phase ---------- */}
      {phase === "split" && (
        <>
          <div className="flex items-center gap-2 my-4">
            <label>People:</label>
            <input
              type="number"
              min={1}
              value={numPeople}
              onChange={e => {
                const n = Number(e.target.value);
                setNumPeople(n);
                setItems(prev => prev.map(it => ({
                  ...it,
                  assignments: Array(n).fill(0)
                })));
              }}
              className="w-20 border p-1"
            />
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit ¥</th>
                {[...Array(numPeople)].map((_, i) => (
                  <th key={i}>P{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const assigned = it.assignments.reduce((a, b) => a + b, 0);
                const isMismatch = assigned !== it.quantity;
                return (
                  <tr key={i} className={isMismatch ? "bg-red-100" : ""}>
                    <td>{it.name}</td>
                    <td>{it.quantity}</td>
                    <td>{it.price.toFixed(2)}</td>
                    {it.assignments.map((val, p) => {
                      const remaining =
                        it.quantity -
                        it.assignments.reduce((s, q, idx) => s + (idx === p ? 0 : q), 0);

                      return (
                        <td key={p}>
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            value={val}
                            onChange={e =>
                              editAssignment(i, p, Number(e.target.value))
                            }
                            className="w-16 border text-center"
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* 各人の合計金額 */}
          <div className="mt-6 text-left w-full">
            <h3 className="font-semibold mb-2">Totals:</h3>
            <ul>
              {[...Array(numPeople)].map((_, i) => {
                const total = items.reduce(
                  (sum, it) => sum + (it.assignments?.[i] ?? 0) * it.price,
                  0
                );
                return (
                  <li key={i}>
                    Person {i + 1}: ¥{total.toFixed(2)}
                  </li>
                );
              })}
            </ul>
          </div>

          <button
            className="mt-4 underline"
            onClick={() => setPhase("review")}
          >
            Back to edit
          </button>
        </>
      )}

    </main>
  );
}
