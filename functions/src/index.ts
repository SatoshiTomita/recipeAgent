import admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions/v2";
import serviceAccount from "../config/serviceAccontKey.json";
// import { initializeSentry } from "./util/sentry";

// initializeSentry();

// firebase-adminを初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  // databaseURL: "https://recipeagent-cff98.firebaseio.com",
});

setGlobalOptions({ region: "asia-northeast1" });

process.env.TZ = "Asia/Tokyo";

interface FunctionsObj {
  [key: string]: string;
}

// ここに定義を追加していく
const funcs: FunctionsObj = {
  api_vision_getImageInfo: "./visionAPI/getImageInfo",
  api_cloudflare_uploadImageToCloudflare: "./cloudFlare/useStorage",
};

const loadFunctions = (functionsObj: FunctionsObj) => {
  for (const functionName in functionsObj) {
    if (
      !process.env.FUNCTION_NAME ||
      process.env.FUNCTION_NAME.startsWith(functionName)
    ) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      module.exports[functionName] = require(functionsObj[functionName]);
    }
  }
};

loadFunctions(funcs);
