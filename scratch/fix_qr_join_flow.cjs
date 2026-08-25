const fs = require('node:fs');

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

function patchOnce(path, before, after, label) {
  let text = fs.readFileSync(path, 'utf8');
  if (text.includes(after)) return false;
  if (!text.includes(before)) throw new Error(`Patch anchor not found: ${label}`);
  text = text.replace(before, after);
  fs.writeFileSync(path, text);
  return true;
}

const changed = [];
const mark = (path, didChange) => { if (didChange && !changed.includes(path)) changed.push(path); };

// Fix the current TEST TypeScript typo in the non-production test-session fallback.
mark('server/index.ts', patchOnce(
  'server/index.ts',
  "        name: account.name || `${account.businessName} Staff`,",
  "        name: account.name || `${account.business_name} Staff`,",
  'staff fallback business_name typo',
));

// PublicSalonPage had drifted to an obsolete QueueJoinSheet prop contract
// (isOpen/salonName/selectedServices). The shared sheet actually expects
// open/salon/services/queue, so it never mounted on the QR web page.
mark('src/components/PublicSalonPage.tsx', patchSection(
  'src/components/PublicSalonPage.tsx',
  "      {/* QUEUE JOIN SHEET */}\n",
  "      {/* CANCEL SHEET */}",
  `      {/* QUEUE JOIN SHEET */}\n      {joinSheetOpen && business && (\n        <QueueJoinSheet\n          open={joinSheetOpen}\n          salon={business}\n          services={(business.services || []).filter((service) => selectedServiceIds.includes(service.id))}\n          barbers={barbers}\n          queue={queue}\n          busy={busy}\n          error={error}\n          customerName={customerProfile?.name || undefined}\n          offers={business.offers || []}\n          appliedOfferId={appliedOfferId}\n          onApplyOffer={(id) => setAppliedOfferId(id)}\n          onRemoveOffer={() => setAppliedOfferId(null)}\n          onClose={() => setJoinSheetOpen(false)}\n          onConfirm={(preferredId) => void confirmJoin(preferredId)}\n        />\n      )}\n\n`,
  'QR QueueJoinSheet prop contract',
));

// Never transition the QR page into a blank queued state. Use real service IDs,
// require an explicit service selection at token confirmation, and only switch
// to the live ticket after an authoritative entry is present.
mark('src/components/PublicSalonPage.tsx', patchSection(
  'src/components/PublicSalonPage.tsx',
  "  const confirmJoin = useCallback(\n",
  "  const requestOtp = async () => {",
  `  const confirmJoin = useCallback(\n    async (preferredBarberId: string) => {\n      if (!business) return;\n      setBusy(true);\n      setError('');\n      try {\n        if (selectedServiceIds.length === 0) {\n          throw new Error('Please choose at least one service before getting a token.');\n        }\n        const result = await businessQrService.join(\n          token,\n          selectedServiceIds,\n          sessionId.current,\n          'qr_web',\n          preferredBarberId || undefined,\n        );\n        const joined = (\n          result.entry ||\n          result.state?.queue?.find(\n            (item: QueueItem) => item.sessionId === sessionId.current || (auth && item.customerId === auth.customerId),\n          )\n        ) as QueueItem | undefined;\n        if (!joined) {\n          throw new Error('Your token was created but the live ticket could not be loaded. Please refresh this page.');\n        }\n        setEntry(joined);\n        lastStatus.current = joined.status || null;\n        if (result.state?.queue) setQueue(result.state.queue);\n        if (result.state?.completedList) setCompletedList(result.state.completedList);\n        if (consent) void businessQrService.setMarketingConsent(true);\n        void businessQrService.recordVisit(token, { appCtaShown: true });\n        setJoinSheetOpen(false);\n        setStep('queued');\n      } catch (reason) {\n        setError(reason instanceof Error ? reason.message : 'Unable to join this queue right now.');\n      } finally {\n        setBusy(false);\n      }\n    },\n    [auth, business, consent, selectedServiceIds, token],\n  );\n\n`,
  'QR join confirmation and live-ticket transition',
));

console.log(JSON.stringify({ changed }, null, 2));
