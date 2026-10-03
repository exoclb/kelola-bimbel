import type { Metadata } from "next";
import { FormAturUlangSandi } from "@/components/form-atur-ulang-sandi";

export const metadata: Metadata = { title: "Atur Ulang Sandi" };

export default async function AturUlangSandiPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <FormAturUlangSandi token={token?.trim() || null} />;
}
