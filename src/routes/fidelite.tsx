import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, infoHead } from "@/components/InfoPage";
import md from "@/content/cgu-programme-fidelite.md?raw";

export const Route = createFileRoute("/fidelite")({
  head: infoHead("Programme fidélité", "Conditions du programme de fidélité."),
  component: () => <InfoPage md={md} />,
});
