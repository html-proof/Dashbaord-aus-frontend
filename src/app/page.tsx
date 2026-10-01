import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LayoutGrid, Sparkles, Store } from "lucide-react";

export default async function Home() {
  if (await getSession()) redirect("/resume");

  const features = [
    {
      icon: LayoutGrid,
      title: "Drag-and-drop dashboards",
      text: "Pick your charts, resize them, and arrange them the way you think about your store.",
    },
    {
      icon: Sparkles,
      title: "Adapts to your store",
      text: "Turn on product costs or inventory tracking in Shopify, and profit and stock widgets appear automatically.",
    },
    {
      icon: Store,
      title: "Connects to Shopify",
      text: "Connect one or more stores securely. Data stays in sync through Shopify webhooks.",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-16">
      <p className="text-sm font-semibold text-accent">Storeboard</p>
      <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
        Your Shopify analytics, arranged your way.
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted">
        Sign in with Google, Apple, or email, connect your store, and build the dashboard you actually
        want to look at.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/login" className="btn btn-primary px-5 py-2.5">
          Get started
        </Link>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="card p-5">
            <f.icon className="size-5 text-accent" />
            <h2 className="mt-3 font-medium">{f.title}</h2>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
