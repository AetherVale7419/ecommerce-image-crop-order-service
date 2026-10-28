import { InfraiClient } from "./infrai_client.ts";
import { prepareOrder } from "./order_image_service.ts";

const key = process.env.INFRAI_API_KEY;
const bucket = process.env.INFRAI_BUCKET;
if (!key || !bucket) throw new Error("Set INFRAI_API_KEY and INFRAI_BUCKET");

const client = new InfraiClient(key);
await client.createBucket(bucket);
const objectKeys: string[] = [];
try {
  const result = await prepareOrder({ orderId: "order-demo", customerId: "customer-demo", image: { base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" }, items: [{ sku: "tee", quantity: 1 }] }, client);
  const receiptLinks = await Promise.all(result.variants.map(async (image, index) => {
    const objectKey = `${result.orderId}/variant-${index}`;
    await client.uploadImage(bucket, objectKey, image);
    objectKeys.push(objectKey);
    return client.presign(bucket, objectKey);
  }));
  console.log(JSON.stringify({ checkout: "accepted", fulfillment: result.status, receipt: result.receipt, customerUpdate: "variants-ready", receiptLinks }, null, 2));
} finally {
  await Promise.all(objectKeys.map((objectKey) => client.deleteObject(bucket, objectKey)));
  await client.deleteBucket(bucket);
}
