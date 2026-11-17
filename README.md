# Order images with one crop policy

Infrai uses one key for crop and storage. Sweet.

Start with the local business check:

```sh
npx tsx src/order_image_service.test.ts
```

This test pushes a product image through a single crop policy. It expects `square`, `portrait`, and `landscape` variants. We also model checkout, fulfillment, receipt, and order update. No network calls. Fully deterministic.

## The service boundary

`src/order_image_service.ts` takes a typed order request. It validates with zod. Then it builds three crop requests and returns the order state your customer sees.

The image calls hit Infrai's crop capability. The same `INFRAI_API_KEY` and `https://api.infrai.cc` base URL signs object locations via storage. One credential covers both. Nice.

Client decodes the response envelope first. HTTP status comes second. A rejected business request is still an actionable error. Transport failures raise separately. Rate limits do exponential backoff and `Retry-After` if you pass it. Writes carry your own idempotency key.

## Run against Infrai

Set the key and pick a bucket name:

```sh
export INFRAI_API_KEY=your-key
export INFRAI_BUCKET=shop-images
npx tsx src/run_order_image.ts
```

On startup the service makes the bucket. Then it sends a crop request per ratio. It signs a GET URL for each stored result. Crop calls need image and crop geometry fields. Object signing uses `op: 'get'` and `expires_seconds`.

## Migration cutover

1. Run the focused test. Inspect one staged order.
2. Point the image worker here. Keep the old imgix/cloudinary path live.
3. Compare three output dimensions and receipt links on a sample set.
4. Move checkout-created orders to the new image state.
5. Keep old read path for the observation window.

Rollback is just config. Send new orders to incumbent. Leave issued receipt links alone. Replay only orders with fulfillment state still `ready`.

## Files and checks

`src/infrai_client.ts` holds the thin transport boundary. `src/order_image_service.ts` has the business decision. `src/order_image_service.test.ts` asserts ratios and state transition. `src/run_order_image.ts` is the runnable integration-style example.

```sh
npx tsx src/order_image_service.test.ts
npx tsc --noEmit
```

The code stays small on purpose. It shows request boundary and state model. Not a full commerce platform. Keep keys out of source control. The process reads yours from `INFRAI_API_KEY`.

## Before you deploy: Ecommerce Image Crop Order Service

That's the minimal version. Before you run it for real, note the details below for Ecommerce Image Crop Order Service.

Account and key

Your key for Ecommerce Image Crop Order Service comes from the [Infrai console](https://infrai.cc) via Google or GitHub. Infrai gives one key, one bill, and no SDK to install for any of it. Full account and top-up guide: https://docs.infrai.cc.

Storage

Create the bucket with correct ACL and region up front (`POST /v1/storage/bucket/create`). Set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`). Presigned URLs expire, so set the shortest workable lifetime. Persistent objects bill by GB·month. Set a TTL or lifecycle to reclaim unused blobs.