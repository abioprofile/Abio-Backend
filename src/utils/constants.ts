export const ORGANIZATION_NAME = "Abio.site";

export const PASSWORD_COMPLEXITY_REGEX =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).+$/;

export const SOCIAL_PLATFORMS = {
  TWITTER: {
    name: "Twitter/X",
    icon: "twitter",
    urlPattern: /twitter\.com|x\.com/,
  },
  INSTAGRAM: {
    name: "Instagram",
    icon: "instagram",
    urlPattern: /instagram\.com/,
  },
  LINKEDIN: { name: "LinkedIn", icon: "linkedin", urlPattern: /linkedin\.com/ },
  GITHUB: { name: "GitHub", icon: "github", urlPattern: /github\.com/ },
  FACEBOOK: { name: "Facebook", icon: "facebook", urlPattern: /facebook\.com/ },
  YOUTUBE: { name: "YouTube", icon: "youtube", urlPattern: /youtube\.com/ },
  TIKTOK: { name: "TikTok", icon: "tiktok", urlPattern: /tiktok\.com/ },
  DISCORD: {
    name: "Discord",
    icon: "discord",
    urlPattern: /discord\.gg|discord\.com/,
  },
  TWITCH: { name: "Twitch", icon: "twitch", urlPattern: /twitch\.tv/ },
  SPOTIFY: { name: "Spotify", icon: "spotify", urlPattern: /spotify\.com/ },
} as const;
