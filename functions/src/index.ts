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
  api_visionAPI_getOcrResult: "./visionAPI/getOcrResult",
  api_cloudflare_uploadImageToCloudflare: "./cloudFlare/useStorage",
  api_documentAI_getReceiptData: "./documentAI/getRecieptData",
  api_openai_generateRecipe: "./openai/generateRecipe",
  api_openai_recipes_core:"./openai/recipes/core",
  api_openai_recipes_generaeteAgentRecipes:"./openai/recipes/generateAgentRecipe",
  api_openai_recipes_runRecipeAgent:"./openai/recipes/runRecipeAgent"
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
