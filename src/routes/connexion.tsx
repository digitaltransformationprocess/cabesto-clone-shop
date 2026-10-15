import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { testUsers } from "@/lib/data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/connexion")({
  head: () => ({ meta: [
    { title: "Connexion — Marinéo" }, { name: "description", content: "Connectez-vous à votre compte Marinéo." },
    { property: "og:title", content: "Connexion — Marinéo" }, { property: "og:description", content: "Accès client, employé et admin." },
  ] }),
  component: Login,
});

function Login() {
  const { login } = useStore();
  const nav = useNavigate();
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [err, setErr] = useState("");
  const go = (e: string, p: string) => {
    if (!login(e, p)) return setErr("Identifiants incorrects");
    const role = testUsers.find((u) => u.email === e)!.role;
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const redirect = params.get("redirect");
    if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
      window.location.assign(redirect);
      return;
    }
    nav({ to: role === "client" ? "/compte" : "/admin" });
  };
  return (
    <Layout>
      <div className="mx-auto grid max-w-4xl gap-8 px-4 py-12 md:grid-cols-2">
        <form onSubmit={(e) => { e.preventDefault(); go(email, pw); }} className="space-y-3 rounded-lg border bg-card p-6">
          <h1 className="font-display text-2xl font-bold text-primary">Se connecter</h1>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className="w-full rounded-md border px-3 py-2" />
          <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="Mot de passe" className="w-full rounded-md border px-3 py-2" />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button className="w-full rounded-md bg-primary py-2 font-bold text-primary-foreground">Connexion</button>
        </form>
        <div className="rounded-lg border border-dashed bg-muted p-6">
          <h2 className="font-bold">Accès rapide (comptes test)</h2>
          <div className="mt-4 space-y-3">
            {testUsers.map((u) => (
              <button key={u.email} onClick={() => go(u.email, u.password)} className="w-full rounded-md border bg-card p-3 text-left hover:border-accent">
                <p className="font-semibold capitalize">{u.role}</p>
                <p className="text-xs text-muted-foreground">{u.email} / {u.password}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
