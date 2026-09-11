const RECIPIENTS = [
  "mb1699@princeton.edu",
  "kjsuzuki@princeton.edu"
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function cleanString(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\0/g, "")
    .trim()
    .slice(0, maxLength);
}

function cleanSingleLine(value, maxLength) {
  return cleanString(value, maxLength)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ");
}

function validEmail(email) {
  // Empty is okay because email is optional.
  if (!email) {
    return true;
  }

  // Intentionally simple validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  /*
   * Only allow requests coming from the same site.
   */
  const origin = request.headers.get("Origin");

  if (origin) {
    try {
      const requestUrl = new URL(request.url);
      const originUrl = new URL(origin);

      if (originUrl.host !== requestUrl.host) {
        return json(
          { error: "Forbidden." },
          403
        );
      }
    } catch {
      return json(
        { error: "Forbidden." },
        403
      );
    }
  }

  /*
   * The frontend should send JSON.
   */
  const contentType =
    request.headers.get("Content-Type") || "";

  if (!contentType.includes("application/json")) {
    return json(
      { error: "Expected JSON." },
      415
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json(
      { error: "Invalid request." },
      400
    );
  }

  /*
   * Clean submitted values.
   */
  const message = cleanString(
    body.message,
    5000
  );

  const email = cleanString(
    body.email,
    254
  );

  const pageTitle =
    cleanSingleLine(body.pageTitle, 300) ||
    "Untitled page";

  let pageUrl = cleanString(
    body.pageUrl,
    2000
  );

  /*
   * Validate feedback.
   */
  if (!message) {
    return json(
      { error: "Please enter some feedback." },
      400
    );
  }

  if (!validEmail(email)) {
    return json(
      { error: "Please enter a valid email address." },
      400
    );
  }

  /*
   * Make sure the claimed page URL is actually a page
   * on the site submitting the feedback.
   */
  try {
    const submittedUrl = new URL(pageUrl);
    const requestUrl = new URL(request.url);

    if (submittedUrl.host !== requestUrl.host) {
      pageUrl = "(invalid page URL)";
    }
  } catch {
    pageUrl = "(invalid page URL)";
  }

  /*
   * Check Cloudflare environment variables.
   */
  if (!env.RESEND_API_KEY) {
    console.error(
      "RESEND_API_KEY is not configured."
    );

    return json(
      {
        error:
          "The feedback service is not configured."
      },
      500
    );
  }

  if (!env.FEEDBACK_FROM_EMAIL) {
    console.error(
      "FEEDBACK_FROM_EMAIL is not configured."
    );

    return json(
      {
        error:
          "The feedback service is not configured."
      },
      500
    );
  }

  /*
   * Build email.
   */
  const shortenedTitle =
    pageTitle.length > 100
      ? pageTitle.slice(0, 97) + "..."
      : pageTitle;

  const subject =
    `Hidden Phenomena feedback — ${shortenedTitle}`;

  const text = [
    "New Hidden Phenomena feedback",
    "",
    `Article: ${pageTitle}`,
    `URL: ${pageUrl}`,
    "",
    "Feedback:",
    "",
    message,
    "",
    email
      ? `Reply to: ${email}`
      : "Reply to: no email provided"
  ].join("\n");

  const emailPayload = {
    from: env.FEEDBACK_FROM_EMAIL,

    to: RECIPIENTS,

    subject,

    text
  };

  /*
   * If the reader provided their email, pressing "Reply"
   * in your mail client will reply directly to them.
   */
  if (email) {
    emailPayload.reply_to = email;
  }

  /*
   * Send through Resend.
   */
  let resendResponse;

  try {
    resendResponse = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${env.RESEND_API_KEY}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify(emailPayload)
      }
    );
  } catch (error) {
    console.error(
      "Could not contact Resend:",
      error
    );

    return json(
      {
        error:
          "Could not send feedback. Please try again."
      },
      502
    );
  }

  /*
   * Log Resend's response if sending failed.
   */
  if (!resendResponse.ok) {
    const details =
      await resendResponse.text();

    console.error(
      "Resend rejected feedback email:",
      resendResponse.status,
      details
    );

    return json(
      {
        error:
          "Could not send feedback. Please try again."
      },
      502
    );
  }

  /*
   * Everything worked.
   */
  return json({
    ok: true
  });
}
