import NavClient from "./nav-client";
import { getPublicApps } from "@/lib/app-registry";

export default function Nav() {
  return <NavClient apps={getPublicApps()} />;
}
