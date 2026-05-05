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

  const kitApiKey = process.env.KIT_API_KEY;
  const kitFormId = process.env.KIT_FORM_ID;

  if (!kitApiKey || !kitFormId) {
    return jsonResponse(503, {
      success: false,
      message: "The mailing list is not connected yet. Please try again soon."
    });
  }

  try {
    const response = await fetch(`https://api.convertkit.com/v3/forms/${kitFormId}/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: kitApiKey,
        email,
        first_name: firstName,
        source: "deanouno-site"
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return jsonResponse(502, {
        success: false,
        message: result.message || "Unable to join right now. Please try again later."
      });
    }

    return jsonResponse(200, {
      success: true,
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