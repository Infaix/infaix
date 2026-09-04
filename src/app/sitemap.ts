import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://infaix.com";
  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/forge`, lastModified: new Date() },
    { url: `${base}/forge/projects/toolboxhq`, lastModified: new Date() },
    { url: `${base}/ai`, lastModified: new Date() },
    { url: `${base}/about`, lastModified: new Date() },
  ];
}
