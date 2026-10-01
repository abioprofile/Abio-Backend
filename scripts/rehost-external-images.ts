/**
 * Find image URLs stored before uploads were enforced that point outside our
 * Cloudinary account, and (with --apply) re-host them on Cloudinary.
 *
 *   npx tsx scripts/rehost-external-images.ts           # dry run: report only
 *   npx tsx scripts/rehost-external-images.ts --apply   # re-host and update rows
 *
 * Cloudinary fetches each remote URL itself; this process never downloads it.
 * URLs that fail to re-host are reported and left unchanged.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import cache from "@/lib/cache";
import cloudinary from "@/shared/utils/cloudinary";
import { isOwnCloudinaryUrl } from "@/shared/utils/zod/cloudinaryUrl";
import { bustPublicProfileCache } from "@/modules/profiles/profile.service";

const APPLY = process.argv.includes("--apply");

type Json = Record<string, unknown>;

const isExternal = (url: unknown): url is string =>
  typeof url === "string" && url.length > 0 && !isOwnCloudinaryUrl(url);

const rehosted = new Map<string, string>();
const failures: { where: string; url: string; error: string }[] = [];
let found = 0;

/** Returns the Cloudinary URL to store, or the original URL in dry run / on failure. */
const rehost = async (url: string, folder: string, where: string) => {
  found += 1;
  console.log(`${APPLY ? "re-hosting" : "found"}  ${where}  ${url}`);
  if (!APPLY) return url;

  const cached = rehosted.get(url);
  if (cached) return cached;

  try {
    const result = await cloudinary.uploader.upload(url, {
      folder,
      resource_type: "image",
    });
    rehosted.set(url, result.secure_url);
    return result.secure_url;
  } catch (error) {
    failures.push({ where, url, error: String((error as Error)?.message ?? error) });
    return url;
  }
};

const rehostAll = async (urls: string[], folder: string, where: string) => {
  const out: string[] = [];
  for (const url of urls) {
    out.push(isExternal(url) ? await rehost(url, folder, where) : url);
  }
  return out;
};

const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

const themes = async () => {
  const rows = await prisma.displayTheme.findMany({
    select: { id: true, wallpaper_config: true },
  });
  for (const row of rows) {
    const config = (row.wallpaper_config ?? {}) as Json;
    if (!isExternal(config.image)) continue;
    const image = await rehost(config.image, "wallpapers", `theme ${row.id}`);
    if (APPLY && image !== config.image) {
      await prisma.displayTheme.update({
        where: { id: row.id },
        data: { wallpaper_config: { ...config, image } as Prisma.InputJsonObject },
      });
    }
  }
};

const displayPreferences = async () => {
  const rows = await prisma.displayPreference.findMany({
    select: {
      id: true,
      wallpaper_config: true,
      profile: { select: { username: true } },
    },
  });
  for (const row of rows) {
    const config = (row.wallpaper_config ?? {}) as Json;
    if (!isExternal(config.image)) continue;
    const image = await rehost(config.image, "wallpapers", `preferences ${row.id}`);
    if (APPLY && image !== config.image) {
      await prisma.displayPreference.update({
        where: { id: row.id },
        data: { wallpaper_config: { ...config, image } as Prisma.InputJsonObject },
      });
      await bustPublicProfileCache(row.profile.username);
    }
  }
};

const avatars = async () => {
  const rows = await prisma.profile.findMany({
    where: { avatarUrl: { not: null } },
    select: { id: true, avatarUrl: true, username: true },
  });
  for (const row of rows) {
    if (!isExternal(row.avatarUrl)) continue;
    const avatarUrl = await rehost(row.avatarUrl, "avatars", `profile ${row.id}`);
    if (APPLY && avatarUrl !== row.avatarUrl) {
      await prisma.profile.update({ where: { id: row.id }, data: { avatarUrl } });
      await bustPublicProfileCache(row.username);
    }
  }
};

const products = async () => {
  const rows = await prisma.aStoreProduct.findMany({
    select: { id: true, imageUrls: true, metadata: true },
  });
  for (const row of rows) {
    const where = `product ${row.id}`;
    const imageUrls = await rehostAll(row.imageUrls, "astore-products", where);

    const metadata = (row.metadata ?? {}) as Json;
    const preview = (metadata.preview ?? null) as Json | null;
    let nextMetadata = metadata;
    if (preview) {
      const nextPreview = { ...preview };
      for (const key of ["frontOverlayUrl", "backOverlayUrl"]) {
        if (isExternal(preview[key])) {
          nextPreview[key] = await rehost(preview[key], "astore-products", `${where} ${key}`);
        }
      }
      nextMetadata = { ...metadata, preview: nextPreview };
    }

    if (APPLY && (changed(imageUrls, row.imageUrls) || changed(nextMetadata, metadata))) {
      await prisma.aStoreProduct.update({
        where: { id: row.id },
        data: { imageUrls, metadata: nextMetadata as Prisma.InputJsonObject },
      });
    }
  }
};

const variants = async () => {
  const rows = await prisma.aStoreProductVariant.findMany({
    select: { id: true, imageUrls: true },
  });
  for (const row of rows) {
    const imageUrls = await rehostAll(row.imageUrls, "astore-products", `variant ${row.id}`);
    if (APPLY && changed(imageUrls, row.imageUrls)) {
      await prisma.aStoreProductVariant.update({ where: { id: row.id }, data: { imageUrls } });
    }
  }
};

const cartItems = async () => {
  const rows = await prisma.cartItem.findMany({
    where: { artworkUrl: { not: null } },
    select: { id: true, artworkUrl: true },
  });
  for (const row of rows) {
    if (!isExternal(row.artworkUrl)) continue;
    const artworkUrl = await rehost(row.artworkUrl, "astore-artwork", `cart item ${row.id}`);
    if (APPLY && artworkUrl !== row.artworkUrl) {
      await prisma.cartItem.update({ where: { id: row.id }, data: { artworkUrl } });
    }
  }
};

const orderItems = async () => {
  const rows = await prisma.aStoreOrderItem.findMany({
    select: { id: true, imageUrls: true, artworkUrl: true },
  });
  for (const row of rows) {
    const where = `order item ${row.id}`;
    const imageUrls = await rehostAll(row.imageUrls, "astore-products", where);
    const artworkUrl = isExternal(row.artworkUrl)
      ? await rehost(row.artworkUrl, "astore-artwork", `${where} artwork`)
      : row.artworkUrl;
    if (APPLY && (changed(imageUrls, row.imageUrls) || artworkUrl !== row.artworkUrl)) {
      await prisma.aStoreOrderItem.update({
        where: { id: row.id },
        data: { imageUrls, artworkUrl },
      });
    }
  }
};

const main = async () => {
  console.log(APPLY ? "Mode: APPLY" : "Mode: dry run (pass --apply to re-host)");
  await themes();
  await displayPreferences();
  await avatars();
  await products();
  await variants();
  await cartItems();
  await orderItems();

  console.log(`\nExternal image URLs found: ${found}`);
  if (APPLY) {
    console.log(`Re-hosted: ${rehosted.size} unique URL(s)`);
    console.log(`Failed: ${failures.length}`);
    for (const f of failures) console.log(`  ${f.where}  ${f.url}  — ${f.error}`);
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    cache.disconnect();
  });
