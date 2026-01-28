type GradientSpec = {
  color: string;
  amount: number;
};

export type WallpaperConfig = {
  type: "gradient" | "fill" | "image";
  image?: {url: string, publicId: string};
  backgroundColor?: String | GradientSpec[];
};

export type FontConfig = {
  name: String;
  fillColor: String;
  strokeColor: String;
};

export type CornerConfig = {
  type: "sharp" | "curved" | "round";
  fillColor: String;
  strokeColor: String;
  opacity: Number;
  shadowSize: "none" | "soft" | "hard";
  shadowColor: String;
};
