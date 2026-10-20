import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '@/lib/supabase'
import type { Category, Coupon, FaqItem, Supplier, Unit } from '@/types/domain'

type Table = 'categories' | 'units' | 'suppliers' | 'faq_items' | 'coupons'
type RowOf<T extends Table> = T extends 'categories'
  ? Category
  : T extends 'units'
    ? Unit
    : T extends 'suppliers'
      ? Supplier
      : T extends 'faq_items'
        ? FaqItem
        : Coupon

const ORDER: Record<Table, string> = {
  categories: 'position',
  units: 'position',
  suppliers: 'name',
  faq_items: 'position',
  coupons: 'created_at',
}

/** CRUD simples para as tabelas de catálogo da Administração. */
export function useCatalog<T extends Table>(table: T) {
  return useQuery({
    queryKey: [table],
    queryFn: async () =>
      unwrap(
        await supabase
          .from(table)
          .select('*')
          .order(ORDER[table], { ascending: table !== 'coupons' }),
      ) as RowOf<T>[],
  })
}

export function useCatalogMutations<T extends Table>(table: T) {
  const qc = useQueryClient()
  const done = () => {
    qc.invalidateQueries({ queryKey: [table] })
    qc.invalidateQueries({ queryKey: ['public-settings'] })
  }
  return {
    upsert: useMutation({
      mutationFn: async (row: Partial<RowOf<T>>) => {
        const { id, ...rest } = row as { id?: string }
        if (id) return unwrap(await supabase.from(table).update(rest).eq('id', id).select('*').single())
        return unwrap(await supabase.from(table).insert(rest).select('*').single())
      },
      onSuccess: done,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => unwrap(await supabase.from(table).delete().eq('id', id)),
      onSuccess: done,
    }),
    reorder: useMutation({
      mutationFn: async (ids: string[]) => {
        for (let i = 0; i < ids.length; i++) unwrap(await supabase.from(table).update({ position: i }).eq('id', ids[i]))
      },
      onSuccess: done,
    }),
  }
}
