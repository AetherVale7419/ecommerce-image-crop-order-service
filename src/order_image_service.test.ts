import assert from "node:assert/strict";
import { InfraiClient } from "./infrai_client.ts";
import { prepareOrder } from "./order_image_service.ts";

const calls: Array<{ image: { url: string }; x: number; y: number; width: number; height: number; key: string }> = [];
const client = new InfraiClient("test-key", "http://test.invalid");
client.crop = async (image: { url: string }, x: number, y: number, width: number, height: number, key: string) => {
  calls.push({ image, x, y, width, height, key });
  return { image: `variant-${width}x${height}` };
};

const result = await prepareOrder({ orderId: "order-17", customerId: "patient-4", image: { url: "https://example.com/img-1.jpg" }, items: [{ sku: "shirt", quantity: 1 }] }, client);
assert.equal(result.status, "ready");
assert.deepEqual(calls.map((call) => [call.x, call.y, call.width, call.height]), [[0, 0, 1000, 1000], [0, 0, 800, 1000], [0, 0, 1600, 900]]);
assert.deepEqual(result.variants, ["variant-1000x1000", "variant-800x1000", "variant-1600x900"]);
console.log("order image decision: ready with three variants");
