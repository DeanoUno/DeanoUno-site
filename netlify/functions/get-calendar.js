exports.handler = async function () {
  try {
    const feedUrl = process.env.WTG_ICAL_URL;

    if (!feedUrl) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "text/plain" },
        body: "Missing WTG_ICAL_URL"
      };
    }

    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 Netlify Function Calendar Fetch"
      }
    });

    const rawText = await response.text();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-store"
      },
      body: rawText.slice(0, 5000)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: `ERROR: ${error.message}`
    };
  }
};