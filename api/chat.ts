import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body as { message: string };

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const apiUrl = process.env.ENNOIA_API_URL;
  const project = process.env.ENNOIA_PROJECT;
  const apiKey = process.env.ENNOIA_API_KEY;
  const hash = process.env.ENNOIA_HASH;

  if (!apiUrl || !project || !apiKey || !hash) {
    return res.status(500).json({ error: "Missing Ennoia API configuration" });
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        project,
        apiKey,
      },
      body: JSON.stringify({
        hash,
        params: { user_message: message },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res
        .status(response.status)
        .json({ error: "Ennoia API error", detail: errorText });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.[0]?.text ?? "";

    return res.status(200).json({ text });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: "Internal server error", detail: error.message });
  }
}
