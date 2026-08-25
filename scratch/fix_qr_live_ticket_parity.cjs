const fs = require('node:fs');

function patchOnce(path, before, after, label) {
  let text = fs.readFileSync(path, 'utf8');
  if (text.includes(after)) return false;
  if (!text.includes(before)) throw new Error(`Patch anchor not found: ${label}`);
  text = text.replace(before, after);
  fs.writeFileSync(path, text);
  return true;
}

function patchSection(path, startMarker, endMarker, replacement, label) {
  let text = fs.readFileSync(path, 'utf8');
  if (text.includes(replacement.trim())) return false;
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Patch start anchor not found: ${label}`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Patch end anchor not found: ${label}`);
  text = text.slice(0, start) + replacement + text.slice(end);
  fs.writeFileSync(path, text);
  return true;
}

const path = 'src/components/PublicSalonPage.tsx';
const changed = [];
const mark = (didChange) => { if (didChange && !changed.includes(path)) changed.push(path); };

mark(patchOnce(
  path,
  "import { ThankYouScreen } from './ThankYouScreen';",
  "import { ThankYouScreen } from './ThankYouScreen';\nimport { LiveTicket, type JourneyStage, type TicketPerson } from './LiveTicket';",
  'shared LiveTicket import',
));

mark(patchOnce(
  path,
  "  const position = peopleAhead + 1;\n",
  `  const position = peopleAhead + 1;\n  const estimatedMinutes = barbersActive > 0\n    ? Math.max(5, Math.ceil((peopleAhead * 15) / Math.max(1, barbersActive)))\n    : 0;\n  const joinedAtTimeLabel = entry?.createdAt\n    ? new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })\n    : undefined;\n  const calledAtTimeLabel = entry?.calledAt\n    ? new Date(entry.calledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })\n    : undefined;\n  const journeyStage: JourneyStage = !entry\n    ? 'joined'\n    : entry.status === 'Serving' || entry.status === 'Called'\n      ? 'your-turn'\n      : (peopleAhead <= 1 || estimatedMinutes <= 10)\n        ? 'upcoming'\n        : 'in-queue';\n  const ticketPosition = !entry || entry.status === 'Called' || entry.status === 'Serving' ? 0 : position;\n  const ticketPeopleAround: TicketPerson[] = (() => {\n    if (!entry) return [];\n    const ordered = queue\n      .filter((item) => ['Waiting', 'Called', 'Serving'].includes(item.status))\n      .sort((a, b) => a.createdAt - b.createdAt);\n    const myIndex = ordered.findIndex((item) => item.id === entry.id);\n    if (myIndex < 0) return [];\n    return ordered.slice(Math.max(0, myIndex - 2), myIndex + 3).map((item) => {\n      const absoluteIndex = ordered.findIndex((candidate) => candidate.id === item.id);\n      const isMe = item.id === entry.id;\n      return {\n        id: item.id,\n        label: isMe ? 'YOU' : (item.name || 'Customer').trim().slice(0, 1).toUpperCase(),\n        positionNumber: absoluteIndex + 1,\n        relLabel: isMe ? 'Current token' : absoluteIndex < myIndex ? 'Ahead of you' : 'Behind you',\n        photoUrl: item.customerPhotoUrl,\n        isMe,\n      };\n    });\n  })();\n`,
  'QR LiveTicket derived state',
));

mark(patchSection(
  path,
  "      {/* ---------------- LIVE TICKET / QUEUED VIEW ---------------- */}\n",
  "      {/* QUEUE JOIN SHEET */}",
  `      {/* ---------------- LIVE TICKET / QUEUED VIEW ---------------- */}\n      {isQueued && entry && !completed && (\n        <main id=\"qr-live-ticket-screen\" className=\"mx-auto max-w-md space-y-4 px-5 pb-12 pt-4\">\n          <div>\n            <div className=\"text-[10px] font-bold uppercase tracking-widest text-[#6F7C7A]\">Live Ticket</div>\n            <h1 className=\"text-2xl font-bold tracking-tight text-[#17201F]\">Your live queue</h1>\n            <p className=\"mt-0.5 text-xs text-[#6F7C7A]\">{business.name} · {entry.service}</p>\n          </div>\n\n          {cancelled || noShow ? (\n            <div className=\"rounded-2xl border border-[#E1E7E6] bg-white p-6 text-center\">\n              <div className=\"mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#0F766E]/10 text-[#0F766E]\">\n                <CheckCircle2 className=\"h-7 w-7\" />\n              </div>\n              <h2 className=\"mt-3 text-lg font-extrabold text-[#17201F]\">\n                {cancelledByStaff ? 'The salon cancelled your booking' : cancelledByCustomer ? 'Booking cancelled' : 'You missed your turn'}\n              </h2>\n              <button type=\"button\" onClick={rejoin} className=\"mt-5 rounded-xl bg-[#0F766E] px-5 py-2.5 text-xs font-bold text-white\">\n                Book another service\n              </button>\n            </div>\n          ) : (\n            <LiveTicket\n              salonName={business.name}\n              token={entry.token || entry.id.slice(-4).toUpperCase()}\n              position={ticketPosition}\n              waitLabel={entry.status === 'Called' ? 'Ready now' : entry.status === 'Serving' ? 'In progress' : estimatedWait}\n              stage={journeyStage}\n              acknowledgeEnabled={entry.status === 'Called'}\n              acknowledgeBusy={busy}\n              onAcknowledge={acknowledgeTurn}\n              onCancel={() => setCancelOpen(true)}\n              peopleAround={ticketPeopleAround}\n              joinedAtTimeLabel={joinedAtTimeLabel}\n              calledAtTimeLabel={calledAtTimeLabel}\n              callTimerRemainingLabel={entry.status === 'Called' ? countdown : undefined}\n              isCalledState={entry.status === 'Called'}\n              isUpcomingState={entry.status === 'Waiting' && (peopleAhead <= 1 || estimatedMinutes <= 10)}\n              isServingState={entry.status === 'Serving'}\n              isAcknowledged={acknowledged}\n              callExpired={arrivalExpired}\n              upcomingPeopleAhead={peopleAhead}\n              upcomingApproxTimeLabel={estimatedWait}\n              totalPriceInr={entry.totalPriceInr || 250}\n              discountInr={entry.discountInr || 0}\n              servicesList={entry.services || [entry.service]}\n              paymentStatus={entry.paymentStatus || 'unpaid'}\n              paymentMethod={entry.paymentMethod}\n              onPayOnline={() => {\n                void realtimeQueueService.command(business.id, {\n                  type: 'queue_action',\n                  itemId: entry.id,\n                  action: 'Pay-online',\n                });\n              }}\n              onPayCash={() => {\n                void realtimeQueueService.command(business.id, {\n                  type: 'queue_action',\n                  itemId: entry.id,\n                  action: 'Pay-cash',\n                });\n              }}\n            />\n          )}\n\n          {!cancelled && !noShow && (\n            <div id=\"qr-live-alert-card\" className=\"space-y-2.5 rounded-2xl border border-[#E1E7E6] bg-white p-4\">\n              <div className=\"flex items-center justify-between gap-3\">\n                <div className=\"flex items-center gap-2\">\n                  <BellRing className=\"h-4 w-4 text-[#0F766E]\" />\n                  <span className=\"text-xs font-bold text-[#17201F]\">Live Queue Alerts</span>\n                </div>\n                <span className=\"rounded-full bg-[#E7F5F2] px-2 py-0.5 text-[10px] font-bold uppercase text-[#0F766E]\">\n                  {notifyState === 'granted' ? 'Alerts Enabled' : 'Live Updates Active'}\n                </span>\n              </div>\n              <p className=\"text-[11px] leading-relaxed text-[#6F7C7A]\">\n                Keep this page available for real-time queue changes. We will alert you when your turn is called.\n              </p>\n              {notifyState === 'default' && (\n                <button\n                  type=\"button\"\n                  onClick={() => void requestTurnNotifications().then(setNotifyState)}\n                  className=\"w-full rounded-xl bg-[#0F766E] px-3 py-2 text-[11px] font-bold text-white\"\n                >\n                  Enable Browser Alerts\n                </button>\n              )}\n            </div>\n          )}\n\n          <div className=\"grid grid-cols-2 gap-2.5\">\n            <a\n              href={\`https://maps.google.com/?q=\${encodeURIComponent(business.name + ' ' + business.address)}\`}\n              target=\"_blank\"\n              rel=\"noreferrer\"\n              className=\"rounded-2xl border border-[#E1E7E6] bg-white p-3 text-center text-xs font-semibold text-[#17201F]\"\n            >\n              Get Directions\n            </a>\n            <a\n              href={business.phoneNumber ? \`tel:\${business.phoneNumber}\` : undefined}\n              className=\"rounded-2xl border border-[#E1E7E6] bg-white p-3 text-center text-xs font-semibold text-[#17201F]\"\n            >\n              Call Salon\n            </a>\n          </div>\n\n          {error && <p role=\"alert\" className=\"rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700\">{error}</p>}\n        </main>\n      )}\n\n`,
  'QR queued screen LiveTicket parity',
));

console.log(JSON.stringify({ changed }, null, 2));
