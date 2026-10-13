import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";
import md from "@/content/conditions-generales-de-vente.md?raw";

export const Route = createFileRoute("/cgv")({
  head: infoHead("Conditions générales de vente", "Conditions générales de vente de la boutique."),
  component: () => <InfoPage md={md} />,
});
