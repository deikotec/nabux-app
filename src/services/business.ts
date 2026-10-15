import { arrayUnion, doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DEFAULT_INVENTORY_SETTINGS, DEFAULT_RECEIPT_FOOTER, DEFAULT_ROLE_PERMISSIONS } from '@/config/app';
import type { Business, InventorySettings } from '@/types';
import { logActivityIn } from './activity';
import { refs, type Actor } from './refs';

export interface CreateBusinessInput {
  name: string;
  businessType: string;
  currency: string;
  locale: string;
  taxRate: number;
  taxName: string;
  pricesIncludeTax: boolean;
  categories: string[];
  address?: string;
  phone?: string;
  taxId?: string;
  logoUrl?: string | null;
  logoPath?: string | null;
}

/**
 * Crea un negocio nuevo y deja al usuario como propietario, en una sola escritura atómica:
 * businesses/{bid}, su miembro "owner", el contador de folios y el índice en users/{uid}.
 */
export async function createBusiness(
  owner: { uid: string; email: string; displayName: string; photoURL?: string | null },
  input: CreateBusinessInput
): Promise<string> {
  const bizRef = doc(refs.businesses());
  const bid = bizRef.id;
  const batch = writeBatch(db);

  batch.set(bizRef, {
    name: input.name.trim(),
    legalName: input.name.trim(),
    businessType: input.businessType,
    taxId: input.taxId?.trim() ?? '',
    address: input.address?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    email: owner.email,
    logoUrl: input.logoUrl ?? null,
    logoPath: input.logoPath ?? null,
    ownerId: owner.uid,
    currency: input.currency,
    locale: input.locale,
    taxRate: input.taxRate,
    taxName: input.taxName,
    pricesIncludeTax: input.pricesIncludeTax,
    categories: input.categories,
    settings: DEFAULT_INVENTORY_SETTINGS,
    receiptFooter: DEFAULT_RECEIPT_FOOTER,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  batch.set(refs.member(bid, owner.uid), {
    uid: owner.uid,
    email: owner.email.toLowerCase(),
    displayName: owner.displayName,
    photoURL: owner.photoURL ?? null,
    role: 'owner',
    permissions: DEFAULT_ROLE_PERMISSIONS.owner,
    status: 'active',
    shift: 'Completo',
    invitedBy: null,
    joinedAt: serverTimestamp(),
    lastActiveAt: serverTimestamp()
  });

  batch.set(refs.counters(bid), { sale: 0 });

  batch.set(
    refs.user(owner.uid),
    { businessIds: arrayUnion(bid), lastBusinessId: bid, updatedAt: serverTimestamp() },
    { merge: true }
  );

  logActivityIn(batch, bid, { uid: owner.uid, name: owner.displayName }, {
    type: 'business_create',
    message: `Creó el negocio "${input.name.trim()}"`
  });

  await batch.commit();
  return bid;
}

export type BusinessPatch = Partial<
  Pick<
    Business,
    | 'name'
    | 'legalName'
    | 'taxId'
    | 'businessType'
    | 'address'
    | 'phone'
    | 'email'
    | 'logoUrl'
    | 'logoPath'
    | 'currency'
    | 'locale'
    | 'taxRate'
    | 'taxName'
    | 'pricesIncludeTax'
    | 'categories'
    | 'receiptFooter'
  >
>;

export async function updateBusiness(bid: string, patch: BusinessPatch) {
  await updateDoc(refs.business(bid), { ...patch, updatedAt: serverTimestamp() });
}

export async function updateInventorySettings(bid: string, settings: InventorySettings) {
  await updateDoc(refs.business(bid), { settings, updatedAt: serverTimestamp() });
}

export async function saveCategories(bid: string, categories: string[]) {
  const clean = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  await updateDoc(refs.business(bid), { categories: clean, updatedAt: serverTimestamp() });
}

export function actorFrom(member: { uid: string; displayName: string }): Actor {
  return { uid: member.uid, name: member.displayName };
}
