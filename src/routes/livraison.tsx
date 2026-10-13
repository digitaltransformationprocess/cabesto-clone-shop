import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";
import md from "@/content/livraison.md?raw";

export const Route = createFileRoute("/livraison")({
  head: infoHead("Livraison", "Modes, délais et coûts de livraison."),
  component: () => <InfoPage md={md} />,
});
