import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import {
  PROJECT_ID,
  DOCUMENTAI_LOCATION,
  DOCUMENTAI_PROCESSOR_ID
} from "../config/secrets";

const client = new DocumentProcessorServiceClient();

export const analyzeReceipt = async (imageBytes: Buffer) => {
  const processorPath = client.processorPath(
    PROJECT_ID.value,
    DOCUMENTAI_LOCATION.value,
    DOCUMENTAI_PROCESSOR_ID.value
  );

  const request = {
    name: processorPath,
    rawDocument: {
      content: imageBytes.toString("base64"),
      mimeType: "image/png",
    },
  };

  const [result] = await client.processDocument(request);
  const document = result.document;

  const parsed = {
    items: [] as { name: string; price: number; quantity: number }[],
    total: 0,
    store: "",
    date: "",
  };

  for (const entity of document?.entities || []) {
  const type = entity.type;
  const value = entity.mentionText ?? "";

  console.log(`📦 entity.type = ${type}, value = ${value}`);

  if (type === "line_item") {
    let name = "";
    let price = 0;
    let quantity = 1;

    for (const prop of entity.properties || []) {
      const pType = prop.type;
      const pValue = prop.mentionText ?? "";

      console.log(`  └─ 🧩 prop.type = ${pType}, value = ${pValue}`);

      if (pType && pType.includes("description")) {
        name = pValue;
      } else if (pType && (pType.includes("unit_price") || pType.includes("amount"))) {
        price = parseFloat(pValue);
      } else if (pType && pType.includes("quantity")) {
        quantity = parseInt(pValue);
      }
    }

    if (name && price) {
      parsed.items.push({ name, price, quantity });
    }
  }

  // 他の情報は従来通り
  else if (type === "total_amount") {
    parsed.total = parseFloat(value);
  } else if (type === "merchant_name" || type === "supplier_name") {
    parsed.store = value;
  } else if (type === "purchase_date" || type === "receipt_date") {
    parsed.date = entity.normalizedValue?.text || value;
  }
}

  return parsed;
};
