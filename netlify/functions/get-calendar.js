const ical = require("node-ical");

exports.handler = async function () {
  const feedUrl = process.env.WTG_ICAL_URL;
  const data = await ical.async.fromURL(feedUrl);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data, null, 2)
  };
};    }

    const data = await ical.async.fromURL(feedUrl);

    const now = new Date();

    const events = Object.values(data)
      .filter((item) => item && item.type === "VEVENT" && item.start)
      .map((event) => {
        const start = new Date(event.start);
        const end = event.end ? new Date(event.end) : null;

        return {
          title: event.summary || "Untitled event",
          description: event.description || "",
          location: event.location || "",
          start: start.toISOString(),
          end: end ? end.toISOString() : null,
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
          }),
          startMs: start.getTime()
        };
      })
      //.filter((event) => event.startMs >= now.getTime())
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 12)
      .map(({ startMs, ...event }) => event);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      },
      body: JSON.stringify({ events })
    };
  } catch (error) {
    console.error("Calendar fetch error:", error);

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to fetch calendar.",
        details: error.message
      })
    };
  }
};