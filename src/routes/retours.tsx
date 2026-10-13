import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";
import md from "@/content/retour-produit.md?raw";

export const Route = createFileRoute("/retours")({
  head: infoHead("Retour produit", "Comment retourner un produit et être remboursé."),
  component: () => <InfoPage md={md} />,
});
