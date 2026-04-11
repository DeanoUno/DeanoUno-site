const ical = require("node-ical");

exports.handler = async function () {
  try {
    const feedUrl = process.env.WTG_ICAL_URL;

    if (!feedUrl) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing WTG_ICAL_URL" })
      };
    }

    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 Netlify Calendar Fetch"
      }
    });

    let rawText = await response.text();

    // 🔥 FIX: unfold ICS lines (this is the key)
    rawText = rawText.replace(/\r?\n[ \t]/g, "");

    const parsed = ical.parseICS(rawText);
    const now = Date.now();

    const events = Object.values(parsed)
      .filter((item) => item && item.type === "VEVENT" && item.start)
      .map((event) => {
        const start = new Date(event.start);
        const end = event.end ? new Date(event.end) : null;

        return {
          title: event.summary || "Untitled event",
          location: event.location || "",
          description: event.description || "",
          start: start.toISOString(),
          end: end ? end.toISOString() : null,
          startMs: start.getTime(),
          dateText: start.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: "America/New_York"
          }),
          timeText: start.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/New_York"
          })
        };
      })
      .filter((event) => event.startMs >= now)
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 12)
      .map(({ startMs, ...event }) => event);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ events }, null, 2)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Calendar parsing failed",
        details: error.message
      })
    };
  }
};