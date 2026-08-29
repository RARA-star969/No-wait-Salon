import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus, Trash2, Star, ChevronUp, ChevronDown, Eye, EyeOff, Loader2, AlertTriangle, Instagram, Facebook, Youtube, Twitter, Globe, ImagePlus, X } from 'lucide-react';
import type { GymAmenity, GymQuickAction, GymSocialLinkInput, Salon, SocialPlatform } from '../types';
import { fetchSalonProfile } from '../services/salonDiscoveryService';
import { gymProfileCmsService, type GalleryMediaRow } from '../services/gymProfileCmsService';
import { GYM_ICON_LIBRARY, gymProfileIcon } from './gymProfileIcons';
import { defaultQuickActions } from '../shared/gymProfileCms';
import { resizeImageFileToSquareDataUrl } from '../shared/imageResize';

const SECTIONS = ['Basic Info', 'Gallery', 'Amenities', 'Quick Actions', 'Social & Links'] as const;
type Section = (typeof SECTIONS)[number];

const SOCIAL_PLATFORM_ICON: Record<SocialPlatform, React.FC<{ className?: string }>> = {
  instagram: Instagram, facebook: Facebook, youtube: Youtube, twitter: Twitter, website: Globe,
};
const SOCIAL_PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', twitter: 'X / Twitter', website: 'Website',
};
const SOCIAL_PLATFORM_PLACEHOLDER: Record<SocialPlatform, string> = {
  instagram: '@ironhousegym or full URL', facebook: '@ironhousegym or full URL', youtube: '@ironhousegym or full URL',
  twitter: '@ironhousegym or full URL', website: '',
};

const BASIC_INFO_FIELDS = [
  'name', 'shortDescription', 'description', 'phoneNumber', 'email', 'websiteUrl', 'address', 'area', 'city', 'openingHours',
] as const;

const FIELD_LABELS: Record<(typeof BASIC_INFO_FIELDS)[number], string> = {
  name: 'Public Gym name', shortDescription: 'Short description', description: 'Full description',
  phoneNumber: 'Phone', email: 'Email', websiteUrl: 'Website', address: 'Address', area: 'Area',
  city: 'City', openingHours: 'Opening hours',
};

const QUICK_ACTION_TYPE_LABEL: Record<string, string> = {
  schedule: 'Schedule', directions: 'Directions', branches: 'Branches', been_here: 'Been here',
};

export const GymManageProfile: React.FC<{ gymId: string; gymName: string; onClose: () => void }> = ({ gymId, gymName, onClose }) => {
  const [section, setSection] = useState<Section>('Basic Info');
  const [loading, setLoading] = useState(true);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [hold, setHold] = useState(false);
  const [pendingFields, setPendingFields] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const [form, setForm] = useState({
    name: '', shortDescription: '', description: '', phoneNumber: '', email: '', websiteUrl: '',
    address: '', area: '', city: '', openingHours: '',
  });
  const [logoUrl, setLogoUrl] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState<GalleryMediaRow[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [amenities, setAmenities] = useState<GymAmenity[]>([]);
  const [newAmenityName, setNewAmenityName] = useState('');
  const [quickActions, setQuickActions] = useState<GymQuickAction[]>([]);
  const [socialLinks, setSocialLinks] = useState<GymSocialLinkInput[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [profile, galleryRes, moderation, socialLinksRes] = await Promise.all([
        fetchSalonProfile(gymId),
        gymProfileCmsService.gallery.list(),
        gymProfileCmsService.moderationStatus(),
        gymProfileCmsService.socialLinks.list(),
      ]);
      if (profile) {
        setSalon(profile);
        setLogoUrl(profile.logoImageUrl || '');
        setForm({
          name: profile.name || '', shortDescription: profile.shortDescription || '', description: profile.description || '',
          phoneNumber: profile.phoneNumber || '', email: profile.email || '', websiteUrl: profile.websiteUrl || '',
          address: profile.address || '', area: profile.area || '', city: profile.city || '', openingHours: profile.openingHours || '',
        });
        setAmenities(profile.amenityDetails || []);
        setQuickActions(profile.quickActions && profile.quickActions.length ? profile.quickActions : defaultQuickActions());
      }
      setGallery(galleryRes.gallery);
      setHold(moderation.hold);
      setPendingFields(moderation.pendingFields);
      setSocialLinks(socialLinksRes.socialLinks);
    } catch {
      setNotice('Could not load your profile. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [gymId]);

  const flash = (message: string) => { setNotice(message); setTimeout(() => setNotice(''), 3000); };

  const saveBasicInfo = async () => {
    setSaving(true);
    try {
      const result = await gymProfileCmsService.saveProfile({
        name: form.name, short_description: form.shortDescription, description: form.description,
        phone_number: form.phoneNumber, email: form.email, website_url: form.websiteUrl,
        address: form.address, area: form.area, city: form.city, opening_hours: form.openingHours,
      });
      flash(result.pending ? 'Saved — pending Admin review.' : 'Profile saved.');
      await load();
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const onPickLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type)) {
      flash('Please choose a PNG, JPEG, or WebP image.');
      return;
    }
    setLogoBusy(true);
    try {
      const dataUrl = await resizeImageFileToSquareDataUrl(file);
      setLogoUrl(dataUrl);
      const result = await gymProfileCmsService.saveLogo(dataUrl);
      setLogoUrl(result.logoImageUrl);
      flash(result.pending ? 'Logo saved — pending Admin review.' : 'Logo saved.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not save the logo.');
      await load();
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    try {
      const result = await gymProfileCmsService.saveLogo('');
      setLogoUrl(result.logoImageUrl);
      flash(result.pending ? 'Logo removed — pending Admin review.' : 'Logo removed.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not remove the logo.');
      await load();
    } finally {
      setLogoBusy(false);
    }
  };

  const addGalleryImage = async () => {
    const url = newImageUrl.trim();
    if (!url) return;
    setSaving(true);
    try {
      await gymProfileCmsService.gallery.add(url);
      setNewImageUrl('');
      await load();
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not add image.');
    } finally {
      setSaving(false);
    }
  };

  const removeGalleryImage = async (mediaId: string) => {
    setSaving(true);
    try { await gymProfileCmsService.gallery.remove(mediaId); await load(); }
    catch (error) { flash(error instanceof Error ? error.message : 'Could not remove image.'); }
    finally { setSaving(false); }
  };

  const setFeaturedImage = async (mediaId: string) => {
    setSaving(true);
    try { await gymProfileCmsService.gallery.setFeatured(mediaId); await load(); }
    catch (error) { flash(error instanceof Error ? error.message : 'Could not set featured image.'); }
    finally { setSaving(false); }
  };

  const moveGalleryImage = async (index: number, direction: -1 | 1) => {
    const next = [...gallery];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setGallery(next);
    setSaving(true);
    try { await gymProfileCmsService.gallery.reorder(next.map((m) => m.id)); }
    catch (error) { flash(error instanceof Error ? error.message : 'Could not reorder gallery.'); await load(); }
    finally { setSaving(false); }
  };

  const saveAmenities = async (next: GymAmenity[]) => {
    setAmenities(next);
    setSaving(true);
    try {
      const result = await gymProfileCmsService.saveAmenities(next);
      setAmenities(result.amenities);
      flash(result.pending ? 'Saved — pending Admin review.' : 'Amenities saved.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not save amenities.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const addAmenity = () => {
    const name = newAmenityName.trim();
    if (!name) return;
    setNewAmenityName('');
    void saveAmenities([...amenities, { id: `amenity-${Date.now()}`, name, iconKey: 'Check', active: true, order: amenities.length }]);
  };

  const saveQuickActions = async (next: GymQuickAction[]) => {
    setQuickActions(next);
    setSaving(true);
    try {
      const result = await gymProfileCmsService.saveQuickActions(next);
      setQuickActions(result.quickActions);
      flash(result.pending ? 'Saved — pending Admin review.' : 'Quick Actions saved.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not save Quick Actions.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const saveSocialLinks = async (next: GymSocialLinkInput[]) => {
    setSocialLinks(next);
    setSaving(true);
    try {
      const result = await gymProfileCmsService.socialLinks.save(next);
      flash(result.pending ? 'Saved — pending Admin review.' : 'Social & Links saved.');
      await load();
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not save Social & Links.');
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl bg-[#F4F7F6]">
      <header className="flex items-center gap-3 border-b border-[#E1E7E6] bg-white px-4 py-3">
        <button onClick={onClose} aria-label="Close Manage Profile" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F5F4] text-[#17201F]">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-[#17201F]">Manage Profile</h1>
          <p className="truncate text-[11px] text-[#5C6E6B]">Control how {gymName} appears to customers</p>
        </div>
        {saving && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0F766E]" />}
      </header>

      {hold && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-semibold text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Admin has this profile on hold — your edits are saved as pending and won't go live until approved.
          {pendingFields.length > 0 && <span className="text-amber-600">({pendingFields.length} field{pendingFields.length === 1 ? '' : 's'} pending)</span>}
        </div>
      )}

      {notice && (
        <div className="border-b border-[#DDE5E3] bg-white px-4 py-2 text-[11px] font-semibold text-[#0F766E]">{notice}</div>
      )}

      <nav className="flex gap-1 overflow-x-auto border-b border-[#E1E7E6] bg-white px-3 py-2">
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${section === s ? 'bg-[#0F766E] text-white' : 'bg-[#F0F5F4] text-[#5C6E6B]'}`}
          >
            {s}
          </button>
        ))}
      </nav>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-[#5C6E6B]"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            {section === 'Basic Info' && (
              <div className="space-y-3">
                <div>
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#5C6E6B]">Business logo</span>
                  <div className="flex items-center gap-3 rounded-xl border border-[#DDE5E3] bg-white p-3">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E1E7E6] bg-[#F4F7F6]">
                      {logoUrl ? <img src={logoUrl} alt="Business logo preview" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6 text-[#8A9997]" />}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <p className="text-[11px] leading-4 text-[#8A9997]">Shown on your public profile header and the Home listing card. PNG, JPEG or WebP.</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          disabled={logoBusy}
                          className="flex items-center gap-1.5 rounded-lg bg-[#0F766E] px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-60"
                        >
                          {logoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                          {logoUrl ? 'Replace' : 'Upload'}
                        </button>
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={removeLogo}
                            disabled={logoBusy}
                            className="flex items-center gap-1.5 rounded-lg border border-[#E1B4AC] px-3 py-1.5 text-[11px] font-bold text-[#B4463A] disabled:opacity-60"
                          >
                            <X className="h-3.5 w-3.5" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <input ref={logoFileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickLogo} />
                  </div>
                </div>
                {BASIC_INFO_FIELDS.map((key) => (
                  <label key={key} className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#5C6E6B]">{FIELD_LABELS[key]}</span>
                    {key === 'description' ? (
                      <textarea
                        value={form[key]}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        rows={4}
                        className="w-full rounded-xl border border-[#DDE5E3] bg-white px-3 py-2 text-sm text-[#17201F]"
                      />
                    ) : (
                      <input
                        value={form[key]}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full rounded-xl border border-[#DDE5E3] bg-white px-3 py-2 text-sm text-[#17201F]"
                      />
                    )}
                  </label>
                ))}
                <button
                  onClick={saveBasicInfo}
                  disabled={saving}
                  className="mt-2 w-full rounded-xl bg-[#0F766E] py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  Save changes
                </button>
                <p className="pt-2 text-[11px] leading-4 text-[#8A9997]">
                  Business ID, category, account security, activation and QR authority stay with Admin — they're never editable here.
                </p>
              </div>
            )}

            {section === 'Gallery' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="Paste an image URL"
                    className="flex-1 rounded-xl border border-[#DDE5E3] bg-white px-3 py-2 text-sm text-[#17201F]"
                  />
                  <button onClick={addGalleryImage} disabled={saving} className="flex items-center gap-1 rounded-xl bg-[#0F766E] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                {gallery.length === 0 && <p className="text-xs text-[#8A9997]">No gallery images yet — add one above.</p>}
                <div className="space-y-2">
                  {gallery.map((media, index) => (
                    <div key={media.id} className="flex items-center gap-3 rounded-xl border border-[#DDE5E3] bg-white p-2">
                      <img src={media.url} alt={media.caption || ''} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-[#17201F]">{media.caption || 'Untitled'}</p>
                        {Number(media.featured) === 1 && <span className="text-[10px] font-bold uppercase text-amber-600">Featured</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button onClick={() => moveGalleryImage(index, -1)} disabled={index === 0} aria-label="Move up" className="rounded-full p-1 text-[#5C6E6B] disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                        <button onClick={() => moveGalleryImage(index, 1)} disabled={index === gallery.length - 1} aria-label="Move down" className="rounded-full p-1 text-[#5C6E6B] disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                        <button onClick={() => setFeaturedImage(media.id)} aria-label="Set featured" className={`rounded-full p-1 ${Number(media.featured) === 1 ? 'text-amber-500' : 'text-[#5C6E6B]'}`}>
                          <Star className={`h-4 w-4 ${Number(media.featured) === 1 ? 'fill-current' : ''}`} />
                        </button>
                        <button onClick={() => removeGalleryImage(media.id)} aria-label="Delete image" className="rounded-full p-1 text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {section === 'Amenities' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={newAmenityName}
                    onChange={(e) => setNewAmenityName(e.target.value)}
                    placeholder="e.g. Cardio Deck"
                    className="flex-1 rounded-xl border border-[#DDE5E3] bg-white px-3 py-2 text-sm text-[#17201F]"
                  />
                  <button onClick={addAmenity} disabled={saving} className="flex items-center gap-1 rounded-xl bg-[#0F766E] px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
                <div className="space-y-2">
                  {amenities.map((amenity, index) => {
                    const Icon = gymProfileIcon(amenity.iconKey);
                    return (
                      <div key={amenity.id} className={`rounded-xl border border-[#DDE5E3] bg-white p-2.5 ${!amenity.active ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-[#0F766E]" />
                          <input
                            value={amenity.name}
                            onChange={(e) => setAmenities((prev) => prev.map((a) => (a.id === amenity.id ? { ...a, name: e.target.value } : a)))}
                            onBlur={() => saveAmenities(amenities)}
                            className="min-w-0 flex-1 rounded-lg border border-transparent bg-[#F8FAFA] px-2 py-1 text-xs font-semibold text-[#17201F] focus:border-[#DDE5E3]"
                          />
                          <button onClick={() => saveAmenities(amenities.map((a) => (a.id === amenity.id ? { ...a, active: !a.active } : a)))} aria-label={amenity.active ? 'Disable' : 'Enable'} className="rounded-full p-1 text-[#5C6E6B]">
                            {amenity.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => index > 0 && saveAmenities((() => { const n = [...amenities]; [n[index - 1], n[index]] = [n[index], n[index - 1]]; return n; })())}
                            disabled={index === 0}
                            aria-label="Move up"
                            className="rounded-full p-1 text-[#5C6E6B] disabled:opacity-30"
                          ><ChevronUp className="h-4 w-4" /></button>
                          <button
                            onClick={() => index < amenities.length - 1 && saveAmenities((() => { const n = [...amenities]; [n[index], n[index + 1]] = [n[index + 1], n[index]]; return n; })())}
                            disabled={index === amenities.length - 1}
                            aria-label="Move down"
                            className="rounded-full p-1 text-[#5C6E6B] disabled:opacity-30"
                          ><ChevronDown className="h-4 w-4" /></button>
                          <button onClick={() => saveAmenities(amenities.filter((a) => a.id !== amenity.id))} aria-label="Delete amenity" className="rounded-full p-1 text-red-500"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {GYM_ICON_LIBRARY.map(({ key, icon: OptionIcon }) => (
                            <button
                              key={key}
                              onClick={() => saveAmenities(amenities.map((a) => (a.id === amenity.id ? { ...a, iconKey: key } : a)))}
                              aria-label={`Use ${key} icon`}
                              className={`flex h-7 w-7 items-center justify-center rounded-lg border ${amenity.iconKey === key ? 'border-[#0F766E] bg-[#0F766E]/10' : 'border-[#E1E7E6] bg-white'}`}
                            >
                              <OptionIcon className="h-3.5 w-3.5 text-[#17201F]" />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {amenities.length === 0 && <p className="text-xs text-[#8A9997]">No amenities added yet.</p>}
                </div>
              </div>
            )}

            {section === 'Quick Actions' && (
              <div className="space-y-2">
                <p className="text-[11px] leading-4 text-[#8A9997]">
                  Show/hide, reorder, relabel and re-icon each slot. Directions, Branches and Been-here always use their real trusted behavior — only their look and visibility are yours to control.
                </p>
                {quickActions.map((action, index) => {
                  const Icon = gymProfileIcon(action.iconKey);
                  return (
                    <div key={action.id} className={`rounded-xl border border-[#DDE5E3] bg-white p-2.5 ${!action.visible ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-[#0F766E]" />
                        <span className="w-16 shrink-0 text-[10px] font-bold uppercase text-[#8A9997]">{QUICK_ACTION_TYPE_LABEL[action.type]}</span>
                        <input
                          value={action.label}
                          onChange={(e) => setQuickActions((prev) => prev.map((a) => (a.id === action.id ? { ...a, label: e.target.value } : a)))}
                          onBlur={() => saveQuickActions(quickActions)}
                          className="min-w-0 flex-1 rounded-lg border border-transparent bg-[#F8FAFA] px-2 py-1 text-xs font-semibold text-[#17201F] focus:border-[#DDE5E3]"
                        />
                        <button onClick={() => saveQuickActions(quickActions.map((a) => (a.id === action.id ? { ...a, visible: !a.visible } : a)))} aria-label={action.visible ? 'Hide' : 'Show'} className="rounded-full p-1 text-[#5C6E6B]">
                          {action.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => index > 0 && saveQuickActions((() => { const n = [...quickActions]; [n[index - 1], n[index]] = [n[index], n[index - 1]]; return n; })())}
                          disabled={index === 0}
                          aria-label="Move up"
                          className="rounded-full p-1 text-[#5C6E6B] disabled:opacity-30"
                        ><ChevronUp className="h-4 w-4" /></button>
                        <button
                          onClick={() => index < quickActions.length - 1 && saveQuickActions((() => { const n = [...quickActions]; [n[index], n[index + 1]] = [n[index + 1], n[index]]; return n; })())}
                          disabled={index === quickActions.length - 1}
                          aria-label="Move down"
                          className="rounded-full p-1 text-[#5C6E6B] disabled:opacity-30"
                        ><ChevronDown className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {GYM_ICON_LIBRARY.map(({ key, icon: OptionIcon }) => (
                          <button
                            key={key}
                            onClick={() => saveQuickActions(quickActions.map((a) => (a.id === action.id ? { ...a, iconKey: key } : a)))}
                            aria-label={`Use ${key} icon`}
                            className={`flex h-7 w-7 items-center justify-center rounded-lg border ${action.iconKey === key ? 'border-[#0F766E] bg-[#0F766E]/10' : 'border-[#E1E7E6] bg-white'}`}
                          >
                            <OptionIcon className="h-3.5 w-3.5 text-[#17201F]" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {section === 'Social & Links' && (
              <div className="space-y-2">
                <p className="text-[11px] leading-4 text-[#8A9997]">
                  Only enabled links with a valid handle or URL show on your public Gym Detail page — never on the Home listing card. Website reuses the Basic Info field above; toggle it here to show/hide it.
                </p>
                {socialLinks.map((link) => {
                  const Icon = SOCIAL_PLATFORM_ICON[link.platform];
                  return (
                    <div key={link.id} className={`flex items-center gap-2 rounded-xl border border-[#DDE5E3] bg-white p-2.5 ${!link.enabled ? 'opacity-50' : ''}`}>
                      <Icon className="h-4 w-4 shrink-0 text-[#0F766E]" />
                      <span className="w-20 shrink-0 text-[10px] font-bold uppercase text-[#8A9997]">{SOCIAL_PLATFORM_LABEL[link.platform]}</span>
                      {link.platform === 'website' ? (
                        <span className="min-w-0 flex-1 truncate rounded-lg bg-[#F8FAFA] px-2 py-1 text-xs text-[#5C6E6B]">
                          {link.value || 'Set the Website field in Basic Info'}
                        </span>
                      ) : (
                        <input
                          value={link.value}
                          placeholder={SOCIAL_PLATFORM_PLACEHOLDER[link.platform]}
                          onChange={(e) => setSocialLinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, value: e.target.value } : l)))}
                          onBlur={() => saveSocialLinks(socialLinks)}
                          className="min-w-0 flex-1 rounded-lg border border-transparent bg-[#F8FAFA] px-2 py-1 text-xs font-semibold text-[#17201F] focus:border-[#DDE5E3]"
                        />
                      )}
                      <button
                        onClick={() => saveSocialLinks(socialLinks.map((l) => (l.id === link.id ? { ...l, enabled: !l.enabled } : l)))}
                        aria-label={link.enabled ? 'Disable' : 'Enable'}
                        className="rounded-full p-1 text-[#5C6E6B]"
                      >
                        {link.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

