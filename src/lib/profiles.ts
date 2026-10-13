// Public profiles listed in the site footer. Entries without a URL (Discord,
// Battle.net) are friend handles, shown as text rather than links.
export interface Profile {
  platform: string;
  handle: string;
  icon: string;
  url?: string;
}

export const PATREON_URL = "https://www.patreon.com/cw/Orboro";

export const profiles: Profile[] = [
  { platform: "Discord", handle: "xing_yuen", icon: "discord" },
  { platform: "Battle.net", handle: "Xing#1673", icon: "battlenet" },
  { platform: "Steam", handle: "XingYuen", icon: "steam", url: "https://steamcommunity.com/id/XingYuen/" },
  { platform: "Reddit", handle: "u/XingYuen", icon: "reddit", url: "https://www.reddit.com/user/XingYuen/" },
  { platform: "YouTube", handle: "@XingYuen", icon: "youtube", url: "https://www.youtube.com/@XingYuen" },
  { platform: "Twitch", handle: "xingyuen", icon: "twitch", url: "https://www.twitch.tv/xingyuen" },
];
