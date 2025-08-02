import type{ ParsedReceipt } from "../types/ocr";
export const parseReceiptText = (text: string): ParsedReceipt => {
  const lines = text.split(/\n|\|/).map((line) => line.trim()).filter(line => line !== "");
  const items: ParsedReceipt["items"] = [];

  const itemLineRegex = /^(?:\d{3,4}\s+)?(.+?)\s+¥?(\d+)(?:\s+(\d+)個)?(?:\s+¥?(\d+))?$/;

  for (const line of lines) {
    const match = line.match(itemLineRegex);
    if (match) {
      const name = match[1].trim();
      const unitPrice = parseInt(match[2]);
      const quantity = match[3] ? parseInt(match[3]) : 1;
      const total = match[4] ? parseInt(match[4]) : unitPrice * quantity;

      if (name && unitPrice) {
        items.push({
          name,
          price: total,
          quantity,
        });
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
    date: dateLine ?? "",
    store: storeLine ?? "",
  };
};

