import { getBakongSourceInfo } from "./config";
import { bakongRequest } from "./client";

export async function generateBakongDeeplink(qrString) {
  const data = await bakongRequest("/v1/generate_deeplink_by_qr", {
    body: {
      qr: qrString,
      sourceInfo: getBakongSourceInfo(),
    },
  });

  if (data?.responseCode !== 0 || !data?.data?.shortLink) {
    throw Object.assign(new Error(data?.responseMessage || "Unable to generate Bakong deeplink."), {
      code: "BAKONG_DEEPLINK_FAILED",
      errorCode: data?.errorCode,
      responseCode: data?.responseCode,
    });
  }

  return data.data.shortLink;
}
