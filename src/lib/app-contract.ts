/** Serializable v1 navigation contract. Visibility is discovery, never authorization. */
export type AppStatus = "live" | "preview" | "development" | "planned" | "maintenance";
export interface InfaixApp {
  id: string;
  name: string;
  description: string;
  url: string | null;
  icon: string;
  status: AppStatus;
  visibility: "public" | "private";
  availability: "available" | "restricted" | "unavailable";
  requiresAuth: boolean;
  accessRequirement?: string;
}

export function canLaunch(app: InfaixApp): boolean {
  return app.visibility === "public" && app.status === "live" &&
    app.availability !== "unavailable" && !!app.url;
}

export function publicApps(apps: readonly InfaixApp[]): InfaixApp[] {
  return apps.filter((app) => app.visibility === "public").map((app) => ({
    ...app, url: canLaunch(app) ? app.url : null,
  }));
}
