import { SiteBannerDismissible } from "./site-banner-dismissible";

export function SiteBanner() {
  const text = process.env.SITE_BANNER_TEXT;
  if (!text) return null;
  return <SiteBannerDismissible text={text} />;
}
