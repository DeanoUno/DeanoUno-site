const ical = require("node-ical");

exports.handler = async function () {
  try {
    const feedUrl = process.env.WTG_ICAL_URL;

    if (!feedUrl) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Missing WTG_ICAL_URL environment variable."
        }, null, 2)
      };
    }

    const data = await ical.async.fromURL(feedUrl);
    const now = Date.now();

    const allItems = Object.values(data);

    const vevents = allItems.filter(
      (item) => item && item.type === "VEVENT" && item.start
    );

    const mapped = vevents.map((event) => {
      const start = new Date(event.start);
      const end = event.end ? new Date(event.end) : null;

      return {
        title: event.summary || "Untitled event",
        location: event.location || "",
        rawStart: event.start,
        rawEnd: event.end || null,
        startIso: isNaN(start.getTime()) ? "INVALID DATE" : start.toISOString(),
        endIso: end && !isNaN(end.getTime()) ? end.toISOString() : null,
        startMs: start.getTime()
      };
    });

    const future = mapped.filter((event) => event.startMs >= now);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(
        {
          nowIso: new Date(now).toISOString(),
          totalItems: allItems.length,
          veventCount: vevents.length,
          mappedCount: mapped.length,
          futureCount: future.length,
          firstFiveMapped: mapped.slice(0, 5),
          firstFiveFuture: future.slice(0, 5),
          lastFiveMapped: mapped.slice(-5)
        },
        null,
        2
      )
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        {
          error: "Failed to fetch calendar.",
          details: error.message,
          stack: error.stack
        },
        null,
        2
      )
    };
  }
};