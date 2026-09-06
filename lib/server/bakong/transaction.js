import { bakongRequest } from "./client";

export async function checkTransactionByMd5(md5) {
  return bakongRequest("/v1/check_transaction_by_md5", {
    auth: true,
    body: { md5 },
  });
}
