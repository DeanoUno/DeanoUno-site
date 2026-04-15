function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { success: false, message: "Please submit the form to join the list." });
  }

  let payload;

  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { success: false, message: "Please check your signup details and try again." });
  }

  const firstName = String(payload.firstName || payload.first_name || "").trim();
  const email = String(payload.email || "").trim().toLowerCase();

  if (!isValidEmail(email)) {
    return jsonResponse(400, { success: false, message: "Please enter a valid email address." });
  }

  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;

  if (!webhookUrl) {
    return jsonResponse(503, {
      success: false,
      message: "The mailing list is not connected yet. Please try again soon."
    });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        first_name: firstName,
        source: "deanouno-site",
        submittedAt: new Date().toISOString()
      })
    });

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return jsonResponse(502, {
        success: false,
        message: "Mailing list service returned an unreadable response.",
        raw: text
      });
    }

    if (!response.ok) {
      return jsonResponse(502, {
        success: false,
        message: result.error || "Unable to join right now. Please try again later."
      });
    }

    if (!result.success) {
      return jsonResponse(502, {
        success: false,
        message: result.error || "Unable to save your signup right now."
      });
    }

    if (result.duplicate) {
      return jsonResponse(200, {
        success: true,
        duplicate: true,
        message: "You are already on the list."
      });
    }

    return jsonResponse(200, {
      success: true,
      duplicate: false,
      message: "Thanks. You are on the list."
    });

  } catch (err) {
    return jsonResponse(502, {
      success: false,
      message: "Unable to join right now. Please try again later.",
      error: err.message || String(err)
    });
  }
};