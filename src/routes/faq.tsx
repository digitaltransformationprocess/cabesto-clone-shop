import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";
import md from "@/content/faq.md?raw";

export const Route = createFileRoute("/faq")({
  head: infoHead("FAQ", "Réponses aux questions : commande, livraison, paiement, compte, professionnels."),
  component: () => <InfoPage md={md} />,
});
