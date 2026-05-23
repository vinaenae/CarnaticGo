import Link from "next/link";
import { getShopState } from "@/app/auth/shop-actions";
import { ShopClient } from "@/components/shop/ShopClient";

export default async function ShopPage() {
  const state = await getShopState();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          ← Home
        </Link>
        <h1 className="font-heading mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Shop
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Spend points on items in the shop.
        </p>
      </div>

      <ShopClient initialState={state} />
    </div>
  );
}
