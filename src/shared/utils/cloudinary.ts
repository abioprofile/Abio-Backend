import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import env from "@/env";
import AppError from "@/shared/utils/appError";
import logger from "@/shared/config/logger";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  timeout: 120_000,
});

type UploadPreset = {
  maxEdge?: number;
  square?: number;
};

const PRESETS: Record<string, UploadPreset> = {
  avatars: { square: 400 },
  icon_urls: { square: 128 },
  wallpapers: { maxEdge: 1920 },
};

/** iPhone HEIC/HEIF (incl. Live Photo / Portrait variants). */
const isHeifBuffer = (buf: Buffer): boolean => {
  if (buf.length < 12) return false;
  if (buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12).toLowerCase();
  return ["heic", "heif", "mif1", "msf1", "heix", "hevc", "heim", "heis"].includes(
    brand
  );
};

const isHeifMime = (mimetype?: string) =>
  !!mimetype && /image\/(heic|heif)/i.test(mimetype);

const deliveryUrl = (publicId: string, folder: string): string => {
  const preset = PRESETS[folder] ?? { maxEdge: 1600 };

  if (preset.square) {
    return cloudinary.url(publicId, {
      secure: true,
      transformation: [
        {
          width: preset.square,
          height: preset.square,
          crop: "fill",
          gravity: "auto",
        },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
  }

  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      {
        width: preset.maxEdge,
        height: preset.maxEdge,
        crop: "limit",
      },
      { quality: "auto", fetch_format: "auto" },
    ],
  });
};

/**
 * Local optimize for JPEG/PNG/WebP.
 * Skipped for HEIC — libheif rejects many real iPhone files
 * ("Number of references in iref box exceeds security limits").
 */
const optimizeWithSharp = async (
  fileBuffer: Buffer,
  folder: string
): Promise<Buffer> => {
  const preset = PRESETS[folder] ?? { maxEdge: 1600 };

  let pipeline = sharp(fileBuffer, { failOn: "none" })
    .rotate()
    .resize({
      width: 2000,
      height: 2000,
      fit: "inside",
      withoutEnlargement: true,
    });

  if (preset.square) {
    pipeline = pipeline.resize(preset.square, preset.square, {
      fit: "cover",
      position: "centre",
    });
  } else if (preset.maxEdge) {
    pipeline = pipeline.resize({
      width: preset.maxEdge,
      height: preset.maxEdge,
      fit: "inside",
      withoutEnlargement: true,
    });
  }

  return pipeline.webp({ quality: 80 }).toBuffer();
};

const isTimeoutError = (error: unknown) => {
  const err = error as { name?: string; http_code?: number; message?: string };
  return (
    err?.name === "TimeoutError" ||
    err?.http_code === 499 ||
    /timeout/i.test(err?.message ?? "")
  );
};

const isSharpHeifLimitError = (error: unknown) => {
  const message = String((error as { message?: string })?.message ?? "");
  return /heif|iref|security limit/i.test(message);
};

/** Upload already-optimized WebP (small, fast). */
const uploadOptimizedWebp = (optimized: Buffer, folder: string) =>
  cloudinary.uploader.upload(
    `data:image/webp;base64,${optimized.toString("base64")}`,
    {
      folder,
      resource_type: "image",
      timeout: 120_000,
    }
  );

/** Upload original bytes via stream (HEIC / sharp fallback). */
const uploadOriginalStream = (fileBuffer: Buffer, folder: string) =>
  new Promise<Awaited<ReturnType<typeof cloudinary.uploader.upload>>>(
    (resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "image",
          timeout: 120_000,
        },
        (error, result) => {
          if (error) reject(error);
          else if (!result) reject(new Error("Empty Cloudinary result"));
          else resolve(result);
        }
      );
      stream.end(fileBuffer);
    }
  );

const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (!isTimeoutError(error)) throw error;
    logger.warn("Cloudinary upload timed out — retrying once");
    return fn();
  }
};

export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  folder: string = "avatars",
  mimetype?: string
): Promise<{ url: string; publicId: string }> => {
  if (!fileBuffer?.length) {
    throw new AppError("Empty image upload", 400);
  }

  const heif = isHeifMime(mimetype) || isHeifBuffer(fileBuffer);

  try {
    // Path A: HEIC/HEIF — never run through sharp (known intermittent 500s)
    if (heif) {
      logger.info({ folder, bytes: fileBuffer.length }, "Uploading HEIF via Cloudinary");
      const result = await withRetry(() => uploadOriginalStream(fileBuffer, folder));
      return {
        publicId: result.public_id,
        url: deliveryUrl(result.public_id, folder),
      };
    }

    // Path B: sharp → small WebP → Cloudinary
    try {
      const optimized = await optimizeWithSharp(fileBuffer, folder);
      const result = await withRetry(() => uploadOptimizedWebp(optimized, folder));
      if (!result.secure_url || !result.public_id) {
        throw new Error("Cloudinary upload returned an empty result");
      }
      return { url: result.secure_url, publicId: result.public_id };
    } catch (sharpOrUploadError) {
      // Path C: sharp choked (odd HEIF misdetect, corrupt jpeg, etc.) → raw upload
      if (
        isSharpHeifLimitError(sharpOrUploadError) ||
        /Input buffer|VipsJpeg|corrupt|unsupported/i.test(
          String((sharpOrUploadError as Error)?.message ?? "")
        )
      ) {
        logger.warn(
          { err: sharpOrUploadError, folder },
          "Sharp optimize failed — falling back to Cloudinary original upload"
        );
        const result = await withRetry(() =>
          uploadOriginalStream(fileBuffer, folder)
        );
        return {
          publicId: result.public_id,
          url: deliveryUrl(result.public_id, folder),
        };
      }
      throw sharpOrUploadError;
    }
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (isTimeoutError(error)) {
      throw new AppError(
        "Image upload timed out. Please try again with a smaller image.",
        504
      );
    }

    logger.error({ err: error, folder }, "Image upload failed");
    throw new AppError("Image upload failed. Please try a JPG or PNG.", 502);
  }
};

/**
 * Pull `folder/id` public_id out of a Cloudinary delivery URL.
 * Handles version segments and transformation URL segments.
 */
export const extractCloudinaryPublicId = (url: string): string | null => {
  try {
    const { pathname, hostname } = new URL(url);
    if (!hostname.includes("cloudinary.com")) return null;

    const marker = "/upload/";
    const idx = pathname.indexOf(marker);
    if (idx === -1) return null;

    let rest = pathname.slice(idx + marker.length);
    // Drop leading transformation segments (contain `,` or look like `c_fill`)
    // and optional version `v123456/`
    const parts = rest.split("/").filter(Boolean);
    while (parts.length) {
      const part = parts[0];
      if (/^v\d+$/.test(part)) {
        parts.shift();
        break;
      }
      if (part.includes(",") || /^[a-z]+_/i.test(part)) {
        parts.shift();
        continue;
      }
      break;
    }

    if (!parts.length) return null;
    return parts.join("/").replace(/\.[a-z0-9]+$/i, "");
  } catch {
    return null;
  }
};

/** Best-effort destroy — missing assets should not fail the API. */
export const deleteFromCloudinary = async (
  publicIdOrUrl: string
): Promise<void> => {
  const publicId =
    publicIdOrUrl.includes("://")
      ? extractCloudinaryPublicId(publicIdOrUrl)
      : publicIdOrUrl;

  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    logger.warn({ err: error, publicId }, "Cloudinary destroy failed (ignored)");
  }
};

/* ------------------------- Private documents (ID docs) ------------------------- */

/** How long a signed link to a private document stays valid. */
const PRIVATE_LINK_TTL_SECONDS = 15 * 60;

/**
 * Upload a sensitive file (e.g. a badge ID document) as an `authenticated`
 * Cloudinary asset. Its stored URL cannot be opened without a signature, so
 * callers must hand it out through `signPrivateDocumentUrl`.
 * Original bytes are kept (no sharp) so PDFs and HEIC work as-is.
 */
export const uploadPrivateDocument = async (
  fileBuffer: Buffer,
  folder: string
): Promise<{ url: string; publicId: string }> => {
  if (!fileBuffer?.length) {
    throw new AppError("Empty file upload", 400);
  }

  try {
    const result = await withRetry(
      () =>
        new Promise<Awaited<ReturnType<typeof cloudinary.uploader.upload>>>(
          (resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder,
                resource_type: "image",
                type: "authenticated",
                timeout: 120_000,
              },
              (error, res) => {
                if (error) reject(error);
                else if (!res) reject(new Error("Empty Cloudinary result"));
                else resolve(res);
              }
            );
            stream.end(fileBuffer);
          }
        )
    );
    // Store an unsigned URL: Cloudinary's secure_url embeds a permanent
    // signature, which would make the stored value a working link if leaked.
    const url = cloudinary.url(result.public_id, {
      secure: true,
      resource_type: "image",
      type: "authenticated",
      format: result.format,
    });
    return { url, publicId: result.public_id };
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new AppError(
        "Upload timed out. Please try again with a smaller file.",
        504
      );
    }
    logger.error({ err: error, folder }, "Private document upload failed");
    throw new AppError("Upload failed. Please try a JPG, PNG or PDF.", 502);
  }
};

/**
 * Turn a stored private-document URL into a short-lived signed download link.
 * Older public uploads (`/upload/` URLs) are returned unchanged.
 */
export const signPrivateDocumentUrl = (storedUrl: string): string => {
  try {
    const { hostname, pathname } = new URL(storedUrl);
    if (!hostname.includes("cloudinary.com")) return storedUrl;

    const marker = "/image/authenticated/";
    const idx = pathname.indexOf(marker);
    if (idx === -1) return storedUrl;

    const parts = pathname
      .slice(idx + marker.length)
      .split("/")
      .filter(Boolean);
    if (parts.length && /^s--[^/]+--$/.test(parts[0])) parts.shift();
    if (parts.length && /^v\d+$/.test(parts[0])) parts.shift();
    if (!parts.length) return storedUrl;

    const last = parts[parts.length - 1];
    const dot = last.lastIndexOf(".");
    const format = dot > 0 ? last.slice(dot + 1) : "";
    if (dot > 0) parts[parts.length - 1] = last.slice(0, dot);
    const publicId = decodeURIComponent(parts.join("/"));

    return cloudinary.utils.private_download_url(publicId, format, {
      resource_type: "image",
      type: "authenticated",
      expires_at: Math.floor(Date.now() / 1000) + PRIVATE_LINK_TTL_SECONDS,
    });
  } catch {
    return storedUrl;
  }
};

export default cloudinary;
