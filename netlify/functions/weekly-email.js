const ICAL_URL =
  "https://wheresthegig.com/perl/WTGRemote_access.pl?cred=hNNAfSijLmfeaSoGBJlymyG5sjEkvufB";

const MARVILLA_URL = "https://www.marvillamarzan.com/";

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  };
}

function htmlResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body
  };
}

function cleanText(value = "") {
  return String(value)
    .replace(/\\,/g, ",")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "")
    .trim();
}

function unfoldICS(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

function getLineValue(line = "") {
  const index = line.indexOf(":");
  return index >= 0 ? line.slice(index + 1) : "";
}

function parseICSDate(value) {
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hour = value.slice(9, 11) || "00";
  const minute = value.slice(11, 13) || "00";

  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
}

function formatTime(date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit"
  });
}

function escapeHTML(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanVenueName(summary = "") {
  return cleanText(summary)
    .replace(/\s*:\s*Other\s*\(Confirmed\)\s*$/i, "")
    .replace(/\s*:\s*Club Gig\s*\(Confirmed\)\s*$/i, "")
    .replace(/\s*\(Confirmed\)\s*$/i, "")
    .trim();
}

function hasMarvilla(block = "") {
  return /marvilla\s+marzan/i.test(block) || /\bmarvilla\b/i.test(block);
}

function parseEvents(icsText) {
  const unfolded = unfoldICS(icsText);
  const blocks = unfolded.split("BEGIN:VEVENT").slice(1);

  return blocks
    .map((block) => {
      const lines = block.split(/\r?\n/);

      const summaryLine = lines.find((line) => line.startsWith("SUMMARY"));
      const locationLine = lines.find((line) => line.startsWith("LOCATION"));
      const startLine = lines.find((line) => line.startsWith("DTSTART"));
      const endLine = lines.find((line) => line.startsWith("DTEND"));

      const rawSummary = summaryLine ? getLineValue(summaryLine) : "Live Music";
      const venue = cleanVenueName(rawSummary);
      const location = locationLine ? cleanText(getLineValue(locationLine)) : "";
      const start = startLine ? parseICSDate(getLineValue(startLine)) : null;
      const end = endLine ? parseICSDate(getLineValue(endLine)) : null;
      const companionNote = hasMarvilla(block);

      if (!start || !end) return null;

      return {
        venue,
        title: venue,
        location,
        start,
        end,
        dateText: formatDate(start),
        timeText: `${formatTime(start)} - ${formatTime(end)}`,
        companionNote
      };
    })
    .filter(Boolean);
}

function buildPlainText(events) {
  let output = "DeanoUno - This Week\n\n";

  if (!events.length) {
    return output + "No public performances listed for this week.";
  }

  for (const event of events) {
    output += `${event.dateText} - ${event.venue}\n`;
    output += `${event.timeText}\n`;

    if (event.location) {
      output += `${event.location}\n`;
    }

    if (event.companionNote) {
      output += `With Marvilla Marzan: ${MARVILLA_URL}\n`;
    }

    output += "\n";
  }

  return output.trim();
}

function buildEmailHtml(events) {
  if (!events.length) {
    return `
      <h2>DeanoUno - This Week</h2>
      <p>No public performances listed for this week.</p>
    `.trim();
  }

  const eventHtml = events
    .map((event) => {
      return `
        <div style="margin-bottom: 22px;">
          <h3 style="margin: 0 0 6px;">${escapeHTML(event.dateText)} - ${escapeHTML(event.venue)}</h3>
          <p style="margin: 0;">${escapeHTML(event.timeText)}</p>
          ${
            event.location
              ? `<p style="margin: 0;">${escapeHTML(event.location)}</p>`
              : ""
          }
          ${
            event.companionNote
              ? `<p style="margin: 6px 0 0;">With <a href="${MARVILLA_URL}" target="_blank" rel="noopener noreferrer">Marvilla Marzan</a></p>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  return `
    <h2>DeanoUno - This Week</h2>
    ${eventHtml}
  `.trim();
}

function buildBrowserPage({ plainText, emailHtml, days, count }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DeanoUno Weekly Email Generator</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      max-width: 760px;
      margin: 40px auto;
      padding: 0 20px;
      line-height: 1.5;
      color: #1a1a1a;
    }

    h1 {
      margin-bottom: 0.25rem;
    }

    .meta {
      color: #666;
      margin-bottom: 2rem;
    }

    textarea {
      width: 100%;
      min-height: 260px;
      padding: 14px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      line-height: 1.5;
      border: 1px solid #ddd;
      border-radius: 10px;
      box-sizing: border-box;
      margin-bottom: 10px;
    }

    button {
      padding: 10px 16px;
      border: 0;
      border-radius: 999px;
      background: #8a6a3f;
      color: white;
      font-weight: 700;
      cursor: pointer;
      margin-bottom: 28px;
    }

    .preview {
      border: 1px solid #ddd;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 12px;
      background: #fff;
    }
  </style>
</head>
<body>
  <h1>DeanoUno Weekly Email Generator</h1>
  <p class="meta">Showing ${count} event(s) in the next ${days} day(s).</p>

  <h2>Plain Text Version</h2>
  <textarea id="plainText">${escapeHTML(plainText)}</textarea>
  <button onclick="copyText('plainText')">Copy Plain Text</button>

  <h2>HTML Version</h2>
  <textarea id="htmlText">${escapeHTML(emailHtml)}</textarea>
  <button onclick="copyText('htmlText')">Copy HTML</button>

  <h2>Preview</h2>
  <div class="preview">
    ${emailHtml}
  </div>

  <script>
    function copyText(id) {
      const field = document.getElementById(id);
      field.select();
      document.execCommand("copy");
      alert("Copied!");
    }
  </script>
</body>
</html>
  `;
}

exports.handler = async function (event) {
  try {
    const days = Number(event.queryStringParameters?.days || 7);
    const format = event.queryStringParameters?.format || "page";

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + days);

    const response = await fetch(ICAL_URL);

    if (!response.ok) {
      throw new Error(`Where's The Gig returned status ${response.status}`);
    }

    const icsText = await response.text();

    const events = parseEvents(icsText)
      .filter((item) => item.start >= now && item.start <= cutoff)
      .sort((a, b) => a.start - b.start);

    const plainText = buildPlainText(events);
    const emailHtml = buildEmailHtml(events);

    if (format === "json") {
      return jsonResponse(200, {
        success: true,
        days,
        count: events.length,
        events,
        plainText,
        html: emailHtml
      });
    }

    return htmlResponse(
      200,
      buildBrowserPage({
        plainText,
        emailHtml,
        days,
        count: events.length
      })
    );
  } catch (error) {
    return htmlResponse(
      500,
      `<h1>Weekly Email Generator Error</h1><p>${escapeHTML(error.message)}</p>`
    );
  }
};