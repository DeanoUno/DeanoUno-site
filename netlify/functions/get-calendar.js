const ical = require("node-ical");

exports.handler = async function () {
  try {
    const feedUrl = process.env.WTG_ICAL_URL;

    if (!feedUrl) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing WTG_ICAL_URL" }, null, 2)
      };
    }

    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 Netlify Calendar Fetch"
      }
    });

    let rawText = await response.text();

    // Unfold folded ICS lines
    rawText = rawText.replace(/\r?\n[ \t]/g, "");

    const parsed = ical.parseICS(rawText);
    const items = Object.values(parsed);

    const vevents = items.filter(
      (item) => item && item.type === "VEVENT" && item.start
    );

    const mapped = vevents.map((event) => {
      const start = new Date(event.start);
      return {
        title: event.summary || "",
        rawStart: String(event.start),
        isoStart: isNaN(start.getTime()) ? "INVALID" : start.toISOString(),
        ms: isNaN(start.getTime()) ? null : start.getTime(),
        location: event.location || ""
      };
    });

    const now = Date.now();

    const future = mapped.filter((e) => e.ms && e.ms >= now);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify(
        {
          now: new Date(now).toISOString(),
          totalParsedItems: items.length,
          veventCount: vevents.length,
          futureCount: future.length,
          first5: mapped.slice(0, 5),
          last5: mapped.slice(-5),
          first5Future: future.slice(0, 5)
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
          error: "Calendar parsing failed",
          details: error.message
        },
        null,
        2
      )
    };
  }
};