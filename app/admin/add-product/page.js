import { AdminAreaPage } from "@/components/admin-area-page";
import { AdminAddProductPageView } from "@/components/admin-product-pages";

export default async function AdminAddProductPage() {
  return (
    <AdminAreaPage>
      <AdminAddProductPageView />
    </AdminAreaPage>
  );
}
