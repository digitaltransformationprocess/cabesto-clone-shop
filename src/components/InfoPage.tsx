import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Layout } from "./Layout";

export function InfoPage({ md }: { md: string }) {
  return (
    <Layout>
      <article className="prose-info mx-auto max-w-4xl px-4 py-10">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
      </article>
    </Layout>
  );
}

export const infoHead = (title: string, description: string) => () => ({
  meta: [
    { title: `${title} — Marinéo` }, { name: "description", content: description },
    { property: "og:title", content: `${title} — Marinéo` }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ],
});
