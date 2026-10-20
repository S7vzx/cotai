import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import * as React from 'react'
import { cn } from '@/lib/utils'

function Item({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-start gap-2 bg-surface', isDragging && 'relative z-10 rounded-xl shadow-xl')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-3 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-fg-3 hover:bg-surface-2 active:cursor-grabbing"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Lista reordenável por arrastar (mouse, toque ou teclado). */
export function SortableList<T>({
  items,
  getId,
  onReorder,
  render,
  className,
}: {
  items: T[]
  getId: (item: T) => string
  onReorder: (items: T[]) => void
  render: (item: T, index: number) => React.ReactNode
  className?: string
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const ids = items.map(getId)
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    onReorder(arrayMove(items, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((it, i) => (
            <Item key={ids[i]} id={ids[i]}>
              {render(it, i)}
            </Item>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
