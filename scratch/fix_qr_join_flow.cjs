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

// QR onboarding must obey the same required-profile contract as the Customer
// app. Previously the QR page only checked/saved the name while the shared
// readiness rule requires both name + gender, leaving physical users stuck in
// the OTP/profile -> Get Token handoff.
mark('src/components/PublicSalonPage.tsx', patchOnce(
  'src/components/PublicSalonPage.tsx',
  "import { resolveAppReadiness } from '../shared/profileReadiness';",
  "import { missingProfileFields, resolveAppReadiness } from '../shared/profileReadiness';",
  'shared profile readiness import',
));

mark('src/components/PublicSalonPage.tsx', patchOnce(
  'src/components/PublicSalonPage.tsx',
  "  const [email, setEmail] = useState('');\n  const [consent, setConsent] = useState(false);",
  "  const [email, setEmail] = useState('');\n  const [gender, setGender] = useState('');\n  const [consent, setConsent] = useState(false);",
  'QR gender state',
));

mark('src/components/PublicSalonPage.tsx', patchSection(
  'src/components/PublicSalonPage.tsx',
  "  const requestOtp = async () => {",
  "  const verifyOtp = async () => {",
  `  const requestOtp = async () => {\n    const cleanedPhone = phone.replace(/\\D/g, '').slice(-10);\n    if (cleanedPhone.length !== 10) {\n      setError('Please enter a valid 10-digit mobile number.');\n      return;\n    }\n    setPhone(cleanedPhone);\n    setBusy(true);\n    setError('');\n    try {\n      const result = await realtimeQueueService.requestOtp(cleanedPhone);\n      setChallengeId(result.challengeId);\n      setDemoCode(result.demoCode || '');\n      setStep('otp');\n    } catch (reason) {\n      setError(reason instanceof Error ? reason.message : 'Could not send the code. Please try again.');\n    } finally {\n      setBusy(false);\n    }\n  };\n\n`,
  'QR phone normalization',
));

mark('src/components/PublicSalonPage.tsx', patchSection(
  'src/components/PublicSalonPage.tsx',
  "  const verifyOtp = async () => {",
  "  const saveProfileAndJoin = async () => {",
  `  const verifyOtp = async () => {\n    setBusy(true);\n    setError('');\n    try {\n      const verified = await realtimeQueueService.verifyOtp(challengeId, code.trim());\n      const session: CustomerAuthSession = {\n        token: verified.token,\n        customerId: verified.customerId,\n        phoneNumber: verified.phone,\n      };\n      persistAuth(session);\n      const profile = await customerAccountService.getProfile().catch(() => null);\n      setCustomerProfile(profile);\n      if (profile && missingProfileFields(profile).length === 0) {\n        setStep('salon');\n        setJoinSheetOpen(true);\n        return;\n      }\n      if (profile?.name) setName(profile.name);\n      if (profile?.email) setEmail(profile.email);\n      if (profile?.gender) setGender(profile.gender);\n      setStep('profile');\n    } catch (reason) {\n      setError(reason instanceof Error ? reason.message : 'That code did not match. Please try again.');\n    } finally {\n      setBusy(false);\n    }\n  };\n\n`,
  'QR OTP to profile/token handoff',
));

mark('src/components/PublicSalonPage.tsx', patchSection(
  'src/components/PublicSalonPage.tsx',
  "  const saveProfileAndJoin = async () => {",
  "  const handleJoinClick = useCallback(() => {",
  `  const saveProfileAndJoin = async () => {\n    if (name.trim().length < 2) return setError('Please enter your name.');\n    if (!gender) return setError('Please select your gender.');\n    setBusy(true);\n    setError('');\n    try {\n      const updated = await customerAccountService.updateProfile({\n        name: name.trim(),\n        email: email.trim(),\n        dateOfBirth: '',\n        gender,\n        anniversary: '',\n        city: '',\n      });\n      setCustomerProfile(updated);\n      setStep('salon');\n      setJoinSheetOpen(true);\n    } catch (reason) {\n      setError(reason instanceof Error ? reason.message : 'Could not save your details.');\n    } finally {\n      setBusy(false);\n    }\n  };\n\n`,
  'QR profile save and queue-sheet transition',
));

mark('src/components/PublicSalonPage.tsx', patchOnce(
  'src/components/PublicSalonPage.tsx',
  "    const readiness = resolveAppReadiness(auth, customerProfile, profileLoading);",
  "    const readiness = resolveAppReadiness(auth, customerProfile, { profileLoading });",
  'QR readiness loading options',
));

mark('src/components/PublicSalonPage.tsx', patchOnce(
  'src/components/PublicSalonPage.tsx',
  "            <h1 className=\"mt-1 text-[20px] font-extrabold\">What is your name?</h1>\n            <p className=\"mt-1 text-xs text-[#667371]\">Staff will use this name when calling your turn.</p>",
  "            <h1 className=\"mt-1 text-[20px] font-extrabold\">A couple of quick details</h1>\n            <p className=\"mt-1 text-xs text-[#667371]\">Name and gender are required so staff can identify your booking. Email stays optional.</p>",
  'QR profile copy',
));

mark('src/components/PublicSalonPage.tsx', patchOnce(
  'src/components/PublicSalonPage.tsx',
  "              <label className=\"grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#536966]\">\n                Email (Optional)",
  "              <label className=\"grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#536966]\">\n                Gender\n                <select\n                  id=\"qr-profile-gender\"\n                  value={gender}\n                  onChange={(e) => { setGender(e.target.value); setError(''); }}\n                  className=\"h-12 rounded-2xl border border-[#DDE7E5] bg-white px-4 text-base font-semibold outline-none focus:border-[#0F766E]\"\n                >\n                  <option value=\"\" disabled>Select gender</option>\n                  <option value=\"Woman\">Woman</option>\n                  <option value=\"Man\">Man</option>\n                  <option value=\"Non-binary\">Non-binary</option>\n                  <option value=\"Prefer not to say\">Prefer not to say</option>\n                </select>\n              </label>\n              <label className=\"grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#536966]\">\n                Email (Optional)",
  'QR gender field',
));

mark('src/components/PublicSalonPage.tsx', patchOnce(
  'src/components/PublicSalonPage.tsx',
  "                disabled={busy || name.trim().length < 2}\n                onClick={() => void saveProfileAndJoin()}",
  "                disabled={busy || name.trim().length < 2 || !gender}\n                onClick={() => void saveProfileAndJoin()}",
  'QR profile continue gating',
));

// Some QR scans open in embedded camera/Lens browsers where crypto.randomUUID
// is unavailable even on HTTPS. The join must still produce a request id rather
// than throwing before the API call, otherwise the user appears stuck after
// OTP/profile when pressing Get Token.
mark('src/services/businessQrService.ts', patchOnce(
  'src/services/businessQrService.ts',
  "  join:(token:string,serviceIds:string|string[],sessionId:string,source:'qr_walk_in'|'qr_web'='qr_walk_in',preferredBarberId?:string)=>request<{joined:boolean;reason?:'already_in_queue';entry:any;state:any}>(`/api/business-qr/${encodeURIComponent(token)}/join`,{method:'POST',body:JSON.stringify({serviceIds:Array.isArray(serviceIds)?serviceIds:[serviceIds],sessionId,source,preferredBarberId:preferredBarberId||undefined,requestId:crypto.randomUUID()})}),",
  "  join:(token:string,serviceIds:string|string[],sessionId:string,source:'qr_walk_in'|'qr_web'='qr_walk_in',preferredBarberId?:string)=>{const requestId=globalThis.crypto?.randomUUID?.()||`qr-${Date.now()}-${Math.random().toString(36).slice(2)}`;return request<{joined:boolean;reason?:'already_in_queue';entry:any;state:any}>(`/api/business-qr/${encodeURIComponent(token)}/join`,{method:'POST',body:JSON.stringify({serviceIds:Array.isArray(serviceIds)?serviceIds:[serviceIds],sessionId,source,preferredBarberId:preferredBarberId||undefined,requestId})});},",
  'embedded-browser request id fallback',
));

console.log(JSON.stringify({ changed }, null, 2));