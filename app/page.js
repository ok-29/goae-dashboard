'use client'

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const EUR = (v) =>
  v != null ? `${Number(v).toFixed(2).replace('.', ',')} €` : '—'

function ConfBar({ value, size = 'md' }) {
  const v = Number(value) || 0
  const bar =
    v >= 80 ? 'bg-emerald-500' : v >= 60 ? 'bg-blue-500' : v >= 40 ? 'bg-amber-500' : 'bg-red-500'
  const txt =
    v >= 80 ? 'text-emerald-700' : v >= 60 ? 'text-blue-700' : v >= 40 ? 'text-amber-700' : 'text-red-700'
  const h = size === 'sm' ? 'h-1.5' : 'h-2'
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} bg-gray-200 rounded-full overflow-hidden`}>
        <div className={`${h} ${bar} rounded-full`} style={{ width: `${v}%` }} />
      </div>
      <span className={`font-mono text-xs font-bold ${txt} w-8 text-right`}>{v}</span>
    </div>
  )
}

function StatusBadge({ status }) {
  const cfg = {
    verified: { bg: 'bg-emerald-100 text-emerald-800', icon: '✓', label: 'Verifiziert' },
    accepted: { bg: 'bg-blue-100 text-blue-800', icon: '●', label: 'Akzeptiert' },
    suggested: { bg: 'bg-gray-100 text-gray-600', icon: '○', label: 'Vorschlag' },
    rejected: { bg: 'bg-red-100 text-red-800', icon: '✕', label: 'Abgelehnt' },
  }
  const s = cfg[status] || cfg.suggested
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${s.bg}`}>
      {s.icon} {s.label}
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
          verified_at: status === 'verified' || status === 'accepted' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mapping.kb_id)

      await supabase.from('mapping_corrections').insert({
        knowledge_base_id: mapping.kb_id,
        action: status === 'verified' ? 'accepted' : status === 'rejected' ? 'rejected' : 'noted',
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
    <div className="border-t-2 border-blue-500 bg-gradient-to-b from-blue-50 to-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-900">Mapping bearbeiten</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">Status</label>
        <div className="flex flex-wrap gap-2">
          {[
            { val: 'verified', label: '✓ Verifiziert', bg: 'bg-emerald-600 text-white' },
            { val: 'accepted', label: '● Akzeptiert', bg: 'bg-blue-600 text-white' },
            { val: 'rejected', label: '✕ Ablehnen', bg: 'bg-red-600 text-white' },
          ].map((btn) => (
            <button
              key={btn.val}
              onClick={() => setStatus(btn.val)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                status === btn.val
                  ? btn.bg + ' ring-2 ring-offset-1 ring-blue-400 shadow'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          Confidence <span className="font-normal text-gray-400">(AI: {mapping.ai_confidence ?? '—'}%)</span>
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
          <span className="font-mono font-bold text-sm text-blue-700 w-10 text-right">{confidence}%</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">Notiz</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional: Begründung oder Hinweis"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-16 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Abbrechen</button>
        <button
          onClick={doSave}
          disabled={!hasChanges || saving || !mapping.kb_id}
          className={`px-5 py-2 rounded-lg text-sm font-semibold ${
            hasChanges && !saving ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400'
          }`}
        >
          {saving ? '⏳' : '💾'} Speichern
        </button>
      </div>
    </div>
  )
}

function ResultCard({ mapping, isEditing, onEdit, onSave, onCloseEdit, onUpdatePosition }) {
  const isObsolete = !mapping.neu_nr
  const conf = Number(mapping.confidence)
  const anzahl = mapping.anzahl || 1
  const faktor = mapping.faktor || 2.3
  const altBetrag = (Number(mapping.alt_eur) || 0) * anzahl * faktor
  const neuBetrag = (Number(mapping.neu_eur) || 0) * anzahl * faktor
  const diff = neuBetrag - altBetrag
  const diffPct = altBetrag > 0 ? ((diff / altBetrag) * 100).toFixed(0) : 0

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all ${
      isEditing ? 'border-blue-400 shadow-lg ring-1 ring-blue-100' : 'border-gray-200 shadow-sm hover:shadow-md'
    }`}>
      <div className="p-5">
        {/* Header Row */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded-lg">
              {mapping.alt_nr}
            </span>
            <span className="text-gray-400">→</span>
            {isObsolete ? (
              <span className="text-sm text-gray-400 italic">kein Nachfolger</span>
            ) : (
              <span className="font-mono text-lg font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg">
                {mapping.neu_nr}
              </span>
            )}
          </div>
          <div className="flex-1" />
          <div className="w-28">
            <ConfBar value={conf} size="sm" />
          </div>
          <StatusBadge status={mapping.status} />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* ALT */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Alt (GOÄ)</div>
            <p className="text-sm text-gray-800 leading-relaxed">{mapping.alt_beschr}</p>
            <div className="flex items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Anzahl</span>
                <input
                  type="number"
                  min="1"
                  value={anzahl}
                  onChange={(e) => onUpdatePosition?.(mapping.kb_id || mapping.alt_nr, 'anzahl', Number(e.target.value) || 1)}
                  className="w-14 px-2 py-1 border border-gray-200 rounded text-center text-sm font-medium"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Faktor</span>
                <input
                  type="number"
                  min="1"
                  max="3.5"
                  step="0.1"
                  value={faktor}
                  onChange={(e) => onUpdatePosition?.(mapping.kb_id || mapping.alt_nr, 'faktor', Number(e.target.value) || 2.3)}
                  className="w-14 px-2 py-1 border border-gray-200 rounded text-center text-sm font-medium"
                />
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {EUR(mapping.alt_eur)} × {anzahl} × {faktor} = <span className="font-bold text-gray-800">{EUR(altBetrag)}</span>
            </div>
          </div>

          {/* NEU */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Neu (GOÄ)</div>
            {isObsolete ? (
              <p className="text-sm text-gray-400 italic">Diese Leistung hat keinen direkten Nachfolger in der neuen GOÄ.</p>
            ) : (
              <>
                <p className="text-sm text-gray-800 leading-relaxed">{mapping.neu_titel}</p>
                <div className="text-sm text-gray-600 pt-2">
                  {EUR(mapping.neu_eur)} × {anzahl} × {faktor} = <span className="font-bold text-blue-700">{EUR(neuBetrag)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div>
            {mapping.reasoning && (
              <p className="text-xs text-gray-500"><span className="font-medium">AI:</span> {mapping.reasoning}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {!isObsolete && (
              <span className={`text-sm font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {diff >= 0 ? '+' : ''}{EUR(diff)} ({diff >= 0 ? '+' : ''}{diffPct}%)
              </span>
            )}
            <button
              onClick={onEdit}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isEditing ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              ✎ Bearbeiten
            </button>
          </div>
        </div>
      </div>

      {isEditing && <EditPanel mapping={mapping} onSave={onSave} onClose={onCloseEdit} />}
    </div>
  )
}

export default function Dashboard() {
  const [view, setView] = useState('translate')
  const [inputZiffer, setInputZiffer] = useState('')
  const [inputAnzahl, setInputAnzahl] = useState(1)
  const [inputFaktor, setInputFaktor] = useState(2.3)
  const [previewText, setPreviewText] = useState('')
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

  // Preview: Lade Kurztext wenn Ziffer eingegeben wird
  useEffect(() => {
    const loadPreview = async () => {
      if (!inputZiffer.trim()) {
        setPreviewText('')
        return
      }
      const { data } = await supabase
        .from('goae_alt')
        .select('beschreibung')
        .eq('nummer', inputZiffer.trim())
        .single()
      setPreviewText(data?.beschreibung || '')
    }
    const timer = setTimeout(loadPreview, 300)
    return () => clearTimeout(timer)
  }, [inputZiffer])

  const updatePosition = useCallback((id, field, value) => {
    setResults(prev => prev.map(r =>
      (r.kb_id === id || r.alt_nr === id) ? { ...r, [field]: value } : r
    ))
  }, [])

  const handleErmitteln = useCallback(async () => {
    const codes = inputZiffer
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!codes.length) return
    setLoading(true)

    const { data: altCodes } = await supabase
      .from('goae_alt')
      .select('id, nummer, beschreibung, gebuehr_eur, abschnitt, faktor_min, faktor_regelmaessig, faktor_max')
      .in('nummer', codes)

    if (!altCodes?.length) {
      setResults(codes.map((c) => ({
        kb_id: null, alt_nr: c, alt_beschr: 'Nicht gefunden', alt_eur: null,
        neu_nr: null, neu_titel: null, neu_eur: null, confidence: 0,
        ai_confidence: null, status: 'suggested', reasoning: null, user_note: null,
        anzahl: inputAnzahl, faktor: inputFaktor,
      })))
      setLoading(false)
      return
    }

    const altIds = altCodes.map((a) => a.id)
    const { data: mappings } = await supabase
      .from('knowledge_base')
      .select('id, goae_alt_id, confidence, ai_confidence, status, reasoning, user_note, goae_neu(nummer, titel, bewertung_eur)')
      .in('goae_alt_id', altIds)
      .order('confidence', { ascending: false })

    const bestByAltId = {}
    for (const m of mappings || []) {
      if (!bestByAltId[m.goae_alt_id] || Number(m.confidence) > Number(bestByAltId[m.goae_alt_id].confidence)) {
        bestByAltId[m.goae_alt_id] = m
      }
    }

    const res = codes.map((code) => {
      const alt = altCodes.find((a) => a.nummer === code)
      const defaultFaktor = alt ? (Number(alt.faktor_regelmaessig) || inputFaktor) : inputFaktor

      if (!alt) return {
        kb_id: null, alt_nr: code, alt_beschr: 'Nicht gefunden', alt_eur: null,
        neu_nr: null, neu_titel: null, neu_eur: null, confidence: 0,
        ai_confidence: null, status: 'suggested', reasoning: null, user_note: null,
        anzahl: inputAnzahl, faktor: inputFaktor,
      }

      const m = bestByAltId[alt.id]
      if (!m) return {
        kb_id: null, alt_nr: alt.nummer, alt_beschr: alt.beschreibung, alt_eur: alt.gebuehr_eur,
        neu_nr: null, neu_titel: null, neu_eur: null, confidence: 0,
        ai_confidence: null, status: 'suggested', reasoning: 'Kein Mapping', user_note: null,
        anzahl: inputAnzahl, faktor: defaultFaktor,
      }

      return {
        kb_id: m.id, alt_nr: alt.nummer, alt_beschr: alt.beschreibung, alt_eur: alt.gebuehr_eur,
        neu_nr: m.goae_neu?.nummer, neu_titel: m.goae_neu?.titel, neu_eur: m.goae_neu?.bewertung_eur,
        confidence: m.confidence, ai_confidence: m.ai_confidence, status: m.status,
        reasoning: m.reasoning, user_note: m.user_note,
        anzahl: inputAnzahl, faktor: defaultFaktor,
      }
    })

    setResults(res)
    setLoading(false)
  }, [inputZiffer, inputAnzahl, inputFaktor])

  const loadBrowse = useCallback(async () => {
    setBrowseLoading(true)
    let query = supabase
      .from('knowledge_base')
      .select('id, confidence, ai_confidence, status, reasoning, user_note, goae_alt!inner(nummer, beschreibung, gebuehr_eur, faktor_regelmaessig), goae_neu(nummer, titel, bewertung_eur)', { count: 'exact' })

    if (filterConf === 'high') query = query.gte('confidence', 80)
    else if (filterConf === 'medium') query = query.gte('confidence', 60).lt('confidence', 80)
    else if (filterConf === 'low') query = query.lt('confidence', 60)
    if (filterStatus !== 'all') query = query.eq('status', filterStatus)

    const { data, count } = await query.order('confidence', { ascending: true }).range(browseOffset, browseOffset + PAGE_SIZE - 1)

    setBrowseData((data || []).map((m) => ({
      kb_id: m.id, alt_nr: m.goae_alt?.nummer, alt_beschr: m.goae_alt?.beschreibung, alt_eur: m.goae_alt?.gebuehr_eur,
      neu_nr: m.goae_neu?.nummer, neu_titel: m.goae_neu?.titel, neu_eur: m.goae_neu?.bewertung_eur,
      confidence: m.confidence, ai_confidence: m.ai_confidence, status: m.status, reasoning: m.reasoning, user_note: m.user_note,
      anzahl: 1, faktor: Number(m.goae_alt?.faktor_regelmaessig) || 2.3,
    })))
    setBrowseTotal(count || 0)
    setBrowseLoading(false)
  }, [filterConf, filterStatus, browseOffset])

  useEffect(() => { if (view === 'browse') loadBrowse() }, [view, loadBrowse])

  const loadActivity = useCallback(async () => {
    const { data: corr } = await supabase.from('mapping_corrections').select('*, knowledge_base(goae_alt(nummer))').order('created_at', { ascending: false }).limit(50)
    setCorrections(corr || [])

    const { count: total } = await supabase.from('knowledge_base').select('id', { count: 'exact', head: true })
    const { count: ge60 } = await supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).gte('confidence', 60)
    const { count: ge80 } = await supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).gte('confidence', 80)
    const { count: verified } = await supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).eq('status', 'verified')
    const { count: under40 } = await supabase.from('knowledge_base').select('id', { count: 'exact', head: true }).lt('confidence', 40)
    setStats({ total, ge60, ge80, verified, under40 })
  }, [])

  useEffect(() => { if (view === 'activity') loadActivity() }, [view, loadActivity])

  const handleSave = useCallback((updated) => {
    setResults((prev) => prev.map((r) => (r.kb_id === updated.kb_id ? { ...r, ...updated } : r)))
    setBrowseData((prev) => prev.map((r) => (r.kb_id === updated.kb_id ? { ...r, ...updated } : r)))
    setEditingId(null)
    showToast(`Mapping gespeichert ✓`)
  }, [])

  const totalAlt = results.reduce((s, r) => s + (Number(r.alt_eur) || 0) * (r.anzahl || 1) * (r.faktor || 2.3), 0)
  const totalNeu = results.reduce((s, r) => s + (Number(r.neu_eur) || 0) * (r.anzahl || 1) * (r.faktor || 2.3), 0)
  const totalDiff = totalNeu - totalAlt

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-pulse">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold shadow-lg">
              G
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">GOÄ Rechnungsbutler</h1>
              <p className="text-xs text-gray-400">Gebührenordnung Alt → Neu</p>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { id: 'translate', label: 'Ermitteln', icon: '⚡' },
              { id: 'browse', label: 'Durchsuchen', icon: '🔍' },
              { id: 'activity', label: 'Aktivität', icon: '📊' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  view === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-1.5">{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {view === 'translate' && (
          <div className="space-y-5">
            {/* Input Section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Neue GOÄ-Ziffer ermitteln</h2>
              
              {/* Input Row */}
              <div className="flex items-end gap-4">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ziffer</label>
                  <input
                    type="text"
                    value={inputZiffer}
                    onChange={(e) => setInputZiffer(e.target.value)}
                    placeholder="z.B. 1, 3, 5"
                    onKeyDown={(e) => e.key === 'Enter' && handleErmitteln()}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-gray-50"
                  />
                </div>
                <div className="flex-[2] min-w-0">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Kurztext</label>
                  <div className="px-4 py-3 border border-gray-100 rounded-xl text-sm text-gray-600 bg-gray-50 truncate min-h-[46px] flex items-center">
                    {previewText || <span className="text-gray-400 italic">Automatisch aus Datenbank</span>}
                  </div>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Anzahl</label>
                  <input
                    type="number"
                    min="1"
                    value={inputAnzahl}
                    onChange={(e) => setInputAnzahl(Number(e.target.value) || 1)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-center focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Faktor</label>
                  <input
                    type="number"
                    min="1"
                    max="3.5"
                    step="0.1"
                    value={inputFaktor}
                    onChange={(e) => setInputFaktor(Number(e.target.value) || 2.3)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-center focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                  />
                </div>
                <button
                  onClick={handleErmitteln}
                  disabled={loading || !inputZiffer.trim()}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none transition-all"
                >
                  {loading ? '⏳' : '⚡'} Ermitteln
                </button>
              </div>
            </div>

            {/* Summary */}
            {results.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-8">
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Positionen</span>
                    <p className="text-2xl font-bold text-gray-900">{results.length}</p>
                  </div>
                  <div className="h-10 border-l border-gray-200" />
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Alt-Summe</span>
                    <p className="text-2xl font-bold text-gray-900">{EUR(totalAlt)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Neu-Summe</span>
                    <p className="text-2xl font-bold text-blue-700">{EUR(totalNeu)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Differenz</span>
                    <p className={`text-2xl font-bold ${totalDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {totalDiff >= 0 ? '+' : ''}{EUR(totalDiff)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            <div className="space-y-4">
              {results.map((r, i) => (
                <ResultCard
                  key={r.kb_id || `r-${i}`}
                  mapping={r}
                  isEditing={editingId === (r.kb_id || `r-${i}`)}
                  onEdit={() => setEditingId(editingId === (r.kb_id || `r-${i}`) ? null : r.kb_id || `r-${i}`)}
                  onSave={handleSave}
                  onCloseEdit={() => setEditingId(null)}
                  onUpdatePosition={updatePosition}
                />
              ))}
            </div>

            {results.length === 0 && !loading && (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
                <div className="text-6xl mb-4 opacity-10">⚡</div>
                <p className="text-gray-400">GOÄ-alt Ziffer eingeben und Ermitteln klicken</p>
              </div>
            )}
          </div>
        )}

        {view === 'browse' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-3">
              <select value={filterConf} onChange={(e) => { setFilterConf(e.target.value); setBrowseOffset(0) }}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
                <option value="all">Alle Confidence</option>
                <option value="high">≥80%</option>
                <option value="medium">60-79%</option>
                <option value="low">&lt;60%</option>
              </select>
              <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setBrowseOffset(0) }}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
                <option value="all">Alle Status</option>
                <option value="verified">Verifiziert</option>
                <option value="accepted">Akzeptiert</option>
                <option value="suggested">Vorschlag</option>
                <option value="rejected">Abgelehnt</option>
              </select>
              <button onClick={loadBrowse} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700">
                Aktualisieren
              </button>
              <span className="text-xs text-gray-500 ml-auto">{browseTotal} Einträge</span>
            </div>

            {browseLoading ? (
              <div className="text-center py-12 text-gray-400">⏳ Laden...</div>
            ) : (
              <>
                <div className="space-y-4">
                  {browseData.map((d) => (
                    <ResultCard key={d.kb_id} mapping={d} isEditing={editingId === d.kb_id}
                      onEdit={() => setEditingId(editingId === d.kb_id ? null : d.kb_id)}
                      onSave={handleSave} onCloseEdit={() => setEditingId(null)}
                      onUpdatePosition={(id, field, value) => setBrowseData(prev => prev.map(r => r.kb_id === id ? { ...r, [field]: value } : r))}
                    />
                  ))}
                </div>
                {browseTotal > PAGE_SIZE && (
                  <div className="flex justify-center gap-3 pt-4">
                    <button disabled={browseOffset === 0} onClick={() => setBrowseOffset(Math.max(0, browseOffset - PAGE_SIZE))}
                      className="px-4 py-2 bg-white border rounded-xl text-sm disabled:opacity-40">← Zurück</button>
                    <span className="py-2 text-sm text-gray-500">{browseOffset + 1}–{Math.min(browseOffset + PAGE_SIZE, browseTotal)} von {browseTotal}</span>
                    <button disabled={browseOffset + PAGE_SIZE >= browseTotal} onClick={() => setBrowseOffset(browseOffset + PAGE_SIZE)}
                      className="px-4 py-2 bg-white border rounded-xl text-sm disabled:opacity-40">Weiter →</button>
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
                  { l: 'Verifiziert', v: stats.verified, c: 'text-indigo-600' },
                  { l: '<40%', v: stats.under40, c: 'text-red-600' },
                ].map((s, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{s.l}</p>
                    <p className={`text-3xl font-bold ${s.c}`}>{s.v?.toLocaleString('de-DE') ?? '—'}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Letzte Korrekturen</h3>
              {corrections.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Noch keine Korrekturen vorhanden.</p>
              ) : (
                <div className="space-y-2">
                  {corrections.map((c, i) => {
                    const actionMap = {
                      accepted: { i: '●', c: 'text-blue-600 bg-blue-50', l: 'akzeptiert' },
                      rejected: { i: '✕', c: 'text-red-600 bg-red-50', l: 'abgelehnt' },
                      corrected: { i: '✎', c: 'text-amber-600 bg-amber-50', l: 'korrigiert' },
                      noted: { i: '📝', c: 'text-gray-600 bg-gray-50', l: 'kommentiert' },
                    }
                    const a = actionMap[c.action] || { i: '○', c: 'text-gray-600 bg-gray-50', l: c.action }
                    const altNr = c.knowledge_base?.goae_alt?.nummer || '?'
                    const time = c.created_at ? new Date(c.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
                    return (
                      <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50">
                        <span className="text-xs text-gray-400 w-24">{time}</span>
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${a.c}`}>{a.i}</span>
                        <span className="text-sm text-gray-700 flex-1">
                          <strong>{c.corrected_by || 'System'}</strong> {a.l} <span className="font-mono font-bold text-blue-700">{altNr}</span>
                          {c.note && <span className="text-gray-400 ml-1">– {c.note}</span>}
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
