import { redirect } from "next/navigation";

export default function AdminTaxPage() {
  redirect("/admin?tab=tax");
}
