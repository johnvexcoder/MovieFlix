import { redirect } from "next/navigation";

export default function AdminLibrariesRedirect() {
  redirect("/admin-panel/media");
}