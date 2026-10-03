import type { Metadata } from "next";
import { FormLupaSandi } from "@/components/form-lupa-sandi";

export const metadata: Metadata = { title: "Lupa Sandi" };

export default function LupaSandiPage() {
  return <FormLupaSandi />;
}
