import { getPublicContentTree } from "@/shared/content/public-article-store";

export async function GET(): Promise<Response> {
  try {
    return Response.json(
      { articles: await getPublicContentTree() },
      {
        headers: { "cache-control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Public article index unavailable", error);
    return Response.json(
      { error: "public_article_index_unavailable" },
      { status: 503 },
    );
  }
}
