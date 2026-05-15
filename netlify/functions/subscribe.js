function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
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
    return jsonResponse(503, { success: false, message: "The mailing list is not connected yet. Please try again soon." });
  }

  
  try {
    const createResponse = await fetch("https://api.kit.com/v4/subscribers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kit-Api-Key": kitApiKey
      },
      body: JSON.stringify({
        email_address: email,
        first_name: firstName
      })
    });

    const createResult = await createResponse.json();

    
  if (!createResponse.ok) {
    throw new Error(JSON.stringify(createResult));
  }

    const subscriberId = createResult?.subscriber?.id;

    if (!subscriberId) {
      throw new Error("Kit did not return a subscriber ID.");
    }

    const formResponse = await fetch(`https://api.kit.com/v4/forms/${kitFormId}/subscribers/${subscriberId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Kit-Api-Key": kitApiKey
      },
      body: JSON.stringify({
        referrer: "https://deano.uno"
      })
    });

          const formResult = await formResponse.text();

    if (!formResponse.ok) {
      throw new Error(`Add to form failed: ${formResult}`);
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