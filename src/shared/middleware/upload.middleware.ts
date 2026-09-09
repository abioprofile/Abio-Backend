import multer from "multer";
import AppError from "@/shared/utils/appError";

const storage = multer.memoryStorage();

const ALLOWED_IMAGE_MIME =
  /^image\/(jpeg|jpg|png|webp|gif|heic|heif|avif|bmp|tiff)$/i;

const ALLOWED_ID_DOC_MIME =
  /^(image\/(jpeg|jpg|png|webp|gif|heic|heif|avif|bmp|tiff)|application\/pdf)$/i;

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Some browsers send HEIC as application/octet-stream — still allow image/* and empty type with .heic name
  const name = file.originalname?.toLowerCase() ?? "";
  const looksHeic = name.endsWith(".heic") || name.endsWith(".heif");
  if (
    ALLOWED_IMAGE_MIME.test(file.mimetype) ||
    file.mimetype.startsWith("image/") ||
    looksHeic
  ) {
    cb(null, true);
  } else {
    cb(new AppError("Only image files are allowed", 400) as any, false);
  }
};

const idDocumentFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const name = file.originalname?.toLowerCase() ?? "";
  const looksHeic = name.endsWith(".heic") || name.endsWith(".heif");
  const looksPdf = name.endsWith(".pdf");
  if (
    ALLOWED_ID_DOC_MIME.test(file.mimetype) ||
    file.mimetype.startsWith("image/") ||
    looksHeic ||
    looksPdf
  ) {
    cb(null, true);
  } else {
    cb(
      new AppError("Only image or PDF files are allowed for ID documents", 400) as any,
      false
    );
  }
};

export const uploadImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/** Verification badge ID document (image or PDF, max 5MB) */
export const uploadIdDocument = multer({
  storage,
  fileFilter: idDocumentFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
