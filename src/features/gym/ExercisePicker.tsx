import { useState } from 'react'
import { Plus, Search, X } from '@/components/icons'
import { Dialog } from '@/components/ui/dialog'
import { Button, IconButton } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/form'
import { Divider, ListItem, SectionTitle } from '@/components/ui/misc'
import { useTable } from '@/lib/hooks'
import { save } from '@/lib/repo'
import type { Exercise } from '@/lib/types'

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Other']

export function groupByMuscle(list: Exercise[]) {
  const m = new Map<string, Exercise[]>()
  for (const e of [...list].sort((a, b) => a.name.localeCompare(b.name))) m.set(e.muscleGroup, [...(m.get(e.muscleGroup) ?? []), e])
  return [...m.entries()].sort((a, b) => MUSCLES.indexOf(a[0]) - MUSCLES.indexOf(b[0]))
}

/** Name, muscle group and equipment. Stacks in narrow containers (dialogs, phones), one row when there is room. */
export function AddExerciseForm({ onAdded }: { onAdded?: (e: Exercise) => void }) {
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('Chest')
  const [equipment, setEquipment] = useState('')
  return (
    <div className="@container">
      <form
        className="grid grid-cols-2 items-center gap-x-3 gap-y-4 @2xl:grid-cols-[1fr_10rem_10rem_auto]"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          const ex = await save('exercises', { name: name.trim(), muscleGroup: muscle, equipment: equipment.trim() || 'Other', isCustom: true })
          setName('')
          setEquipment('')
          onAdded?.(ex)
        }}
      >
        <Field label="Exercise name" className="col-span-2 @2xl:col-span-1">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bulgarian split squat" />
        </Field>
        <Field label="Muscle group">
          <Select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            {MUSCLES.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </Field>
        <Field label="Equipment">
          <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Dumbbell" />
        </Field>
        <Button type="submit" variant="secondary" disabled={!name.trim()} className="col-span-2 justify-self-end @2xl:col-span-1">
          <Plus /> Add
        </Button>
      </form>
    </div>
  )
}

/** Exercise chooser: Google-style search pill over a list grouped by muscle, with a custom-exercise form below. */
export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const exercises = useTable('exercises') ?? []
  const [q, setQ] = useState('')
  const list = exercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) || e.muscleGroup.toLowerCase().includes(q.toLowerCase()))
  const groups = groupByMuscle(list)
  const pick = (e: Exercise) => {
    onPick(e)
    onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} title="Add exercise">
      <div className="grid gap-3">
        <label className="flex h-14 items-center gap-3 rounded-xl bg-surface-container-highest pr-1 pl-4 text-on-surface-variant">
          <Search className="size-6" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search exercises"
            aria-label="Search exercises"
            className="h-full min-w-0 flex-1 bg-transparent text-body-large text-on-surface outline-none placeholder:text-on-surface-variant focus-visible:outline-none"
          />
          {q && (
            <IconButton label="Clear search" onClick={() => setQ('')}>
              <X />
            </IconButton>
          )}
        </label>
        <div className="-mx-6 max-h-[50vh] overflow-y-auto">
          {groups.map(([muscle, items]) => (
            <section key={muscle}>
              <SectionTitle className="px-6 pt-3 pb-1">{muscle}</SectionTitle>
              {items.map((e) => (
                <ListItem key={e.id} onClick={() => pick(e)} headline={e.name} trailing={e.equipment} className="min-h-12 px-6" />
              ))}
            </section>
          ))}
          {!groups.length && (
            <p className="px-6 py-6 text-center text-body-medium text-on-surface-variant">No exercises match “{q}”. Add it below.</p>
          )}
        </div>
        <Divider className="-mx-6" />
        <div className="grid gap-3 pt-1">
          <h3 className="text-title-small text-on-surface-variant">Add a custom exercise</h3>
          <AddExerciseForm onAdded={pick} />
        </div>
      </div>
    </Dialog>
  )
}
