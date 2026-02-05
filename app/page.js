'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const EUR = (v) => v != null ? `${Number(v).toFixed(2).replace('.', ',')} €` : '—'

// ─── Confidence Bar ────────────────────────────────────────
function ConfBar({ value }) {
  const v = Number(value) || 0
  const bar = v >= 80 ? 'bg-emerald-500' : v >= 60 ? 'bg-blue-500' : v >= 40 ? 'bg-amber-500' : 'bg-red-500'
  const txt = v >= 80 ? 'text-emerald-700' : v >= 60 ? 'text-blue-700' : v >= 40 ? 'text-amber-700' : 'text-red-700'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-2 ${bar} rounded-full`} style={{ width: `${v}%` }} />
      </div>
      <span className={`font-mono text-xs font-bold ${txt} w-8 text-right`}>{v}%</span>
    </div>
  )
}

// ─── Status Badge ──────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    verified: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Verifiziert' },
    accepted: { bg: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Akzeptiert' },
    suggested: { bg: 'bg-gray-100 text-gray-600 border-gray-300', label: 'Vorschlag' },
    rejected: { bg: 'bg-red-100 text-red-800 border-red-300', label: 'Abgelehnt' },
  }
  const s = cfg[status] || cfg.suggested
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${s.bg}`}>
      {s.label}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════
// ─── MAIN DASHBOARD ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════
export default function Dashboard() {
  // Positions state
  const [positions, setPositions] = useState([])
  const [newPos, setNewPos] = useState({ nummer: '', beschreibung: '', anzahl: 1, faktor: 2.3 })
  
  // Translation results
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Add position ───────────────────────────────────────
  const addPosition = useCallback(async () => {
    if (!newPos.nummer.trim()) return

    // Lookup in database
    const { data } = await supabase
      .from('goae_alt')
      .select('id, nummer, beschreibung, gebuehr_eur, faktor_min, faktor_regelmaessig, faktor_max')
      .eq('nummer', newPos.nummer.trim())
      .single()

    if (data) {
      setPositions(prev => [...prev, {
        id: crypto.randomUUID(),
        goae_alt_id: data.id,
        nummer: data.nummer,
        beschreibung: data.beschreibung,
        gebuehr_eur: data.gebuehr_eur,
        faktor_min: data.faktor_min,
        faktor_max: data.faktor_max,
        anzahl: newPos.anzahl || 1,
        faktor: newPos.faktor || Number(data.faktor_regelmaessig) || 2.3,
      }])
      setNewPos({ nummer: '', beschreibung: '', anzahl: 1, faktor: 2.3 })
    } else {
      showToast(`Ziffer ${newPos.nummer} nicht gefunden`)
    }
  }, [newPos])

  // ─── Remove position ────────────────────────────────────
  const removePosition = (id) => {
    setPositions(prev => prev.filter(p => p.id !== id))
    setResults([]) // Clear results when positions change
  }

  // ─── Update position ────────────────────────────────────
  const updatePosition = (id, field, value) => {
    setPositions(prev => prev.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ))
  }

  // ─── Translate all positions ────────────────────────────
  const handleTranslate = useCallback(async () => {
    if (positions.length === 0) return
    setLoading(true)

    const altIds = positions.map(p => p.goae_alt_id).filter(Boolean)
    
    // Get ALL mappings for these alt codes (not just the best one)
    const { data: mappings } = await supabase
      .from('knowledge_base')
      .select(`
        id, goae_alt_id, confidence, ai_confidence, status, reasoning, user_note,
        goae_neu(id, nummer, titel, bewertung_eur)
      `)
      .in('goae_alt_id', altIds)
      .gte('confidence', 20)
      .order('confidence', { ascending: false })

    // Group mappings by alt_id
    const mappingsByAltId = {}
    for (const m of mappings || []) {
      if (!mappingsByAltId[m.goae_alt_id]) {
        mappingsByAltId[m.goae_alt_id] = []
      }
      mappingsByAltId[m.goae_alt_id].push(m)
    }

    // Build results with position info
    const res = positions.map(pos => ({
      position: pos,
      betrag_alt: Number(pos.gebuehr_eur) * pos.anzahl * pos.faktor,
      mappings: (mappingsByAltId[pos.goae_alt_id] || []).map(m => ({
        kb_id: m.id,
        neu_id: m.goae_neu?.id,
        neu_nr: m.goae_neu?.nummer,
        neu_titel: m.goae_neu?.titel,
        neu_eur: m.goae_neu?.bewertung_eur,
        confidence: m.confidence,
        status: m.status,
        reasoning: m.reasoning,
        selected: m.confidence >= 80,
      }))
    }))

    setResults(res)
    setLoading(false)
    showToast(`${res.length} Positionen übersetzt`, 'success')
  }, [positions])

  // ─── Toggle mapping selection ───────────────────────────
  const toggleMapping = (posIdx, mapIdx) => {
    setResults(prev => prev.map((r, pi) => 
      pi === posIdx 
        ? {
            ...r,
            mappings: r.mappings.map((m, mi) => 
              mi === mapIdx ? { ...m, selected: !m.selected } : m
            )
          }
        : r
    ))
  }

  // ─── Calculate totals ───────────────────────────────────
  const totalAlt = positions.reduce((s, p) => s + (Number(p.gebuehr_eur) * p.anzahl * p.faktor), 0)
  const totalNeuSelected = results.reduce((s, r) => {
    const selectedMappings = r.mappings.filter(m => m.selected)
    return s + selectedMappings.reduce((ms, m) => ms + (Number(m.neu_eur) || 0) * r.position.anzahl, 0)
  }, 0)

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* ─── HEADER ─── */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-md">
              G
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">GOÄ Rechnungsbutler</h1>
              <p className="text-xs text-gray-400">Gebührenordnung Alt → Neu</p>
            </div>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        
        {/* ═══ POSITIONS TABLE ═══ */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">GOÄ Alt – Positionen</h2>
          </div>
          
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Ziffer (alt)</th>
                <th className="px-4 py-3 text-left">Kurztext</th>
                <th className="px-4 py-3 text-center w-24">Anzahl</th>
                <th className="px-4 py-3 text-center w-24">Faktor</th>
                <th className="px-4 py-3 text-right w-28">Betrag</th>
                <th className="px-4 py-3 text-center w-24">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-gray-800">{pos.nummer}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{pos.beschreibung}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min="1"
                      value={pos.anzahl}
                      onChange={(e) => updatePosition(pos.id, 'anzahl', Number(e.target.value) || 1)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min={pos.faktor_min || 1}
                      max={pos.faktor_max || 3.5}
                      step="0.1"
                      value={pos.faktor}
                      onChange={(e) => updatePosition(pos.id, 'faktor', Number(e.target.value) || 2.3)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">
                    {EUR(Number(pos.gebuehr_eur) * pos.anzahl * pos.faktor)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => removePosition(pos.id)}
                      className="px-3 py-1 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                    >
                      Entfernen
                    </button>
                  </td>
                </tr>
              ))}
              
              {/* New position row */}
              <tr className="bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="text"
                    placeholder="z. B. 1"
                    value={newPos.nummer}
                    onChange={(e) => setNewPos(p => ({ ...p, nummer: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addPosition()}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-400 italic">z. B. Beratung (fiktiv)</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="number"
                    min="1"
                    value={newPos.anzahl}
                    onChange={(e) => setNewPos(p => ({ ...p, anzahl: Number(e.target.value) || 1 }))}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded text-center text-sm"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="number"
                    min="1"
                    max="3.5"
                    step="0.1"
                    value={newPos.faktor}
                    onChange={(e) => setNewPos(p => ({ ...p, faktor: Number(e.target.value) || 2.3 }))}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded text-center text-sm"
                  />
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={addPosition}
                    className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
                  >
                    + Position
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Summary & Translate Button */}
          {positions.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs text-gray-500">Positionen</span>
                  <p className="text-lg font-bold text-gray-900">{positions.length}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Summe Alt</span>
                  <p className="text-lg font-bold text-gray-900">{EUR(totalAlt)}</p>
                </div>
                {totalNeuSelected > 0 && (
                  <div>
                    <span className="text-xs text-gray-500">Summe Neu (ausgewählt)</span>
                    <p className="text-lg font-bold text-blue-700">{EUR(totalNeuSelected)}</p>
                  </div>
                )}
              </div>
              <button
                onClick={handleTranslate}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                {loading ? '⏳ Übersetze...' : '⇄ GOÄ-alt übersetzen'}
              </button>
            </div>
          )}
        </div>

        {/* ═══ TRANSLATION RESULTS ═══ */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Übersetzungsvorschläge</h2>
            
            {results.map((result, posIdx) => (
              <div key={result.position.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Position header */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-mono font-bold text-lg text-gray-800 bg-white px-3 py-1 rounded border">
                      {result.position.nummer}
                    </span>
                    <span className="text-sm text-gray-700">{result.position.beschreibung}</span>
                    <span className="text-xs text-gray-400">×{result.position.anzahl} | Faktor {result.position.faktor}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">Alt-Betrag</span>
                    <p className="font-semibold text-gray-800">{EUR(result.betrag_alt)}</p>
                  </div>
                </div>

                {/* Mapping suggestions */}
                <div className="divide-y divide-gray-100">
                  {result.mappings.length === 0 ? (
                    <div className="px-5 py-6 text-center text-gray-400">
                      Keine Vorschläge gefunden
                    </div>
                  ) : (
                    result.mappings.map((mapping, mapIdx) => (
                      <div 
                        key={mapping.kb_id} 
                        className={`px-5 py-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer ${mapping.selected ? 'bg-blue-50' : ''}`}
                        onClick={() => toggleMapping(posIdx, mapIdx)}
                      >
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={mapping.selected}
                          onChange={() => {}}
                          className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        
                        {/* Neu info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                              {mapping.neu_nr}
                            </span>
                            <StatusBadge status={mapping.status} />
                          </div>
                          <p className="text-sm text-gray-800">{mapping.neu_titel}</p>
                          {mapping.reasoning && (
                            <p className="text-xs text-gray-500 mt-1">
                              <span className="font-medium">AI:</span> {mapping.reasoning}
                            </p>
                          )}
                        </div>

                        {/* Confidence */}
                        <div className="w-32">
                          <ConfBar value={mapping.confidence} />
                        </div>

                        {/* Price */}
                        <div className="w-24 text-right">
                          <p className="font-semibold text-gray-800">{EUR(mapping.neu_eur)}</p>
                          <p className="text-xs text-gray-500">pro Einheit</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {positions.length === 0 && (
          <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
            <div className="text-4xl mb-3 opacity-20">📋</div>
            <p className="text-gray-500 text-sm mb-1">Keine Positionen erfasst</p>
            <p className="text-gray-400 text-xs">Geben Sie GOÄ-alt Ziffern in der Tabelle oben ein</p>
          </div>
        )}
      </main>
    </div>
  )
}
