import * as functions from "firebase-functions/v2/https"; // v2 用
import fetch from "node-fetch";
import FormData from "form-data";
import { IncomingForm } from "formidable";
import fs from "fs/promises";

export const uploadImageToCloudflare = functions.onRequest(
  {
    region: "asia-northeast1",
    // cors: true はコメントアウトまたは削除（↓で手動対応）
  },
  async (req, res) => {
    // ✅ CORS ヘッダーを必ず自分で設定
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // ✅ OPTIONS リクエストには即時レスポンス
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
    const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;

    const form = new IncomingForm({ multiples: false, maxFileSize: 10 * 1024 * 1024 });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parse error:", err);
        res.status(400).send("Invalid form data");
        return;
      }

      const fileField = files.file;
      const file = Array.isArray(fileField) ? fileField[0] : fileField;

      if (!file) {
        res.status(400).send("ファイルが見つかりませんでした");
        return;
      }

      try {
        const fileBuffer = await fs.readFile(file.filepath);
        const fileName = file.originalFilename ?? "uploaded.png";

        const cloudflareForm = new FormData();
        cloudflareForm.append("file", fileBuffer, fileName);

        const cloudflareRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
            },
            body: cloudflareForm as any,
          }
        );

        const result = await cloudflareRes.json() as {
          success: boolean;
          errors?: any;
          result?: { variants?: string[] };
        };

        if (!result.success) {
          console.error("Cloudflare Error:", result.errors);
          res.status(500).send("Cloudflare upload failed");
          return;
        }

        const imageUrl = result.result?.variants?.[0];
        res.status(200).json({ imageUrl });
      } catch (e: any) {
        console.error("Upload error:", e);
        res.status(500).send("Internal Server Error");
      }
    });
  }
);

