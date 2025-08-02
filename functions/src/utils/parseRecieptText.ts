import type{ ParsedReceipt } from "../types/ocr";
export const parseReceiptText = (text: string): ParsedReceipt => {
  const lines = text.split("\n").map((line) => line.trim());
  const items: ParsedReceipt["items"] = [];

  const itemLineRegex = /^.*?([¥\\]?\d+)(?:\s*([0-9]+)個)?$/;

  for (const line of lines) {
    const match = line.match(itemLineRegex);
    if (match) {
      const price = parseInt(match[1].replace(/[¥\\]/, ""));
      const quantity = match[2] ? parseInt(match[2]) : 1;
      const name = line.replace(match[0], "").trim();
      if (name && price) {
        items.push({ name, price, quantity });
      }
    }
  }

  const totalLine = lines.find((line) => /合\s*計/.test(line));
  const total = totalLine ? parseInt(totalLine.replace(/[^\d]/g, "")) : 0;

  const dateLine = lines.find((line) => /\d{1,2}月\d{1,2}日/.test(line));
  const storeLine = lines.find((line) => /店/.test(line) || /SHOP/.test(line));

  return {
    items,
    total,
    date: dateLine,
    store: storeLine,
  };
};
