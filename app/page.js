'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const EUR = (v) =>
  v != null ? `${Number(v).toFixed(2).replace('.', ',')} €` : '—'

function ConfBar({ value, size = 'md' }) {
  const v = Number(value) || 0
  const bar =
    v >= 80
      ? 'bg-emerald-500'
      : v >= 60
        ? 'bg-blue-500'
        : v >= 40
          ? 'bg-amber-500'
          : 'bg-red-500'
  const txt =
    v >= 80
      ? 'text-emerald-700'
      : v >= 60
        ? 'text-blue-700'
        : v >= 40
          ? 'text-amber-700'
          : 'text-red-700'
  const h = size === 'sm' ? 'h-1.5' : 'h-2'
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} bg-gray-200 rounded-full overflow-hidden`}>
        <div className={`${h} ${bar} rounded-full`} style={{ width: `${v}%` }} />
      </div>
      <span className={`font-mono text-xs font-bold ${txt} w-8 text-right`}>
        {v}
      </span>
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = {
    verified: {
      bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: '✓',
      label: 'Verifiziert',
    },
    accepted: {
      bg: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: '●',
      label: 'Akzeptiert',
    },
    suggested: {
      bg: 'bg-gray-100 text-gray-600 border-gray-300',
      icon: '○',
      label: 'Vorschlag',
    },
    rejected: {
      bg: 'bg-red-100 text-red-800 border-red-300',
      icon: '✕',
      label: 'Abgelehnt',
    },
    disputed: {
      bg: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: '?',
      label: 'Strittig',
    },
  }
  const s = cfg[status] || cfg.suggested
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${s.bg}`}
    >
      {s.icon} {s.label}
    </span>
  )
}

function DiffBadge({ alt, neu }) {
  if (alt == null || neu == null)
    return <span className="text-xs text-gray-400">—</span>
  const diff = Number(neu) - Number(alt)
  const pct =
    Number(alt) > 0 ? ((diff / Number(alt)) * 100).toFixed(0) : '—'
  const color =
    diff > 0
      ? 'text-emerald-600'
      : diff < 0
        ? 'text-red-600'
        : 'text-gray-400'
  return (
    <span className={`text-xs font-semibold ${color}`}>
      {diff > 0 ? '+' : ''}
      {diff.toFixed(2).replace('.', ',')} € ({diff > 0 ? '+' : ''}
      {pct}%)
    </span>
  )
}

function EditPanel({ mapping, onSave, onClose }) {
  const [status, setStatus] = useState(mapping.status)
  const [confidence, setConfidence] = useState(Number(mapping.confidence))
  const [note, setNote] = useState(mapping.user_note || '')
  const [saving, setSaving] = useState(false)

  const hasChanges =
    status !== mapping.status ||
    confidence !== Number(mapping.confidence) ||
    note !== (mapping.user_note || '')

  const doSave = async () => {
    if (!mapping.kb_id) return
    setSaving(true)
    try {
      await supabase
        .from('knowledge_base')
        .update({
          status,
          confidence,
          user_note: note || null,
          verified_at:
            status === 'verified' || status === 'accepted'
              ? new Date().toISOString()
              : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mapping.kb_id)

      await supabase.from('mapping_corrections').insert({
        knowledge_base_id: mapping.kb_id,
        action:
          status === 'verified'
            ? 'accepted'
            : status === 'rejected'
              ? 'rejected'
              : 'noted',
        old_status: mapping.status,
        new_status: status,
        old_confidence: Number(mapping.confidence),
        new_confidence: confidence,
        note: note || null,
        corrected_by: 'Dashboard-User',
      })

      onSave({ ...mapping, status, confidence, user_note: note })
    } catch (err) {
      console.error('Speicherfehler:', err)
    }
    setSaving(false)
  }

  return (
    <div className="border-t-2 border-blue-500 bg-blue-50 rounded-b-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-900">
          Bearbeiten – Alt-{mapping.alt_nr}
        </h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          ✕
        </button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">
          Status
        </label>
        <div className="flex flex-wrap gap-2">
          {[
            {
              val: 'verified',
              label: '✓ Verifiziert',
              bg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
            },
            {
              val: 'accepted',
              label: '● Akzeptiert',
              bg: 'bg-blue-600 hover:bg-blue-700 text-white',
            },
            {
              val: 'rejected',
              label: '✕ Ablehnen',
              bg: 'bg-red-600 hover:bg-red-700 text-white',
            },
          ].map((btn) => (
            <button
              key={btn.val}
              onClick={() => setStatus(btn.val)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                status === btn.val
                  ? btn.bg +
                    ' ring-2 ring-offset-1 ring-blue-400 shadow-md'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Confidence{' '}
          <span className="font-normal text-gray-400">
            (AI: {mapping.ai_confidence ?? '—'}%)
          </span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="flex-1 h-2 accent-blue-600"
          />
          <span className="font-mono font-bold text-sm text-blue-700 w-10 text-right">
            {confidence}%
          </span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Notiz
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="z.B. Identische Leistung / Kein Nachfolger / AI zu niedrig bewertet"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none h-16 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-200">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">
          Abbrechen
        </button>
        <button
          onClick={doSave}
          disabled={!hasChanges || saving || !mapping.kb_id}
          className={`px-5 py-2 rounded-lg text-sm font-semibold shadow-sm ${
            hasChanges && !saving
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {saving ? '⏳ Speichern...' : '💾 Speichern'}
        </button>
      </div>
    </div>
  )
}

function MappingCard({ mapping, isEditing, onEdit, onSave, onCloseEdit, onUpdatePosition }) {
  const isObsolete = !mapping.neu_nr
  const conf = Number(mapping.confidence)
  
  // Anzahl und Faktor aus mapping
  const anzahl = mapping.anzahl || 1
  const faktor = mapping.faktor || 2.3
  
  // Beträge MIT Faktor berechnen
  const altBetrag = (Number(mapping.alt_eur) || 0) * anzahl * faktor
  const neuBetrag = (Number(mapping.neu_eur) || 0) * anzahl * faktor

  return (
    <div
      className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-all ${
        isEditing
          ? 'border-blue-400 ring-1 ring-blue-200'
          : conf < 60
            ? 'border-amber-200'
            : 'border-gray-200'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* ALT Section */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono font-bold text-sm text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                {mapping.alt_nr}
              </span>
              <span className="text-xs text-gray-400">Alt</span>
              <span className="text-xs text-gray-500 ml-auto">
                Basis: {EUR(mapping.alt_eur)}
              </span>
            </div>
            <p className="text-sm text-gray-900 leading-snug">
              {mapping.alt_beschr}
            </p>
            {/* Anzahl & Faktor Eingabe */}
            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Anzahl:</span>
                <input
                  type="number"
                  min="1"
                  value={anzahl}
                  onChange={(e) => onUpdatePosition && onUpdatePosition(mapping.kb_id || mapping.alt_nr, 'anzahl', Number(e.target.value) || 1)}
                  className="w-14 px-1.5 py-0.5 border border-gray-300 rounded text-center text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Faktor:</span>
                <input
                  type="number"
                  min="1"
                  max="3.5"
                  step="0.1"
                  value={faktor}
                  onChange={(e) => onUpdatePosition && onUpdatePosition(mapping.kb_id || mapping.alt_nr, 'faktor', Number(e.target.value) || 2.3)}
                  className="w-14 px-1.5 py-0.5 border border-gray-300 rounded text-center text-xs"
                />
              </div>
              <span className="text-xs font-semibold text-gray-700 ml-auto">
                = {EUR(altBetrag)}
              </span>
            </div>
          </div>

          {/* Arrow & Confidence */}
          <div className="flex flex-col items-center gap-1 pt-1 px-2 shrink-0">
            <span
              className={`text-xl ${
                isObsolete
                  ? 'text-gray-300'
                  : conf < 60
                    ? 'text-amber-400'
                    : 'text-emerald-400'
              }`}
            >
              →
            </span>
            <ConfBar value={conf} size="sm" />
          </div>

          {/* NEU Section */}
          <div className="flex-1 min-w-0">
            {isObsolete ? (
              <div className="py-2">
                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-500 text-xs font-medium border border-gray-200">
                  — Kein Nachfolger
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    {mapping.neu_nr}
                  </span>
                  <span className="text-xs text-gray-400">Neu</span>
                  <span className="text-xs text-gray-500 ml-auto">
                    Basis: {EUR(mapping.neu_eur)}
                  </span>
                </div>
                <p className="text-sm text-gray-900 leading-snug">
                  {mapping.neu_titel}
                </p>
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {EUR(mapping.neu_eur)} × {anzahl} × {faktor} ={' '}
                  </span>
                  <span className="text-xs font-semibold text-blue-700">
                    {EUR(neuBetrag)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Status & Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0 w-28">
            <StatusBadge status={mapping.status} />
            {!isObsolete && (
              <DiffBadge alt={altBetrag} neu={neuBetrag} />
            )}
            <button
              onClick={onEdit}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                isEditing
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              ✎ Bearbeiten
            </button>
          </div>
        </div>

        {(mapping.reasoning || mapping.user_note) && !isEditing && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex gap-4">
            {mapping.reasoning && (
              <p className="text-xs text-gray-500 flex-1">
                <span className="font-medium">AI:</span> {mapping.reasoning}
              </p>
            )}
            {mapping.user_note && (
              <p className="text-xs text-blue-600 flex-1">
                <span className="font-medium">📝</span> {mapping.user_note}
              </p>
            )}
          </div>
        )}
      </div>

      {isEditing && (
        <EditPanel mapping={mapping} onSave={onSave} onClose={onCloseEdit} />
      )}
    </div>
  )
}

export default function Dashboard() {
  const [view, setView] = useState('translate')
  const [inputCodes, setInputCodes] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [toast, setToast] = useState(null)

  const [browseData, setBrowseData] = useState([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [filterConf, setFilterConf] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [browseOffset, setBrowseOffset] = useState(0)
  const [browseTotal, setBrowseTotal] = useState(0)
  const PAGE_SIZE = 50

  const [corrections, setCorrections] = useState([])
  const [stats, setStats] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Update Anzahl/Faktor für eine Position
  const updatePosition = useCallback((id, field, value) => {
    setResults(prev => prev.map(r => 
      (r.kb_id === id || r.alt_nr === id) ? { ...r, [field]: value } : r
    ))
  }, [])

  const handleTranslate = useCallback(async () => {
    const codes = inputCodes
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!codes.length) return
    setLoading(true)

    // Lade auch Faktor-Felder aus goae_alt
    const { data: altCodes } = await supabase
      .from('goae_alt')
      .select('id, nummer, beschreibung, gebuehr_eur, abschnitt, faktor_min, faktor_regelmaessig, faktor_max')
      .in('nummer', codes)

    if (!altCodes?.length) {
      setResults(
        codes.map((c) => ({
          kb_id: null,
          alt_nr: c,
          alt_beschr: 'Nicht in Datenbank',
          alt_eur: null,
          neu_nr: null,
          neu_titel: null,
          neu_eur: null,
          confidence: 0,
          ai_confidence: null,
          status: 'suggested',
          reasoning: null,
          user_note: null,
          anzahl: 1,
          faktor: 2.3,
        }))
      )
      setLoading(false)
      return
    }

    const altIds = altCodes.map((a) => a.id)
    const { data: mappings } = await supabase
      .from('knowledge_base')
      .select(
        'id, goae_alt_id, confidence, ai_confidence, status, reasoning, user_note, goae_neu(nummer, titel, bewertung_eur)'
      )
      .in('goae_alt_id', altIds)
      .order('confidence', { ascending: false })

    const bestByAltId = {}
    for (const m of mappings || []) {
      if (
        !bestByAltId[m.goae_alt_id] ||
        Number(m.confidence) > Number(bestByAltId[m.goae_alt_id].confidence)
      ) {
        bestByAltId[m.goae_alt_id] = m
      }
    }

    const res = codes.map((code) => {
      const alt = altCodes.find((a) => a.nummer === code)
      // Standard-Faktor aus DB oder 2.3
      const defaultFaktor = alt ? (Number(alt.faktor_regelmaessig) || 2.3) : 2.3
      
      if (!alt)
        return {
          kb_id: null,
          alt_nr: code,
          alt_beschr: 'Nicht in Datenbank',
          alt_eur: null,
          neu_nr: null,
          neu_titel: null,
          neu_eur: null,
          confidence: 0,
          ai_confidence: null,
          status: 'suggested',
          reasoning: null,
          user_note: null,
          anzahl: 1,
          faktor: 2.3,
        }
      const m = bestByAltId[alt.id]
      if (!m)
        return {
          kb_id: null,
          alt_nr: alt.nummer,
          alt_beschr: alt.beschreibung,
          alt_eur: alt.gebuehr_eur,
          neu_nr: null,
          neu_titel: null,
          neu_eur: null,
          confidence: 0,
          ai_confidence: null,
          status: 'suggested',
          reasoning: 'Kein Mapping vorhanden',
          user_note: null,
          anzahl: 1,
          faktor: defaultFaktor,
        }
      return {
        kb_id: m.id,
        alt_nr: alt.nummer,
        alt_beschr: alt.beschreibung,
        alt_eur: alt.gebuehr_eur,
        neu_nr: m.goae_neu?.nummer,
        neu_titel: m.goae_neu?.titel,
        neu_eur: m.goae_neu?.bewertung_eur,
        confidence: m.confidence,
        ai_confidence: m.ai_confidence,
        status: m.status,
        reasoning: m.reasoning,
        user_note: m.user_note,
        anzahl: 1,
        faktor: defaultFaktor,
      }
    })

    setResults(res)
    setLoading(false)
  }, [inputCodes])

  const loadBrowse = useCallback(async () => {
    setBrowseLoading(true)

    let query = supabase
      .from('knowledge_base')
      .select(
        'id, confidence, ai_confidence, status, reasoning, user_note, goae_alt!inner(nummer, beschreibung, gebuehr_eur, abschnitt, faktor_regelmaessig), goae_neu(nummer, titel, bewertung_eur)',
        { count: 'exact' }
      )

    if (filterConf === 'high') query = query.gte('confidence', 80)
    else if (filterConf === 'medium')
      query = query.gte('confidence', 60).lt('confidence', 80)
    else if (filterConf === 'low') query = query.lt('confidence', 60)

    if (filterStatus !== 'all') query = query.eq('status', filterStatus)

    const { data, count } = await query
      .order('confidence', { ascending: true })
      .range(browseOffset, browseOffset + PAGE_SIZE - 1)

    setBrowseData(
      (data || []).map((m) => ({
        kb_id: m.id,
        alt_nr: m.goae_alt?.nummer,
        alt_beschr: m.goae_alt?.beschreibung,
        alt_eur: m.goae_alt?.gebuehr_eur,
        neu_nr: m.goae_neu?.nummer,
        neu_titel: m.goae_neu?.titel,
        neu_eur: m.goae_neu?.bewertung_eur,
        confidence: m.confidence,
        ai_confidence: m.ai_confidence,
        status: m.status,
        reasoning: m.reasoning,
        user_note: m.user_note,
        anzahl: 1,
        faktor: Number(m.goae_alt?.faktor_regelmaessig) || 2.3,
      }))
    )
    setBrowseTotal(count || 0)
    setBrowseLoading(false)
  }, [filterConf, filterStatus, browseOffset])

  useEffect(() => {
    if (view === 'browse') loadBrowse()
  }, [view, loadBrowse])

  const loadActivity = useCallback(async () => {
    const { data: corr } = await supabase
      .from('mapping_corrections')
      .select('*, knowledge_base(goae_alt(nummer))')
      .order('created_at', { ascending: false })
      .limit(50)
    setCorrections(corr || [])

    const { count: total } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
    const { count: ge60 } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
      .gte('confidence', 60)
    const { count: ge80 } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
      .gte('confidence', 80)
    const { count: verified } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'verified')
    const { count: under40 } = await supabase
      .from('knowledge_base')
      .select('id', { count: 'exact', head: true })
      .lt('confidence', 40)

    setStats({ total, ge60, ge80, verified, under40 })
  }, [])

  useEffect(() => {
    if (view === 'activity') loadActivity()
  }, [view, loadActivity])

  const handleSave = useCallback((updated) => {
    setResults((prev) =>
      prev.map((r) => (r.kb_id === updated.kb_id ? { ...r, ...updated } : r))
    )
    setBrowseData((prev) =>
      prev.map((r) => (r.kb_id === updated.kb_id ? { ...r, ...updated } : r))
    )
    setEditingId(null)
    showToast(`Alt-${updated.alt_nr} gespeichert ✓`)
  }, [])

  // Summen MIT Faktor berechnen
  const totalAlt = results.reduce(
    (s, r) => s + (Number(r.alt_eur) || 0) * (r.anzahl || 1) * (r.faktor || 2.3),
    0
  )
  const totalNeu = results.reduce(
    (s, r) => s + (Number(r.neu_eur) || 0) * (r.anzahl || 1) * (r.faktor || 2.3),
    0
  )
  const totalDiff = totalNeu - totalAlt

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-sm shadow-md">
              G
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                GOÄ Rechnungsbutler
              </h1>
              <p className="text-xs text-gray-400">
                Gebührenordnung Alt → Neu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            {[
              { id: 'translate', label: 'Übersetzen', icon: '⇄' },
              { id: 'browse', label: 'Durchsuchen', icon: '🔍' },
              { id: 'activity', label: 'Aktivität', icon: '📋' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  view === tab.id
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
            H
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {view === 'translate' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-1">
                Rechnung übersetzen
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                GOÄ-alt Ziffern eingeben – Beträge werden mit Anzahl × Faktor berechnet.
              </p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={inputCodes}
                  onChange={(e) => setInputCodes(e.target.value)}
                  placeholder="z.B. 1, 3, 5, 50, 250, 535, 3552"
                  onKeyDown={(e) => e.key === 'Enter' && handleTranslate()}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <button
                  onClick={handleTranslate}
                  disabled={loading}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 shadow-sm disabled:opacity-50"
                >
                  {loading ? '⏳ Laden...' : '⇄ Übersetzen'}
                </button>
              </div>
            </div>

            {results.length > 0 && (
              <>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-xs text-gray-500">Positionen</span>
                      <p className="text-lg font-bold text-gray-900">
                        {results.length}
                      </p>
                    </div>
                    <div className="h-8 border-l border-gray-200" />
                    <div>
                      <span className="text-xs text-gray-500">Alt-Summe</span>
                      <p className="text-lg font-bold text-gray-900">
                        {EUR(totalAlt)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Neu-Summe</span>
                      <p className="text-lg font-bold text-blue-700">
                        {EUR(totalNeu)}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500">Differenz</span>
                      <p
                        className={`text-lg font-bold ${
                          totalDiff >= 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }`}
                      >
                        {totalDiff >= 0 ? '+' : ''}
                        {EUR(totalDiff)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {results.map((r, i) => (
                    <MappingCard
                      key={r.kb_id || `r-${i}`}
                      mapping={r}
                      isEditing={editingId === (r.kb_id || `r-${i}`)}
                      onEdit={() =>
                        setEditingId(
                          editingId === (r.kb_id || `r-${i}`)
                            ? null
                            : r.kb_id || `r-${i}`
                        )
                      }
                      onSave={handleSave}
                      onCloseEdit={() => setEditingId(null)}
                      onUpdatePosition={updatePosition}
                    />
                  ))}
                </div>
              </>
            )}

            {results.length === 0 && !loading && (
              <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-16 text-center">
                <div className="text-5xl mb-4 opacity-20">⇄</div>
                <p className="text-gray-400 text-sm">
                  GOÄ-alt Ziffern eingeben und Übersetzen klicken
                </p>
              </div>
            )}
          </div>
        )}

        {view === 'browse' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
              <select
                value={filterConf}
                onChange={(e) => {
                  setFilterConf(e.target.value)
                  setBrowseOffset(0)
                }}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="all">Alle Confidence</option>
                <option value="high">≥80%</option>
                <option value="medium">60-79%</option>
                <option value="low">&lt;60%</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value)
                  setBrowseOffset(0)
                }}
                className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="all">Alle Status</option>
                <option value="verified">Verifiziert</option>
                <option value="accepted">Akzeptiert</option>
                <option value="suggested">Vorschlag</option>
                <option value="rejected">Abgelehnt</option>
              </select>
              <button
                onClick={loadBrowse}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Aktualisieren
              </button>
              <span className="text-xs text-gray-500 ml-auto">
                {browseTotal} Einträge
              </span>
            </div>

            {browseLoading ? (
              <div className="text-center py-12 text-gray-400">
                ⏳ Laden...
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {browseData.map((d) => (
                    <MappingCard
                      key={d.kb_id}
                      mapping={d}
                      isEditing={editingId === d.kb_id}
                      onEdit={() =>
                        setEditingId(
                          editingId === d.kb_id ? null : d.kb_id
                        )
                      }
                      onSave={handleSave}
                      onCloseEdit={() => setEditingId(null)}
                      onUpdatePosition={(id, field, value) => {
                        setBrowseData(prev => prev.map(r => 
                          r.kb_id === id ? { ...r, [field]: value } : r
                        ))
                      }}
                    />
                  ))}
                </div>

                {browseTotal > PAGE_SIZE && (
                  <div className="flex justify-center gap-3 pt-4">
                    <button
                      disabled={browseOffset === 0}
                      onClick={() =>
                        setBrowseOffset(
                          Math.max(0, browseOffset - PAGE_SIZE)
                        )
                      }
                      className="px-4 py-2 bg-white border rounded-lg text-sm disabled:opacity-40"
                    >
                      ← Zurück
                    </button>
                    <span className="py-2 text-sm text-gray-500">
                      {browseOffset + 1}–
                      {Math.min(browseOffset + PAGE_SIZE, browseTotal)} von{' '}
                      {browseTotal}
                    </span>
                    <button
                      disabled={browseOffset + PAGE_SIZE >= browseTotal}
                      onClick={() =>
                        setBrowseOffset(browseOffset + PAGE_SIZE)
                      }
                      className="px-4 py-2 bg-white border rounded-lg text-sm disabled:opacity-40"
                    >
                      Weiter →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {view === 'activity' && (
          <div className="space-y-6">
            {stats && (
              <div className="grid grid-cols-5 gap-4">
                {[
                  { l: 'Gesamt', v: stats.total, c: 'text-gray-900' },
                  { l: '≥60%', v: stats.ge60, c: 'text-emerald-600' },
                  { l: '≥80%', v: stats.ge80, c: 'text-blue-600' },
                  {
                    l: 'Verifiziert',
                    v: stats.verified,
                    c: 'text-indigo-600',
                  },
                  { l: '<40%', v: stats.under40, c: 'text-red-600' },
                ].map((s, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center"
                  >
                    <p className="text-xs text-gray-500">{s.l}</p>
                    <p className={`text-2xl font-bold ${s.c}`}>
                      {s.v?.toLocaleString('de-DE') ?? '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4">
                Letzte Korrekturen & Bewertungen
              </h3>
              {corrections.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  Noch keine Korrekturen – Mappings über Übersetzen oder
                  Durchsuchen bewerten.
                </p>
              ) : (
                <div className="space-y-1">
                  {corrections.map((c, i) => {
                    const actionMap = {
                      accepted: {
                        i: '●',
                        c: 'text-blue-600 bg-blue-50',
                        l: 'akzeptiert',
                      },
                      rejected: {
                        i: '✕',
                        c: 'text-red-600 bg-red-50',
                        l: 'abgelehnt',
                      },
                      corrected: {
                        i: '✎',
                        c: 'text-amber-600 bg-amber-50',
                        l: 'korrigiert',
                      },
                      noted: {
                        i: '📝',
                        c: 'text-gray-600 bg-gray-50',
                        l: 'kommentiert',
                      },
                    }
                    const a = actionMap[c.action] || {
                      i: '○',
                      c: 'text-gray-600 bg-gray-50',
                      l: c.action,
                    }
                    const altNr =
                      c.knowledge_base?.goae_alt?.nummer || '?'
                    const time = c.created_at
                      ? new Date(c.created_at).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0"
                      >
                        <span className="text-xs text-gray-400 w-28">
                          {time}
                        </span>
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${a.c}`}
                        >
                          {a.i}
                        </span>
                        <span className="text-xs text-gray-700 flex-1">
                          <strong>{c.corrected_by || 'System'}</strong>{' '}
                          {a.l}{' '}
                          <span className="font-mono font-bold text-blue-700">
                            Alt-{altNr}
                          </span>
                          {c.old_confidence != null &&
                            c.new_confidence != null &&
                            Number(c.old_confidence) !==
                              Number(c.new_confidence) && (
                              <span className="text-gray-400 ml-1">
                                ({c.old_confidence}% → {c.new_confidence}%)
                              </span>
                            )}
                          {c.note && (
                            <span className="text-gray-400 ml-1">
                              – {c.note}
                            </span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
