function unfoldICS(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function parseICSTimestamp(value) {
  const m = String(value).match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/
  );

  if (!m) return null;

  const [, y, mo, d, h, mi, s, z] = m;

  if (z) {
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  }

  return new Date(+y, +mo - 1, +d, +h, +mi, +s);
}

function unescapeICS(value) {
  return String(value || "")
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseEventsFromICS(rawText) {
  const unfolded = unfoldICS(rawText);
  const lines = unfolded.split(/\r?\n/);

  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }

    if (!current) continue;

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const left = line.slice(0, colonIndex);
    const value = line.slice(colonIndex + 1);
    const propName = left.split(";")[0];

    if (propName === "SUMMARY") current.summary = unescapeICS(value);
    if (propName === "LOCATION") current.location = unescapeICS(value);
    if (propName === "DESCRIPTION") current.description = unescapeICS(value);
    if (propName === "DTSTART") current.dtstart = value.trim();
    if (propName === "DTEND") current.dtend = value.trim();
  }

  return events;
}

exports.handler = async function () {
  try {
    const feedUrl = process.env.WTG_ICAL_URL;

    if (!feedUrl) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Missing WTG_ICAL_URL environment variable."
        })
      };
    }

    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 Netlify Calendar Fetch"
      }
    });

    if (!response.ok) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Failed to fetch calendar feed.",
          status: response.status,
          statusText: response.statusText
        })
      };
    }

    const rawText = await response.text();
    const rawEvents = parseEventsFromICS(rawText);
    const now = Date.now();

    const events = rawEvents
      .map((event) => {
        const start = parseICSTimestamp(event.dtstart);
        const end = parseICSTimestamp(event.dtend);

        if (!start) return null;

        const rawDescription = event.description || "";
        const linkMatch = rawDescription.match(/https:\/\/[^\s"]+/);
        const link = linkMatch ? linkMatch[0] : null;

        const title = (event.summary || "Untitled event")
          .replace(": Club Gig (Confirmed)", "")
          .replace(": Private Party (Confirmed)", "")
          .replace(": Restaurant Gig (Confirmed)", "")
          .trim();

        const description = rawDescription
          .replace(/<[^>]*>/g, "")
          .split("\n\n")[0]
          .trim();

        return {
          title,
          description,
          location: event.location || "",
          link,
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
      .filter(Boolean)
      .filter((event) => event.startMs >= now)
      .sort((a, b) => a.startMs - b.startMs)
      .slice(0, 12)
      .map(({ startMs, ...event }) => event);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      },
      body: JSON.stringify({ events }, null, 2)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Calendar function failed.",
        details: error.message
      })
    };
  }
};