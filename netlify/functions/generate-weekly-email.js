
const { handler: getCalendar } = require("./get-calendar");

const TIME_ZONE = "America/New_York";
const MARVILLA_URL = "https://www.marvillamarzan.com/";

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function localDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).formatToParts(date);

  return Object.fromEntries(
    parts.filter(p => p.type !== "literal")
      .map(p => [p.type, p.value])
  );
}

function dateKey(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getWeekEnd(now) {
  const p = localDateParts(now);
  const weekdays = ["Sun", "Mon", "Tue", "Wed",
    "Thu", "Fri", "Sat"];

  const daysUntilSunday =
    (7 - weekdays.indexOf(p.weekday)) % 7;

  const date = new Date(Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day) + daysUntilSunday
  ));

  return date.toISOString().slice(0, 10);
}

function formatDate(iso) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date(iso));
}

function formatTime(iso) {
  if (!iso) return "";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function formatShortDate(iso) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric"
  }).format(new Date(iso));
}

function mapsLink(location) {
  return "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(location);
}

function isPublicEvent(event) {
  const text = [
    event.title,
    event.description,
    event.location
  ].join(" ");

  return !/\b(private party|private event|private function|invitation only)\b/i
    .test(text);
}

function formatEvent(event) {
  const venue = event.title || "Live Music";
  const date = formatDate(event.start);
  const start = formatTime(event.start);
  const end = formatTime(event.end);
  const time = end ? `${start} – ${end}` : start;
  const location = event.location || "";
  const withMarvilla = Boolean(event.companionNote);

  const venueHTML = escapeHTML(venue);
  const locationHTML = escapeHTML(location);

  const directionsHTML = location
    ? `<a href="${escapeHTML(mapsLink(location))}">Get directions</a>`
    : "";

  const marvillaHTML = withMarvilla
    ? `<p>Performing with <a href="${MARVILLA_URL}">Marvilla Marzan</a></p>`
    : "";

  const html = `
    <div style="margin-bottom:26px;">
      <h3 style="margin:0 0 5px;">${escapeHTML(date)}</h3>
      <p style="margin:0;"><strong>${venueHTML}</strong></p>
      <p style="margin:4px 0;">${escapeHTML(time)}</p>
      ${location ? `<p style="margin:4px 0;">${locationHTML}</p>` : ""}
      ${directionsHTML ? `<p style="margin:4px 0;">${directionsHTML}</p>` : ""}
      ${marvillaHTML}
    </div>`;

  const plain = [
    date,
    venue,
    time,
    location,
    location ? `Directions: ${mapsLink(location)}` : "",
    withMarvilla
      ? `With Marvilla Marzan: ${MARVILLA_URL}`
      : ""
  ].filter(Boolean).join("\n");

  return { html, plain };
}

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(data)
  };
}

exports.handler = async function () {
  try {
    const calendarResponse = await getCalendar();

    if (calendarResponse.statusCode !== 200) {
      throw new Error("Unable to retrieve calendar events.");
    }

    const payload = JSON.parse(calendarResponse.body);
    const allEvents = payload.events || [];

    const now = new Date();
    const sundayKey = getWeekEnd(now);

    const events = allEvents.filter(event => {
      if (!event.start || !isPublicEvent(event)) {
        return false;
      }

      const start = new Date(event.start);
      const end = event.end ? new Date(event.end) : start;

      if (end < now) return false;

      const eventDay = dateKey(localDateParts(start));
      return eventDay <= sundayKey;
    });

    const formatted = events.map(formatEvent);

    const sundayDate = new Date(
      `${sundayKey}T12:00:00Z`
    );

    const subject = `DeanoUno This Week – ${
      formatShortDate(now.toISOString())
    } through ${formatShortDate(sundayDate.toISOString())}`;

    const intro = "Here's where I'll be playing this week!";

    const html = `
      <div style="font-family:Arial,sans-serif;
                  max-width:600px;margin:auto;
                  color:#222;line-height:1.6;">
        <h1 style="text-align:center;">DeanoUno</h1>
        <p>${intro}</p>
        ${
          formatted.length
            ? formatted.map(item => item.html).join("\n")
            : "<p>No remaining public performances this week.</p>"
        }
        <p>Hope to see you there!</p>
        <p>DeanoUno</p>
      </div>`;

    const plainText = [
      "DeanoUno",
      intro,
      "",
      formatted.length
        ? formatted.map(item => item.plain).join("\n\n")
        : "No remaining public performances this week.",
      "",
      "Hope to see you there!",
      "DeanoUno"
    ].join("\n");

    return jsonResponse(200, {
      success: true,
      subject,
      weekEnding: sundayKey,
      eventCount: events.length,
      html,
      plainText
    });

  } catch (error) {
    console.error("Weekly email generation failed:", error.message);

    return jsonResponse(500, {
      success: false,
      message: "Unable to generate the weekly email."
    });
  }
};
