// Check Meta's current Graph API version occasionally and update this.
const GRAPH_VERSION = "v23.0";

export async function sendWhatsAppText(args: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${args.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: args.to.replace(/[^\d]/g, ""),
        type: "text",
        text: { body: args.body.slice(0, 4000), preview_url: false },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp error ${response.status}: ${detail}`.slice(0, 400));
  }
}