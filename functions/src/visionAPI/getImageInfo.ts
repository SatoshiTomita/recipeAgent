// functions/src/index.ts
import * as functions from 'firebase-functions';
import vision from '@google-cloud/vision';

// クライアント初期化（Firebase 環境なら認証不要）
const client = new vision.ImageAnnotatorClient();

export const getImageInfo = functions.https.onCall(async (data, context) => {
  const imageUrl = (data as { imageUrl?: string }).imageUrl;

  if (!imageUrl) {
    throw new functions.https.HttpsError('invalid-argument', 'imageUrl is required');
  }

  try {
    const [labelResult] = await client.labelDetection(imageUrl);
    const [textResult] = await client.textDetection(imageUrl);

    const labels = labelResult.labelAnnotations?.map(l => l.description) || [];
    const text = textResult.textAnnotations?.[0]?.description || '';

    return {
      labels,
      text,
    };
  } catch (err: any) {
    console.error('Vision API error:', err);
    throw new functions.https.HttpsError('internal', err.message);
  }
});
