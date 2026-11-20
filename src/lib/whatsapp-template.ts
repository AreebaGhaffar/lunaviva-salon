function clean(text: string) {
  return text.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
}

export async function sendWhatsAppTemplate(opts: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  name: string;
  language: string;
  params: string[];
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(
      `https://graph.facebook.com/v23.0/${opts.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: opts.to.replace(/\D/g, ""),
          type: "template",
          template: {
            name: opts.name,
            language: { code: opts.language },
            components: opts.params.length
              ? [
                  {
                    type: "body",
                    parameters: opts.params.map((p) => ({
                      type: "text",
                      text: clean(p),
                    })),
                  },
                ]
              : [],
          },
        }),
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`WhatsApp template error ${response.status}: ${detail}`.slice(0, 400));
    }
  } finally {
    clearTimeout(timer);
  }
}