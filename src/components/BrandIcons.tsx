import type { AdPlatform } from "@/lib/ads/platforms";

// Small simplified platform marks for the integrations list (decorative; the name is always shown next to them).

function Meta() {
  return (
    <svg viewBox="0 0 36 24" className="h-6 w-9" aria-hidden>
      <path
        d="M4 18c0-6 3-12 7-12 3 0 5 3 7 6.5C20 16 22 18 24.5 18c2.6 0 4-2.3 4-5.6C28.5 8.3 26.6 6 24 6c-2.5 0-4.4 2.4-6 5.5M4 18c0 2 1 3 2.6 3 2.3 0 3.8-2 6-5.8"
        fill="none"
        stroke="#0866FF"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GoogleAds() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect x="11" y="2.5" width="8.5" height="27" rx="4.25" transform="rotate(30 15.25 16)" fill="#FBBC04" />
      <rect x="11" y="2.5" width="8.5" height="27" rx="4.25" transform="rotate(-30 15.25 16) translate(7 0)" fill="#4285F4" />
      <circle cx="7" cy="25" r="4.3" fill="#34A853" />
    </svg>
  );
}

function TikTok() {
  const note = "M17 4h4c.3 3 2.4 5.2 5.5 5.5v4c-2 0-3.9-.6-5.5-1.7V20a7 7 0 1 1-7-7v4a3 3 0 1 0 3 3V4z";
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <path d={note} fill="#25F4EE" transform="translate(-1 -1)" />
      <path d={note} fill="#FE2C55" transform="translate(1 1)" />
      <path d={note} fill="currentColor" />
    </svg>
  );
}

function Analytics() {
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
      <rect x="20" y="3" width="7" height="26" rx="3.5" fill="#F9AB00" />
      <rect x="11.5" y="12" width="7" height="17" rx="3.5" fill="#E37400" />
      <circle cx="6.5" cy="25.5" r="3.5" fill="#E37400" />
    </svg>
  );
}

export const BRAND_ICONS: Record<AdPlatform, () => React.JSX.Element> = {
  meta: Meta,
  google_ads: GoogleAds,
  tiktok: TikTok,
  ga4: Analytics,
};
