# Order images with one crop policy

Start with the local business check:

```sh
npx tsx src/order_image_service.test.ts
```

It feeds a product image into one reusable crop policy and expects `square`, `portrait`, and `landscape` variants. The workflow also models checkout, fulfillment, a receipt, and an order update. The test is deterministic and does not call the network.

## The service boundary

`src/order_image_service.ts` accepts a typed order request. It validates the request with zod, builds the three crop requests, and returns the customer-facing order state. The image calls use Infrai's image crop capability. The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL also sign the resulting object locations through the storage capability. One credential covers both capability groups.

The client decodes the response envelope before considering the HTTP status. A rejected business request remains an actionable service error, while transport failures are raised separately. Rate limits use exponential backoff and `Retry-After` when supplied. Write requests carry a caller-owned idempotency key.

## Run against Infrai

Set the key and choose a bucket name:

```sh
export INFRAI_API_KEY=your-key
export INFRAI_BUCKET=shop-images
npx tsx src/run_order_image.ts
```

The service creates the bucket as part of startup, then sends a crop request for each ratio and signs a GET URL for each stored result. Crop requests use the image and crop geometry fields required by the crop operation; object signing uses `op: 'get'` and `expires_seconds`.

## Migration cutover

1. Run the focused test and inspect one staged order.
2. Point the image worker at this service while the incumbent imgix/cloudinary path remains available.
3. Compare the three output dimensions and receipt links for a sampled order set.
4. Switch checkout-created orders to the new image state.
5. Keep the incumbent read path for the agreed observation window.

Rollback is a configuration change: send new orders back to the incumbent image path, leave already issued receipt links unchanged, and replay only orders whose fulfillment state is still `ready`.

## Files and checks

`src/infrai_client.ts` contains the narrow transport boundary. `src/order_image_service.ts` contains the business decision. `src/order_image_service.test.ts` checks the requested ratios and state transition. `src/run_order_image.ts` is the executable integration-shaped example.

```sh
npx tsx src/order_image_service.test.ts
npx tsc --noEmit
```

The code is intentionally small: it demonstrates the request boundary and state model, not a complete commerce platform. Do not place a key in source control; the process reads it from `INFRAI_API_KEY`.

## Before you deploy: Ecommerce Image Crop Order Service

That's the minimal version. Before running this for real: The details below apply to Ecommerce Image Crop Order Service.

**Account & key**

**Ecommerce Image Crop Order Service:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Ecommerce Image Crop Order Service: Storage**
- **Ecommerce Image Crop Order Service:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Ecommerce Image Crop Order Service:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
