import { useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { supabase } from './supabaseClient'
import type { ChatMessage, LedgerEntry, Member, MonthPayment, Role, Tab } from './types'

const MOTTO =
  'Small hands joined together can lift the heaviest burdens — in friendship, no contribution is ever too small.'

const CREDENTIALS: Record<string, { password: string; role: Role }> = {
  treasurer: { password: 'boss2026', role: 'treasurer' },
  member: { password: 'member123', role: 'member' }
}

// ---------------- Helpers ----------------

function getCurrentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function compressImage(file: File, maxDim = 900, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject('no canvas context')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ---------------- Keyboard-aware viewport hook ----------------

function useViewportHeight() {
  const [vh, setVh] = useState<number>(window.innerHeight)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const handler = () => setVh(vv.height)
    vv.addEventListener('resize', handler)
    handler()
    return () => vv.removeEventListener('resize', handler)
  }, [])
  return vh
}

// ---------------- Login ----------------

function Login({ onLogin }: { onLogin: (username: string, role: Role) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const uname = username.trim().toLowerCase()
    const cred = CREDENTIALS[uname]
    if (cred && cred.password === password) {
      setError('')
      onLogin(uname, cred.role)
    } else {
      setError('Incorrect username or password')
    }
  }

  return (
    <div className="login-screen">
      <img src="/icon.png" alt="Month-End Njangi" />
      <h2>Month-End Njangi</h2>
      <p className="motto">{MOTTO}</p>
      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="login-error">{error}</div>}
        <button type="submit">Log In</button>
      </form>
    </div>
  )
}

// ---------------- Home Tab ----------------

function HomeTab({ role }: { role: Role }) {
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey())
  const [members, setMembers] = useState<Member[]>([])
  const [payments, setPayments] = useState<MonthPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [monthKey])

  async function loadData() {
    setLoading(true)
    const { data: membersData } = await supabase.from('members').select('*').order('id')
    const { data: paymentsData } = await supabase
      .from('month_payments')
      .select('*')
      .eq('month_key', monthKey)
    setMembers(membersData || [])
    setPayments(paymentsData || [])
    setLoading(false)
  }

  function isPaid(memberId: number): boolean {
    return payments.find((p) => p.member_id === memberId)?.paid ?? false
  }

  async function togglePaid(memberId: number) {
    if (role !== 'treasurer') return
    const existing = payments.find((p) => p.member_id === memberId)
    if (existing) {
      const { error } = await supabase
        .from('month_payments')
        .update({ paid: !existing.paid })
        .eq('id', existing.id)
      if (!error) {
        setPayments((prev) =>
          prev.map((p) => (p.id === existing.id ? { ...p, paid: !p.paid } : p))
        )
      }
    } else {
      const { data, error } = await supabase
        .from('month_payments')
        .insert({ member_id: memberId, month_key: monthKey, paid: true })
        .select()
        .single()
      if (!error && data) {
        setPayments((prev) => [...prev, data])
      }
    }
  }

  function exportReceipt() {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Month-End Njangi', 14, 18)
    doc.setFontSize(11)
    doc.text(`Payment Receipt — ${formatMonthLabel(monthKey)}`, 14, 26)
    doc.setLineWidth(0.5)
    doc.line(14, 30, 196, 30)

    let y = 40
    doc.setFontSize(10)
    doc.text('Member', 14, y)
    doc.text('Status', 160, y)
    y += 6
    doc.line(14, y - 2, 196, y - 2)

    members.forEach((m) => {
      const paid = isPaid(m.id)
      doc.text(m.name, 14, y)
      doc.text(paid ? 'PAID' : 'UNPAID', 160, y)
      y += 8
    })

    y += 10
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(MOTTO, 14, y, { maxWidth: 180 })

    doc.save(`Njangi-Receipt-${monthKey}.pdf`)
  }

  const paidCount = members.filter((m) => isPaid(m.id)).length

  return (
    <div>
      <div className="month-nav">
        <button onClick={() => setMonthKey((k) => shiftMonthKey(k, -1))}>‹</button>
        <div className="month-label">{formatMonthLabel(monthKey)}</div>
        <button onClick={() => setMonthKey((k) => shiftMonthKey(k, 1))}>›</button>
      </div>

      <div className="card">
        <strong>
          {paidCount} / {members.length} paid this month
        </strong>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-state">Loading members…</div>
        ) : members.length === 0 ? (
          <div className="empty-state">No members yet.</div>
        ) : (
          members.map((m) => (
            <div className="member-row" key={m.id}>
              <span className="member-name">{m.name}</span>
              <button
                className={`pay-toggle ${isPaid(m.id) ? 'paid' : 'unpaid'}`}
                onClick={() => togglePaid(m.id)}
                disabled={role !== 'treasurer'}
              >
                {isPaid(m.id) ? 'Paid' : 'Unpaid'}
              </button>
            </div>
          ))
        )}
      </div>

      <button className="export-btn" onClick={exportReceipt}>
        📄 Export PDF Receipt
      </button>

      <div className="motto-footer">{MOTTO}</div>
    </div>
  )
}

// ---------------- Members Tab ----------------

function MembersTab({ role }: { role: Role }) {
  const [members, setMembers] = useState<Member[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('members').select('*').order('id')
    setMembers(data || [])
    setLoading(false)
  }

  async function addMember() {
    const name = newName.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('members')
      .insert({ name, paid: false })
      .select()
      .single()
    if (!error && data) {
      setMembers((prev) => [...prev, data])
      setNewName('')
    }
  }

  async function removeMember(id: number) {
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (!error) setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  async function saveRename(id: number) {
    const name = editName.trim()
    if (!name) return
    const { error } = await supabase.from('members').update({ name }).eq('id', id)
    if (!error) {
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)))
      setEditingId(null)
    }
  }

  return (
    <div>
      {role === 'treasurer' && (
        <div className="add-member-row">
          <input
            type="text"
            placeholder="New member name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMember()}
          />
          <button onClick={addMember}>Add</button>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading-state">Loading…</div>
        ) : members.length === 0 ? (
          <div className="empty-state">No members yet.</div>
        ) : (
          members.map((m) => (
            <div className="member-row" key={m.id}>
              {editingId === m.id ? (
                <>
                  <input
                    style={{ flex: 1, marginRight: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                  />
                  <button className="icon-btn" onClick={() => saveRename(m.id)}>
                    ✅
                  </button>
                </>
              ) : (
                <>
                  <span className="member-name">{m.name}</span>
                  {role === 'treasurer' && (
                    <div>
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setEditingId(m.id)
                          setEditName(m.name)
                        }}
                      >
                        ✏️
                      </button>
                      <button className="icon-btn danger" onClick={() => removeMember(m.id)}>
                        🗑️
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------- Schedule Tab ----------------

function ScheduleTab() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('ledger').select('*').order('month_key')
    setLedger(data || [])
    setLoading(false)
  }

  const today = getCurrentMonthKey()
  const upcoming = ledger.filter((l) => l.month_key >= today)

  return (
    <div>
      <div className="card">
        <strong>Upcoming Payout Order</strong>
      </div>
      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : upcoming.length === 0 ? (
        <div className="empty-state">No upcoming payouts scheduled.</div>
      ) : (
        upcoming.map((entry, i) => (
          <div className="schedule-item" key={entry.id}>
            <div className="schedule-badge">{i + 1}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{entry.beneficiary}</div>
              <div style={{ fontSize: '0.75em', color: '#64748b' }}>
                {formatMonthLabel(entry.month_key)}
                {entry.notes ? ` — ${entry.notes}` : ''}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ---------------- Chat Tab ----------------

function ChatTab({ username, role }: { username: string; role: Role }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [text, setText] = useState('')
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const vh = useViewportHeight()

  useEffect(() => {
    load()
    const channel = supabase
      .channel('chat_messages_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage])
        }
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (messages.length && navigator.serviceWorker?.controller) {
      const lastId = Math.max(...messages.map((m) => m.id))
      navigator.serviceWorker.controller.postMessage({
        type: 'SYNC_LAST_SEEN_ID',
        lastSeenId: lastId
      })
    }
  }, [messages])

  async function load() {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages(data || [])
  }

  async function sendMessage() {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    await supabase.from('chat_messages').insert({
      sender: username,
      role,
      message: trimmed,
      image_b64: null
    })
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    await supabase.from('chat_messages').insert({
      sender: username,
      role,
      message: null,
      image_b64: compressed
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="chat-wrapper" style={{ height: vh ? vh - 130 : '100%' }}>
      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.sender === username ? 'mine' : 'theirs'}`}>
            {m.sender !== username && <div className="chat-sender">{m.sender}</div>}
            {m.message && <div>{m.message}</div>}
            {m.image_b64 && (
              <img src={m.image_b64} alt="attachment" onClick={() => setZoomImage(m.image_b64)} />
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-bar">
        <button className="attach-btn" onClick={() => fileInputRef.current?.click()}>
          📷
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <input
          type="text"
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>➤</button>
      </div>

      {zoomImage && (
        <div className="zoom-overlay" onClick={() => setZoomImage(null)}>
          <img src={zoomImage} alt="zoomed" />
        </div>
      )}
    </div>
  )
}

// ---------------- Ledger Tab ----------------

function LedgerTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [newMonth, setNewMonth] = useState(getCurrentMonthKey())
  const [newBeneficiary, setNewBeneficiary] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('ledger').select('*').order('month_key')
    setEntries(data || [])
    setLoading(false)
  }

  async function addEntry() {
    if (!newBeneficiary.trim()) return
    const { data, error } = await supabase
      .from('ledger')
      .upsert({ month_key: newMonth, beneficiary: newBeneficiary.trim(), notes: null }, { onConflict: 'month_key' })
      .select()
      .single()
    if (!error && data) {
      setEntries((prev) => {
        const filtered = prev.filter((e) => e.month_key !== newMonth)
        return [...filtered, data].sort((a, b) => a.month_key.localeCompare(b.month_key))
      })
      setNewBeneficiary('')
    }
  }

  async function updateNotes(id: number, notes: string) {
    await supabase.from('ledger').update({ notes }).eq('id', id)
  }

  async function removeEntry(id: number) {
    const { error } = await supabase.from('ledger').delete().eq('id', id)
    if (!error) setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  return (
    <div>
      <div className="card">
        <strong>Schedule a Beneficiary</strong>
        <div className="add-member-row" style={{ marginTop: 10 }}>
          <input
            type="month"
            value={newMonth}
            onChange={(e) => setNewMonth(e.target.value)}
            style={{ width: 140 }}
          />
          <input
            type="text"
            placeholder="Beneficiary name"
            value={newBeneficiary}
            onChange={(e) => setNewBeneficiary(e.target.value)}
          />
          <button onClick={addEntry}>Set</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">No ledger entries yet.</div>
      ) : (
        entries.map((entry) => (
          <div className="ledger-item" key={entry.id}>
            <div className="month">{entry.month_key}</div>
            <input
              type="text"
              defaultValue={entry.notes || ''}
              placeholder="Notes…"
              onBlur={(e) => updateNotes(entry.id, e.target.value)}
            />
            <button className="icon-btn danger" onClick={() => removeEntry(entry.id)}>
              🗑️
            </button>
          </div>
        ))
      )}
    </div>
  )
}

// ---------------- App Shell ----------------

export default function App() {
  const [username, setUsername] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [tab, setTab] = useState<Tab>('home')

  useEffect(() => {
    const savedUser = localStorage.getItem('njangi_username')
    const savedRole = localStorage.getItem('njangi_role') as Role | null
    if (savedUser && savedRole) {
      setUsername(savedUser)
      setRole(savedRole)
    }
  }, [])

  useEffect(() => {
    if (username && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [username])

  function handleLogin(u: string, r: Role) {
    localStorage.setItem('njangi_username', u)
    localStorage.setItem('njangi_role', r)
    setUsername(u)
    setRole(r)
  }

  function handleLogout() {
    localStorage.removeItem('njangi_username')
    localStorage.removeItem('njangi_role')
    setUsername(null)
    setRole(null)
    setTab('home')
  }

  const tabs = useMemo(() => {
    const base: { key: Tab; label: string; icon: string }[] = [
      { key: 'home', label: 'Home', icon: '🏠' },
      { key: 'members', label: 'Members', icon: '👥' },
      { key: 'schedule', label: 'Schedule', icon: '📅' },
      { key: 'chat', label: 'Chat', icon: '💬' }
    ]
    if (role === 'treasurer') {
      base.push({ key: 'ledger', label: 'Ledger', icon: '📒' })
    }
    return base
  }, [role])

  if (!username || !role) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="app-shell">
      <div className="app-header">
        <div className="title-block">
          <img src="/icon.png" alt="Njangi" />
          <h1>Month-End Njangi</h1>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          Log Out
        </button>
      </div>

      <div className="tab-content">
        {tab === 'home' && <HomeTab role={role} />}
        {tab === 'members' && <MembersTab role={role} />}
        {tab === 'schedule' && <ScheduleTab />}
        {tab === 'chat' && <ChatTab username={username} role={role} />}
        {tab === 'ledger' && role === 'treasurer' && <LedgerTab />}
      </div>

      <div className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className="icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
