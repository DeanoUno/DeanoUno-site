function unfoldICS(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function unescapeICS(value) {
  return String(value || "")
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function extractICSDateInfo(rawValue) {
  const value = String(rawValue || "").trim();
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/);

  if (!m) return null;

  const [, y, mo, d, h = "00", mi = "00", s = "00", z] = m;

  return {
    year: +y,
    month: +mo,
    day: +d,
    hour: +h,
    minute: +mi,
    second: +s,
    isUTC: !!z
  };
}

function getOffsetMinutesForTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(date);

  const tzName = parts.find((p) => p.type === "timeZoneName")?.value || "GMT+0";
  const match = tzName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);

  if (!match) return 0;

  const sign = match[1] === "-" ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3] || "0", 10);

  return sign * (hours * 60 + minutes);
}

function floatingTimeInZoneToUtcISOString(parts, timeZone = "America/New_York") {
  if (!parts) return null;

  if (parts.isUTC) {
    return new Date(
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
      )
    ).toISOString();
  }

  const wallClockMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  let offsetMinutes = getOffsetMinutesForTimeZone(new Date(wallClockMs), timeZone);
  let realUtcMs = wallClockMs - offsetMinutes * 60 * 1000;

  for (let i = 0; i < 3; i++) {
    const actualOffsetMinutes = getOffsetMinutesForTimeZone(new Date(realUtcMs), timeZone);
    if (actualOffsetMinutes === offsetMinutes) break;

    offsetMinutes = actualOffsetMinutes;
    realUtcMs = wallClockMs - offsetMinutes * 60 * 1000;
  }

  return new Date(realUtcMs).toISOString();
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

    const [propName, ...paramParts] = left.split(";");
    const params = {};

    for (const part of paramParts) {
      const eqIndex = part.indexOf("=");
      if (eqIndex !== -1) {
        const key = part.slice(0, eqIndex).toUpperCase();
        const val = part.slice(eqIndex + 1);
        params[key] = val;
      }
    }

    if (propName === "SUMMARY") current.summary = unescapeICS(value);
    if (propName === "LOCATION") current.location = unescapeICS(value);
    if (propName === "DESCRIPTION") current.description = unescapeICS(value);

    if (propName === "DTSTART") {
      current.dtstart = value.trim();
      current.dtstartParams = params;
    }

    if (propName === "DTEND") {
      current.dtend = value.trim();
      current.dtendParams = params;
    }
  }

  return events;
}

function formatEventDateText(isoString, timeZone = "America/New_York") {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone
  });
}

function formatEventTimeText(isoString, timeZone = "America/New_York") {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone
  });
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
        const startParts = extractICSDateInfo(event.dtstart);
        const endParts = extractICSDateInfo(event.dtend);

        if (!startParts) return null;

        const eventTimeZone = event.dtstartParams?.TZID || "America/New_York";

        const startISO = floatingTimeInZoneToUtcISOString(startParts, eventTimeZone);
        const endISO = endParts
          ? floatingTimeInZoneToUtcISOString(
              endParts,
              event.dtendParams?.TZID || eventTimeZone
            )
          : null;

        const startMs = Date.parse(startISO);
        if (Number.isNaN(startMs)) return null;

        const rawDescription = event.description || "";
        const sourceText = `${event.summary || ""}\n${rawDescription}`;
        const companionNote = /\bMarvilla\b/i.test(sourceText)
          ? "With Marvilla Marzan"
          : null;
        const linkMatch = rawDescription.match(/https:\/\/[^\s"]+/);
        const link = linkMatch ? linkMatch[0] : null;

        const title = (event.summary || "Untitled event")
          .replace(/\s*:\s*.*$/, "")
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
          companionNote,
          start: startISO,
          end: endISO,
          dateText: formatEventDateText(startISO, eventTimeZone),
          timeText: formatEventTimeText(startISO, eventTimeZone),
          sortMs: startMs
        };
      })
      .filter(Boolean)
      .filter((event) => event.sortMs >= now)
      .sort((a, b) => a.sortMs - b.sortMs)
      .map(({ sortMs, ...event }) => event);

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
