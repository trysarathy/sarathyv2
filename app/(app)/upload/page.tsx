'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatCurrency } from '@/lib/calculations'
import { parseBankStatement, formatBankLabel, type BankFormat } from '@/lib/csv-parser'
import { getAuthHeaders } from '@/lib/api-auth'
import TabBar from '@/components/ui/TabBar'

const CATEGORIES = ['Food','Transport','Social','Home','Family','Shopping','Health','Education','Entertainment','Other']
const EMOJIS: Record<string,string> = {Food:'🍔',Transport:'🚕',Social:'👥',Home:'��',Family:'❤️',Shopping:'🛍️',Health:'💊',Education:'🎓',Entertainment:'🎬',Other:'📌'}

interface Tx { date:string; description:string; amount:number; category:string; selected:boolean }

export default function UploadPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const receiptRef = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<'statement'|'receipt'>('statement')
  const [txs, setTxs] = useState<Tx[]>([])
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [currency, setCurrency] = useState('SGD')
  const [receiptScanning, setReceiptScanning] = useState(false)
  const [receiptResult, setReceiptResult] = useState<{amount:number|null;merchant:string;category:string}|null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string|null>(null)
  const [receiptDone, setReceiptDone] = useState(false)
  const [detectedFormat, setDetectedFormat] = useState<BankFormat | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParsing(true); setError(''); setTxs([]); setDetectedFormat(null)
    try {
      const text = await file.text()
      const { transactions: parsed, format } = parseBankStatement(text)
      setDetectedFormat(format)
      if (!parsed.length) { setError('Could not read transactions. Make sure it is a CSV file from your bank.'); setParsing(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: p } = await supabase.from('profiles').select('primary_currency').eq('id', user.id).single()
        if (p) setCurrency(p.primary_currency || 'SGD')
      }
      const res = await fetch('/api/parse-statement', { method:'POST', headers: await getAuthHeaders(), body: JSON.stringify({ transactions: parsed }) })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to categorize transactions. Please try again.')
        setParsing(false)
        return
      }
      const { categorized } = data
      setTxs(parsed.map((t,i) => {
        const c = categorized?.find((x:any) => x.index === i)
        return { ...t, category: c?.category || 'Other', description: c?.description || t.description, selected: true }
      }))
    } catch { setError('Could not read this file.') }
    finally { setParsing(false) }
  }

  const handleSave = async () => {
    const sel = txs.filter(t => t.selected)
    if (!sel.length) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('budget_entries').insert(sel.map(t => ({
        user_id: user.id, category: t.category, amount: t.amount,
        description: t.description, entry_date: t.date || new Date().toISOString().split('T')[0], logged_via: 'statement'
      })))
      setSaved(true)
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const handleReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptScanning(true); setReceiptResult(null); setReceiptDone(false)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setReceiptPreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      try {
        const res = await fetch('/api/scan-receipt', { method:'POST', headers: await getAuthHeaders(), body: JSON.stringify({ imageBase64: base64 }) })
        setReceiptResult(await res.json())
      } catch { setReceiptResult({ amount: null, merchant: 'Could not read', category: 'Other' }) }
      finally { setReceiptScanning(false) }
    }
    reader.readAsDataURL(file)
  }

  const handleSaveReceipt = async () => {
    if (!receiptResult?.amount) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('budget_entries').insert({
        user_id: user.id, category: receiptResult.category, amount: receiptResult.amount,
        description: receiptResult.merchant, entry_date: new Date().toISOString().split('T')[0], logged_via: 'receipt'
      })
      setReceiptDone(true)
    } catch (err: any) { setError(err.message) }
    finally { setSaving(false) }
  }

  const sel = txs.filter(t => t.selected)

  return (
    <div className="min-h-dvh bg-cream pb-24">
      <div className="px-5 pt-12 pb-4">
        <h1 className="font-fraunces text-2xl font-semibold text-ink mb-1">Import transactions</h1>
        <p className="text-ink-3 text-sm">Bank statement or receipt scan</p>
      </div>
      <div className="px-5 mb-5">
        <div className="flex bg-white rounded-2xl p-1 shadow-sm">
          {(['statement','receipt'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${tab===t?'bg-saffron text-white':'text-ink-3'}`}>
              {t==='statement'?'📄 Bank statement':'📷 Receipt scan'}
            </button>
          ))}
        </div>
      </div>
      <div className="px-5">
        {tab==='statement' && (
          <>
            {!txs.length && !parsing && !saved && (
              <>
                <div onClick={() => fileRef.current?.click()}
                  className="card border-2 border-dashed border-saffron/30 text-center py-10 cursor-pointer active:bg-saffron-soft">
                  <p className="text-4xl mb-3">📄</p>
                  <p className="font-medium text-ink mb-1">Upload CSV statement</p>
                  <p className="text-ink-3 text-sm mb-3">Exported from your bank app</p>
                  <span className="text-saffron text-sm font-medium">Choose file →</span>
                </div>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
                {error && <div className="mt-3 bg-red-50 text-danger text-sm px-4 py-3 rounded-xl">{error}</div>}
              </>
            )}
            {parsing && <div className="card text-center py-10"><div className="w-8 h-8 border-2 border-saffron border-t-transparent rounded-full animate-spin mx-auto mb-3"/><p className="text-ink-3 text-sm">Categorising transactions...</p></div>}
            {saved && <div className="card text-center py-10"><p className="text-4xl mb-3">✅</p><p className="font-fraunces text-xl font-semibold text-ink mb-1">{sel.length} transactions saved</p><button onClick={() => router.push('/home')} className="btn-primary mt-4">Back to home</button></div>}
            {txs.length > 0 && !saved && (
              <>
                {detectedFormat && (
                  <p className="text-xs text-ink-3 mb-3">
                    Detected format: <span className="font-medium text-ink">{formatBankLabel(detectedFormat)}</span>
                  </p>
                )}
                <div className="flex justify-between mb-3"><p className="text-sm font-medium text-ink">{sel.length} of {txs.length} selected</p><p className="text-sm text-saffron font-semibold">{formatCurrency(sel.reduce((s,t)=>s+t.amount,0),currency)}</p></div>
                <div className="flex flex-col gap-2 mb-4">
                  {txs.map((t,i) => (
                    <div key={i} className={`bg-white rounded-2xl p-3 shadow-sm ${!t.selected?'opacity-40':''}`}>
                      <div className="flex items-start gap-3">
                        <button onClick={() => setTxs(p=>p.map((x,j)=>j===i?{...x,selected:!x.selected}:x))}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${t.selected?'bg-saffron border-saffron':'border-gray-300'}`}>
                          {t.selected && <span className="text-white text-xs">✓</span>}
                        </button>
                        <div className="flex-1">
                          <div className="flex justify-between gap-2"><p className="text-sm font-medium text-ink truncate">{t.description}</p><p className="text-sm font-semibold flex-shrink-0">{formatCurrency(t.amount,currency)}</p></div>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-xs text-ink-3">{t.date}</p>
                            <select value={t.category} onChange={e=>setTxs(p=>p.map((x,j)=>j===i?{...x,category:e.target.value}:x))}
                              className="text-xs bg-cream rounded-lg px-2 py-1 outline-none">
                              {CATEGORIES.map(c=><option key={c} value={c}>{EMOJIS[c]} {c}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={handleSave} className="btn-primary" disabled={saving||!sel.length}>
                  {saving?<span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>:`Save ${sel.length} transactions`}
                </button>
                <button onClick={()=>{setTxs([]);setError('');setDetectedFormat(null)}} className="btn-secondary mt-3">Upload different file</button>
              </>
            )}
          </>
        )}
        {tab==='receipt' && (
          <>
            {!receiptPreview && (
              <>
                <div onClick={()=>receiptRef.current?.click()}
                  className="card border-2 border-dashed border-saffron/30 text-center py-10 cursor-pointer active:bg-saffron-soft">
                  <p className="text-4xl mb-3">📷</p>
                  <p className="font-medium text-ink mb-1">Scan a receipt</p>
                  <p className="text-ink-3 text-sm mb-3">Take a photo or upload from camera roll</p>
                  <span className="text-saffron text-sm font-medium">Open camera →</span>
                </div>
                <input ref={receiptRef} type="file" accept="image/*" capture="environment" onChange={handleReceipt} className="hidden" />
              </>
            )}
            {receiptPreview && (
              <>
                <img src={receiptPreview} alt="Receipt" className="w-full max-h-48 object-cover rounded-2xl mb-4"/>
                {receiptScanning && <div className="card text-center py-6"><div className="w-6 h-6 border-2 border-saffron border-t-transparent rounded-full animate-spin mx-auto mb-2"/><p className="text-sm text-ink-3">Reading receipt...</p></div>}
                {receiptResult && !receiptScanning && !receiptDone && (
                  <div className="card mb-4">
                    <p className="text-xs font-medium text-ink-3 uppercase tracking-wide mb-3">Sarathy found this</p>
                    <div className="flex flex-col gap-3">
                      <div><p className="text-xs text-ink-3 mb-1">Amount</p><p className="font-fraunces text-2xl font-semibold">{receiptResult.amount?formatCurrency(receiptResult.amount,currency):'Could not read'}</p></div>
                      <div><p className="text-xs text-ink-3 mb-1">Merchant</p><p className="font-medium">{receiptResult.merchant}</p></div>
                      <div><p className="text-xs text-ink-3 mb-1">Category</p>
                        <select value={receiptResult.category} onChange={e=>setReceiptResult(p=>p?{...p,category:e.target.value}:p)} className="input-field">
                          {CATEGORIES.map(c=><option key={c} value={c}>{EMOJIS[c]} {c}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
                {receiptDone && <div className="card text-center py-8 mb-4"><p className="text-3xl mb-2">✅</p><p className="font-medium">Receipt saved!</p></div>}
                {error && <div className="bg-red-50 text-danger text-sm px-4 py-3 rounded-xl mb-4">{error}</div>}
                {!receiptDone && receiptResult && !receiptScanning && (
                  <button onClick={handleSaveReceipt} className="btn-primary mb-3" disabled={saving||!receiptResult.amount}>
                    {saving?<span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>:'Save this expense'}
                  </button>
                )}
                <button onClick={()=>{setReceiptPreview(null);setReceiptResult(null);setReceiptDone(false);setError('')}} className="btn-secondary">
                  {receiptDone?'Scan another':'Try different photo'}
                </button>
                {receiptDone && <button onClick={()=>router.push('/home')} className="btn-primary mt-3">Back to home</button>}
              </>
            )}
          </>
        )}
      </div>
      <TabBar active="home"/>
    </div>
  )
}
