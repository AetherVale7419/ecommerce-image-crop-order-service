import { z } from "zod";
import { InfraiClient, type ImageRef } from "./infrai_client.ts";

const orderSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  image: z.union([z.object({ base64: z.string().min(1) }), z.object({ url: z.string().url() }), z.object({ image_id: z.string().min(1) })]),
  items: z.array(z.object({ sku: z.string().min(1), quantity: z.number().int().positive() })).min(1)
});

export type OrderRequest = Omit<z.infer<typeof orderSchema>, "image"> & { image: ImageRef };
export type OrderResult = { orderId: string; status: "ready"; receipt: { customerId: string }; variants: string[] };

export function validateOrder(input: unknown): OrderRequest {
  return orderSchema.parse(input);
}

export async function prepareOrder(input: unknown, client: InfraiClient): Promise<OrderResult> {
  const order = validateOrder(input);
  const crops = [
    { name: "1:1", width: 1000, height: 1000 },
    { name: "4:5", width: 800, height: 1000 },
    { name: "16:9", width: 1600, height: 900 }
  ];
  const variants = await Promise.all(crops.map((crop) => client.crop(order.image, 0, 0, crop.width, crop.height, `${order.orderId}-${crop.name}`)));
  return { orderId: order.orderId, status: "ready", receipt: { customerId: order.customerId }, variants: variants.map((variant) => variant.image) };
}
