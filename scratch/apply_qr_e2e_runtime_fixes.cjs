const fs = require('node:fs');

function replaceOnce(path, before, after, label) {
  let text = fs.readFileSync(path, 'utf8');
  if (text.includes(after)) return false;
  // The TEST staff guard has evolved from its original one-line form into the
  // stricter Render-host-aware form. If any explicit test-deployment guard is
  // already present, the source is past this bootstrap patch and must not fail
  // just because the old anchor disappeared.
  if (label === 'test staff seed guard' && text.includes('const isExplicitTestDeployment')) return false;
  if (!text.includes(before)) throw new Error(`Patch anchor not found: ${label}`);
  text = text.replace(before, after);
  fs.writeFileSync(path, text);
  return true;
}

function ensureContains(path, needle, insertionAnchor, insertion, label) {
  let text = fs.readFileSync(path, 'utf8');
  if (text.includes(needle)) return false;
  if (!text.includes(insertionAnchor)) throw new Error(`Patch anchor not found: ${label}`);
  text = text.replace(insertionAnchor, `${insertionAnchor}${insertion}`);
  fs.writeFileSync(path, text);
  return true;
}

const changed = [];
const mark = (path, didChange) => { if (didChange && !changed.includes(path)) changed.push(path); };

// 1) Hosted TEST runs NODE_ENV=production for production-like behavior. Allow
// only the explicitly isolated test deployment to seed real test staff accounts,
// so /api/staff/login can be exercised without weakening production.
mark('server/index.ts', replaceOnce(
  'server/index.ts',
  "if (process.env.NODE_ENV !== 'production') {\n  const demoStaffAccounts = [",
  "const isExplicitTestDeployment = process.env.NO_WAIT_TEST_DEPLOYMENT === 'true' || dataDir.includes('no-wait-salon-test-data');\nif (process.env.NODE_ENV !== 'production' || isExplicitTestDeployment) {\n  const demoStaffAccounts = [",
  'test staff seed guard',
));

// Existing manually-created Render TEST services do not necessarily inherit
// later Blueprint env additions. Render exposes its own hostname/service-name
// automatically, so recognize ONLY the known isolated TEST service as a test
// deployment. The production hostname never satisfies these exact checks.
mark('server/index.ts', replaceOnce(
  'server/index.ts',
  "const isExplicitTestDeployment = process.env.NO_WAIT_TEST_DEPLOYMENT === 'true' || dataDir.includes('no-wait-salon-test-data');",
  "const renderExternalHostname = String(process.env.RENDER_EXTERNAL_HOSTNAME || '').trim().toLowerCase();\nconst renderServiceName = String(process.env.RENDER_SERVICE_NAME || '').trim().toLowerCase();\nconst isExplicitTestDeployment = process.env.NO_WAIT_TEST_DEPLOYMENT === 'true'\n  || dataDir.includes('no-wait-salon-test-data')\n  || renderExternalHostname === 'no-wait-salon-web-test.onrender.com'\n  || renderServiceName === 'no-wait-salon-web-test';",
  'hosted Render TEST detection',
));

// 2) Rating used to fail after Complete because completed entries are no longer
// in state.queue. Handle Submit-rating before the generic active-queue lookup.
mark('server/index.ts', replaceOnce(
  'server/index.ts',
  "  const itemIndex = state.queue.findIndex((item) => item.id === command.itemId);\n  if (itemIndex < 0) throw new Error('Queue entry no longer exists. Refreshing the latest queue.');\n  const item = state.queue[itemIndex];",
  "  if (command.type === 'queue_action' && command.action === 'Submit-rating') {\n    const queueIdx = state.queue.findIndex((item) => item.id === command.itemId);\n    const completedIdx = state.completedList.findIndex((item) => item.id === command.itemId);\n    const target = queueIdx >= 0 ? state.queue[queueIdx] : completedIdx >= 0 ? state.completedList[completedIdx] : undefined;\n    if (!target) throw new Error('Booking no longer exists. Refreshing the latest history.');\n    const rating = Math.max(1, Math.min(5, Math.round(Number(command.rating) || 5)));\n    const updated = {\n      ...target,\n      rating,\n      feedbackTags: Array.isArray(command.feedbackTags) ? command.feedbackTags.slice(0, 12) : [],\n      feedbackComment: cleanText(command.feedbackComment, 300),\n    };\n    if (queueIdx >= 0) state.queue[queueIdx] = updated;\n    if (completedIdx >= 0) state.completedList[completedIdx] = updated;\n    return state;\n  }\n\n  const itemIndex = state.queue.findIndex((item) => item.id === command.itemId);\n  if (itemIndex < 0) throw new Error('Queue entry no longer exists. Refreshing the latest queue.');\n  const item = state.queue[itemIndex];",
  'completed rating handling',
));

// 3) Public QR final state must use the same ThankYouScreen as the Customer App.
mark('src/components/PublicSalonPage.tsx', replaceOnce(
  'src/components/PublicSalonPage.tsx',
  "import { SalonDetailPage } from './SalonDetailPage';",
  "import { SalonDetailPage } from './SalonDetailPage';\nimport { ThankYouScreen } from './ThankYouScreen';",
  'ThankYouScreen import',
));

mark('src/components/PublicSalonPage.tsx', replaceOnce(
  'src/components/PublicSalonPage.tsx',
  "  const acknowledgeTurn = () => {\n    setShowTurnPopup(false);\n    if (business && entry) void businessQrService.acknowledgeCall(business.id, entry.id);\n  };",
  "  const acknowledgeTurn = () => {\n    setShowTurnPopup(false);\n    if (business && entry) void businessQrService.acknowledgeCall(business.id, entry.id);\n  };\n\n  const submitRating = async (rating: number, tags: string[], comment: string) => {\n    if (!business || !entry) return;\n    setError('');\n    try {\n      const snapshot = await businessQrService.submitRating(business.id, entry.id, rating, tags, comment);\n      if (snapshot?.completedList) {\n        setCompletedList(snapshot.completedList);\n        const updated = snapshot.completedList.find((item: QueueItem) => item.id === entry.id);\n        if (updated) setEntry(updated);\n      }\n    } catch (reason) {\n      setError(reason instanceof Error ? reason.message : 'Could not save your feedback.');\n    }\n  };",
  'QR rating handler',
));

mark('src/components/PublicSalonPage.tsx', replaceOnce(
  'src/components/PublicSalonPage.tsx',
  "      <TopBar onOpenApp={openApp} />\n\n      {/* ---------------- STEP 1: SALON DETAIL VIEW (100% Shared Component) ---------------- */}",
  "      <TopBar onOpenApp={openApp} />\n\n      {isQueued && entry && completed && (\n        <main id=\"qr-complete-screen\" className=\"mx-auto max-w-md pb-12\">\n          <ThankYouScreen\n            item={entry}\n            salonName={business.name}\n            onBackToHome={rejoin}\n            onSubmitRating={(rating, tags, comment) => void submitRating(rating, tags, comment)}\n          />\n          {error && (\n            <p role=\"alert\" className=\"mx-4 mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700\">{error}</p>\n          )}\n        </main>\n      )}\n\n      {/* ---------------- STEP 1: SALON DETAIL VIEW (100% Shared Component) ---------------- */}",
  'QR Thank You final state',
));

mark('src/components/PublicSalonPage.tsx', replaceOnce(
  'src/components/PublicSalonPage.tsx',
  "      {isQueued && entry && (\n        <main className=\"mx-auto max-w-md px-4 pb-12 pt-4\">",
  "      {isQueued && entry && !completed && (\n        <main className=\"mx-auto max-w-md px-4 pb-12 pt-4\">",
  'hide legacy live ticket after completion',
));

// 4) Shared customer-authenticated feedback request for both browser and app state.
mark('src/services/businessQrService.ts', replaceOnce(
  'src/services/businessQrService.ts',
  "  leaveQueue:(salonId:string,sessionId:string,reasonCode='other',reasonText='')=>request<any>(`/api/salons/${encodeURIComponent(salonId)}/commands`,{method:'POST',body:JSON.stringify({type:'cancel_customer',sessionId,reasonCode,reasonText})}),\n  setMarketingConsent:",
  "  leaveQueue:(salonId:string,sessionId:string,reasonCode='other',reasonText='')=>request<any>(`/api/salons/${encodeURIComponent(salonId)}/commands`,{method:'POST',body:JSON.stringify({type:'cancel_customer',sessionId,reasonCode,reasonText})}),\n  submitRating:(salonId:string,itemId:string,rating:number,feedbackTags:string[],feedbackComment:string)=>request<any>(`/api/salons/${encodeURIComponent(salonId)}/commands`,{method:'POST',body:JSON.stringify({type:'queue_action',action:'Submit-rating',itemId,rating,feedbackTags,feedbackComment})}),\n  setMarketingConsent:",
  'QR feedback service',
));

// 5) Make the Render test Blueprint self-describing. The server also recognizes
// its unique test DATA_DIR so an already-created service remains testable even
// before Blueprint env sync catches up.
mark('render-test.yaml', ensureContains(
  'render-test.yaml',
  'NO_WAIT_TEST_DEPLOYMENT',
  "      - key: NODE_ENV\n        value: production\n",
  "      - key: NO_WAIT_TEST_DEPLOYMENT\n        value: \"true\"\n",
  'Render test deployment flag',
));

console.log(JSON.stringify({ changed }, null, 2));