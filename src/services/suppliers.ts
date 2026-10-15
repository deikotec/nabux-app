import { addDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import type { Supplier } from '@/types';
import { refs } from './refs';

export type SupplierInput = Omit<Supplier, 'id' | 'createdAt'>;

function clean(input: SupplierInput) {
  return {
    name: input.name.trim(),
    contactName: input.contactName?.trim() ?? '',
    phone: input.phone?.trim() ?? '',
    email: input.email?.trim().toLowerCase() ?? '',
    notes: input.notes?.trim() ?? ''
  };
}

export async function createSupplier(bid: string, input: SupplierInput) {
  const ref = await addDoc(refs.suppliers(bid), { ...clean(input), createdAt: serverTimestamp() });
  return ref.id;
}

export async function updateSupplier(bid: string, id: string, input: SupplierInput) {
  await updateDoc(refs.supplier(bid, id), clean(input));
}

export async function deleteSupplier(bid: string, id: string) {
  await deleteDoc(refs.supplier(bid, id));
}
