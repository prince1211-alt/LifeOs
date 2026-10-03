import { useState } from 'react'
import { Plus, Search } from '@/components/icons'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/form'
import { useTable } from '@/lib/hooks'
import { save } from '@/lib/repo'
import type { Exercise } from '@/lib/types'

export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Other']

export function groupByMuscle(list: Exercise[]) {
  const m = new Map<string, Exercise[]>()
  for (const e of [...list].sort((a, b) => a.name.localeCompare(b.name))) m.set(e.muscleGroup, [...(m.get(e.muscleGroup) ?? []), e])
  return [...m.entries()].sort((a, b) => MUSCLES.indexOf(a[0]) - MUSCLES.indexOf(b[0]))
}

export function AddExerciseForm({ onAdded }: { onAdded?: (e: Exercise) => void }) {
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState('Chest')
  const [equipment, setEquipment] = useState('')
  return (
    <form
      className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_8rem_8rem_auto]"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        const ex = await save('exercises', { name: name.trim(), muscleGroup: muscle, equipment: equipment.trim() || 'Other', isCustom: true })
        setName('')
        setEquipment('')
        onAdded?.(ex)
      }}
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Custom exercise name" />
      <Select value={muscle} onChange={(e) => setMuscle(e.target.value)} className="max-sm:col-span-1">
        {MUSCLES.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </Select>
      <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Equipment" className="max-sm:hidden" />
      <Button type="submit" disabled={!name.trim()}>
        <Plus /> Add
      </Button>
    </form>
  )
}

export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const exercises = useTable('exercises') ?? []
  const [q, setQ] = useState('')
  const list = exercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()) || e.muscleGroup.toLowerCase().includes(q.toLowerCase()))
  return (
    <Dialog open={open} onClose={onClose} title="Add exercise">
      <div className="grid gap-3">
        <div className="relative">
          <Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" className="pl-9" />
        </div>
        <div className="grid max-h-[50vh] gap-3 overflow-y-auto">
          {groupByMuscle(list).map(([muscle, items]) => (
            <section key={muscle}>
              <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{muscle}</h4>
              <div className="grid gap-1">
                {items.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => {
                      onPick(e)
                      onClose()
                    }}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span>{e.name}</span>
                    <span className="text-xs text-muted-foreground">{e.equipment}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className="border-t pt-3">
          <AddExerciseForm
            onAdded={(e) => {
              onPick(e)
              onClose()
            }}
          />
        </div>
      </div>
    </Dialog>
  )
}
