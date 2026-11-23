
const { handler: getCalendar } = require("./get-calendar");

const TIME_ZONE = "America/New_York";
const MARVILLA_URL = "https://www.marvillamarzan.com/";

const COLORS = {
  white: "#FFFFFF",
  gold: "#F4D28A",
  light: "#E8E8E8"
};

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
  const weekdays = [
    "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"
  ];

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

  const baseStyle =
    "font-family:Arial,Helvetica,sans-serif;" +
    "text-align:right;";

  const html = `
    <div style="${baseStyle}margin:0 0 32px 0;">

      <p style="${baseStyle}
                color:${COLORS.white};
                font-size:21px;
                font-weight:700;
                line-height:1.4;
                margin:0 0 12px 0;">
        ${escapeHTML(date)}
      </p>

      <p style="${baseStyle}
                color:${COLORS.gold};
                font-size:19px;
                font-weight:700;
                line-height:1.4;
                margin:0 0 9px 0;">
        ${escapeHTML(venue)}
      </p>

      <p style="${baseStyle}
                color:${COLORS.white};
                font-size:17px;
                line-height:1.5;
                margin:0 0 9px 0;">
        ${escapeHTML(time)}
      </p>

      ${location ? `
      <p style="${baseStyle}
                color:${COLORS.light};
                font-size:15px;
                line-height:1.5;
                margin:0 0 9px 0;">
        ${escapeHTML(location)}
      </p>

      <p style="${baseStyle}
                font-size:15px;
                margin:0 0 9px 0;">
        <a href="${escapeHTML(mapsLink(location))}"
           style="color:${COLORS.gold};
                  text-decoration:underline;">
          Get directions
        </a>
      </p>` : ""}

      ${withMarvilla ? `
      <p style="${baseStyle}
                color:${COLORS.white};
                font-size:15px;
                margin:0;">
        With
        <a href="${MARVILLA_URL}"
           style="color:${COLORS.gold};">
          Marvilla Marzan
        </a>
      </p>` : ""}

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

    // Only the schedule is generated.
    // Kit supplies the photograph, heading and footer.
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;
                  text-align:right;
                  color:#FFFFFF;
                  line-height:1.5;
                  width:100%;">

        ${
          formatted.length
            ? formatted.map(item => item.html).join("\n")
            : `<p style="color:#FFFFFF;text-align:right;">
                 No remaining public performances this week.
               </p>`
        }

      </div>`;

    const plainText = formatted.length
      ? formatted.map(item => item.plain).join("\n\n")
      : "No remaining public performances this week.";

    return jsonResponse(200, {
      success: true,
      subject,
      weekEnding: sundayKey,
      eventCount: events.length,
      html,
      plainText
    });

  } catch (error) {
    console.error(
      "Weekly email generation failed:",
      error.message
    );

    return jsonResponse(500, {
      success: false,
      message: "Unable to generate the weekly email."
    });
  }
};
