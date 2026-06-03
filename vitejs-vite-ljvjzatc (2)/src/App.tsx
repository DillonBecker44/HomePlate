import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { useState, useEffect } from 'react'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
function OrderCountdown({ expiresAt, onExpire }: { expiresAt: string, onExpire: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    return Math.max(0, diff)
  })

  useEffect(() => {
    if (secondsLeft <= 0) { onExpire(); return }
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) { clearInterval(interval); onExpire(); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const urgent = secondsLeft < 120

  return (
    <div style={{ background: urgent ? '#FCEBEB' : '#FEF3C7', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '13px', color: urgent ? '#A32D2D' : '#92400E' }}>Time to respond</span>
      <span style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', fontWeight: 700, color: urgent ? '#A32D2D' : '#92400E' }}>
        {mins}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  )
}
export default function App() {
  const [session, setSession] = useState<any>(null)
  const [screen, setScreen] = useState('home')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('customer')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [chefProfile, setChefProfile] = useState<any>(null)
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [portalTab, setPortalTab] = useState('dashboard')
  const [incomingOrders, setIncomingOrders] = useState<any[]>([])
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [chefs, setChefs] = useState<any[]>([])
  const [chefSearch, setChefSearch] = useState('')
  const [selectedChef, setSelectedChef] = useState<any>(null)
  const [selectedChefMenu, setSelectedChefMenu] = useState<any[]>([])
  const [cart, setCart] = useState<{[key: string]: number}>({})
  const [kitchenName, setKitchenName] = useState('')
  const [bio, setBio] = useState('')
  const [address, setAddress] = useState('')
  const [zip, setZip] = useState('')
  const [cuisines, setCuisines] = useState<string[]>([])
  const [attestation, setAttestation] = useState(false)
  const [showMenuForm, setShowMenuForm] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [itemName, setItemName] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [paymentReady, setPaymentReady] = useState(false)

  useEffect(() => {
    loadChefs()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setSession(session); loadProfile(session) }
    })
  }, [])

  async function loadChefs() {
    const { data } = await supabase
      .from('chef_profiles')
      .select('id, kitchen_name, bio, cuisine_types, city, is_open, rating, review_count, address_line')
    if (data) setChefs(data)
  }

  async function loadProfile(sess: any) {
    let prof = null
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase.from('profiles').select('*').eq('id', sess.user.id).single()
      if (data) { prof = data; break }
      await new Promise(r => setTimeout(r, 400))
    }
    if (!prof) { setMessage('Could not load profile. Try signing in again.'); setIsError(true); return }
    setProfile(prof)
    if (prof.role === 'chef') {
      const { data: chef } = await supabase.from('chef_profiles').select('*').eq('id', sess.user.id).single()
      if (chef) { setChefProfile(chef); loadMenuItems(sess.user.id); loadOrders(sess.user.id); setScreen('chef-portal') }
      else setScreen('chef-onboarding')
    } else {
      setScreen('browse')
    }
  }

  async function loadMenuItems(chefId: string) {
    const { data } = await supabase.from('menu_items').select('*').eq('chef_id', chefId).order('sort_order')
    if (data) setMenuItems(data)
  }
async function loadOrders(chefId: string) {
    const { data: pending } = await supabase
      .from('orders')
      .select(`*, profiles(full_name)`)
      .eq('chef_id', chefId)
      .eq('status', 'pending')
      .order('placed_at', { ascending: false })
    if (pending) setIncomingOrders(pending)

    const { data: active } = await supabase
      .from('orders')
      .select(`*, profiles(full_name)`)
      .eq('chef_id', chefId)
      .in('status', ['accepted', 'ready'])
      .order('placed_at', { ascending: false })
    if (active) setActiveOrders(active)
  }

  async function acceptOrder(orderId: string) {
    await supabase.from('orders').update({
      status: 'accepted',
      accepted_at: new Date().toISOString()
    }).eq('id', orderId)
    await loadOrders(session.user.id)
  }

  async function declineOrder(orderId: string) {
    await supabase.from('orders').update({ status: 'declined' }).eq('id', orderId)
    await loadOrders(session.user.id)
  }

  async function markReady(orderId: string) {
    await supabase.from('orders').update({
      status: 'ready',
      ready_at: new Date().toISOString()
    }).eq('id', orderId)
    await loadOrders(session.user.id)
  }
  async function openChef(chef: any) {
    const { data: freshChef } = await supabase
      .from('chef_profiles')
      .select('*')
      .eq('id', chef.id)
      .single()
    const { data } = await supabase
      .from('menu_items').select('*')
      .eq('chef_id', chef.id)
      .eq('is_available', true)
      .order('sort_order')
    setSelectedChef(freshChef || chef)
    setSelectedChefMenu(data || [])
    setCart({})
    setScreen('chef-menu')
  }

  async function signUp() {
    setLoading(true); setMessage(''); setIsError(false)
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, role } } })
    if (error) { setMessage(error.message); setIsError(true); setLoading(false); return }
    if (data?.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, role, full_name: name })
      setSession(data.session)
      await loadProfile(data.session || { user: data.user })
    }
    setLoading(false)
  }

  async function signIn() {
    setLoading(true); setMessage(''); setIsError(false)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setMessage(error.message); setIsError(true); return }
      setSession(data.session)
      await loadProfile(data.session)
    } catch (e: any) {
      setMessage(e.message || 'Sign in failed')
      setIsError(true)
    }
    setLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSession(null); setProfile(null); setChefProfile(null); setMenuItems([]); setScreen('home')
  }

  async function saveChefProfile() {
    if (!kitchenName || !address || !zip) { setMessage('Please fill in kitchen name, address and ZIP'); setIsError(true); return }
    if (!attestation) { setMessage('You must confirm Texas cottage food compliance'); setIsError(true); return }
    setLoading(true); setMessage(''); setIsError(false)
    const { error } = await supabase.from('chef_profiles').insert({
      id: session.user.id, kitchen_name: kitchenName, bio, address_line: address, zip,
      cuisine_types: cuisines, cottage_food_attestation: true,
      cottage_food_attested_at: new Date().toISOString(), is_open: false,
    })
    if (error) { setMessage(error.message); setIsError(true); setLoading(false); return }
    const { data: chef } = await supabase.from('chef_profiles').select('*').eq('id', session.user.id).single()
    setChefProfile(chef); setScreen('chef-portal'); setLoading(false)
  }

  async function toggleOpen() {
    const newVal = !chefProfile.is_open
    await supabase.from('chef_profiles').update({ is_open: newVal }).eq('id', session.user.id)
    setChefProfile({ ...chefProfile, is_open: newVal })
    loadChefs()
  }

  function openNewItemForm() {
    setEditingItem(null); setItemName(''); setItemDesc(''); setItemPrice('')
    setShowMenuForm(true)
  }

  function openEditItemForm(item: any) {
    setEditingItem(item); setItemName(item.name); setItemDesc(item.description || ''); setItemPrice(String(item.price))
    setShowMenuForm(true)
  }

  async function saveMenuItem() {
    if (!itemName || !itemPrice) { setMessage('Name and price are required'); setIsError(true); return }
    const price = parseFloat(itemPrice)
    if (isNaN(price) || price <= 0) { setMessage('Please enter a valid price'); setIsError(true); return }
    setLoading(true); setMessage(''); setIsError(false)
    if (editingItem) {
      await supabase.from('menu_items').update({ name: itemName, description: itemDesc, price }).eq('id', editingItem.id)
    } else {
      await supabase.from('menu_items').insert({
        chef_id: session.user.id, name: itemName, description: itemDesc,
        price, sort_order: menuItems.length
      })
    }
    await loadMenuItems(session.user.id)
    setShowMenuForm(false); setLoading(false)
  }

  async function toggleItemAvailability(item: any) {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    await loadMenuItems(session.user.id)
  }

  async function deleteMenuItem(id: string) {
    await supabase.from('menu_items').delete().eq('id', id)
    await loadMenuItems(session.user.id)
  }

  function toggleCuisine(c: string) {
    setCuisines(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

async function placeOrder() {
    setLoading(true); setMessage(''); setIsError(false); setPaymentReady(false)
    try {
      const total = cartTotal().total
      const { data: { session: currentSession } } = await supabase.auth.getSession()

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ amount: total })
      })

      const { clientSecret, error } = await res.json()
      if (error) { setMessage(error); setIsError(true); setLoading(false); return }

      const stripe = await new Promise<any>((resolve, reject) => {
        const existing = document.querySelector('script[src="https://js.stripe.com/v3/"]')
        if (existing && (window as any).Stripe) {
          resolve((window as any).Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY))
          return
        }
        const script = document.createElement('script')
        script.src = 'https://js.stripe.com/v3/'
        script.onload = () => resolve((window as any).Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY))
        script.onerror = () => reject(new Error('Failed to load Stripe'))
        document.head.appendChild(script)
      })

      if (!stripe) { setMessage('Could not load payment processor'); setIsError(true); setLoading(false); return }

      const elements = stripe.elements({ clientSecret })
      const paymentElement = elements.create('payment')

      // Mount payment element
      const container = document.getElementById('payment-element-container')
      if (container) {
        container.innerHTML = ''
        paymentElement.on('ready', () => setPaymentReady(true))
paymentElement.mount('#payment-element-container')
        setLoading(false)
        setMessage('Enter your card details below and click Pay')
        setIsError(false)

        // Store for submission
        ;(window as any)._stripeElements = elements
        ;(window as any)._stripe = stripe
      }
    } catch (e: any) {
      setMessage(e.message || 'Something went wrong')
      setIsError(true)
      setLoading(false)
    }
  }

  async function submitPayment() {
    setLoading(true); setMessage(''); setIsError(false)
    try {
      const stripe = (window as any)._stripe
      const elements = (window as any)._stripeElements
      if (!stripe || !elements) { setMessage('Please click Place Order first'); setIsError(true); setLoading(false); return }

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required'
      })

      if (error) {
        setMessage(error.message || 'Payment failed')
        setIsError(true)
      } else {
        // Save order to database
        const subtotal = cartTotal().subtotal
        const fee = cartTotal().fee
        const total = cartTotal().total

        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            customer_id: session.user.id,
            chef_id: selectedChef.id,
            status: 'pending',
            subtotal,
            platform_fee: fee,
            total,
            chef_payout: subtotal * 0.90,
            placed_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          })
          .select()
          .single()

        if (orderError) {
          console.error('Order save error:', orderError)
        } else {
          // Save order items
          const orderItems = Object.entries(cart).map(([id, qty]) => {
            const item = selectedChefMenu.find(i => i.id === id)
            return {
              order_id: order.id,
              menu_item_id: id,
              name: item.name,
              price: item.price,
              quantity: qty,
              subtotal: item.price * (qty as number)
            }
          })
          await supabase.from('order_items').insert(orderItems)
        }

        setCart({})
        setScreen('order-confirmed')
      }
    } catch (e: any) {
      setMessage(e.message || 'Payment failed')
      setIsError(true)
    }
    setLoading(false)
  }
  const cartTotal = () => {
    const subtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
      const item = selectedChefMenu.find(i => i.id === id)
      return sum + (item ? item.price * (qty as number) : 0)
    }, 0)
    return { subtotal, fee: subtotal * 0.10, total: subtotal * 1.10 }
  }

  const cuisineOptions = ['Mexican', 'Tex-Mex', 'BBQ', 'Soul Food', 'Asian', 'Indian', 'Vegan', 'Baked Goods', 'Southern', 'Italian']

  // Styles
  const pg: any = { fontFamily: 'DM Sans, sans-serif', background: '#FDF8F2', minHeight: '100vh' }
  const navS: any = { background: '#fff', borderBottom: '1px solid #E8DDD4', padding: '0 20px', height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }
  const logo: any = { fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#2C1A0E', fontWeight: 700, cursor: 'pointer' }
  const card: any = { background: '#fff', borderRadius: '14px', border: '1px solid #E8DDD4', padding: '28px', maxWidth: '440px', margin: '32px auto' }
  const inp: any = { width: '100%', padding: '11px 14px', borderRadius: '8px', border: '1px solid #E8DDD4', fontSize: '14px', marginBottom: '12px', fontFamily: 'DM Sans, sans-serif', outline: 'none', boxSizing: 'border-box' }
  const ta: any = { ...inp, resize: 'vertical', minHeight: '80px' }
  const btn: any = { width: '100%', padding: '13px', borderRadius: '99px', border: 'none', background: '#C4622D', color: '#fff', fontSize: '15px', fontWeight: 500, cursor: 'pointer', marginBottom: '10px', fontFamily: 'DM Sans, sans-serif' }
  const btnO: any = { width: '100%', padding: '12px', borderRadius: '99px', border: '1.5px solid #E8DDD4', background: 'transparent', color: '#2C1A0E', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }
  const lbl: any = { fontSize: '12px', fontWeight: 500, color: '#6B6560', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '.05em' }
  const msgBox = (err: boolean): any => ({ fontSize: '13px', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', textAlign: 'center', background: err ? '#FCEBEB' : '#EAF0E0', color: err ? '#A32D2D' : '#2D5016' })
  const roleBtn = (r: string): any => ({ flex: 1, padding: '10px', borderRadius: '8px', border: `1.5px solid ${role === r ? '#C4622D' : '#E8DDD4'}`, background: role === r ? '#F0E4D8' : '#fff', color: role === r ? '#C4622D' : '#6B6560', cursor: 'pointer', fontSize: '13px', fontFamily: 'DM Sans, sans-serif' })
  const cBtn = (active: boolean): any => ({ padding: '7px 14px', borderRadius: '99px', border: `1.5px solid ${active ? '#C4622D' : '#E8DDD4'}`, background: active ? '#F0E4D8' : '#fff', color: active ? '#C4622D' : '#6B6560', cursor: 'pointer', fontSize: '12px', fontFamily: 'DM Sans, sans-serif' })
  const badge = (open: boolean): any => ({ fontSize: '10px', fontWeight: 500, padding: '3px 8px', borderRadius: '99px', background: open ? '#EAF0E0' : '#F3F4F6', color: open ? '#2D5016' : '#6B7280' })
  const tabS = (active: boolean): any => ({ padding: '12px 18px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: active ? '#C4622D' : '#6B6560', background: 'none', border: 'none', borderBottom: active ? '2px solid #C4622D' : '2px solid transparent', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' })

  return (
    <div style={pg}>
      {/* NAV */}
      <nav style={navS}>
        <div style={logo} onClick={() => setScreen('home')}>
          home<span style={{ color: '#C4622D' }}>plate</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {session ? (
            <>
              <span style={{ fontSize: '12px', color: '#6B6560' }}>{profile?.full_name}</span>
              <button style={{ ...btnO, width: 'auto', padding: '7px 16px' }} onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <button style={{ ...btnO, width: 'auto', padding: '7px 14px' }} onClick={() => { setMessage(''); setScreen('signin') }}>Sign in</button>
              <button style={{ ...btn, width: 'auto', padding: '8px 16px', marginBottom: 0 }} onClick={() => { setMessage(''); setScreen('signup') }}>Sign up</button>
            </>
          )}
        </div>
      </nav>

      {/* HOME */}
      {screen === 'home' && (
        <>
          <div style={{ background: '#C4622D', padding: '52px 24px 44px', textAlign: 'center' }}>
            <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: '11px', letterSpacing: '.1em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: '99px', marginBottom: '16px' }}>San Antonio, TX</div>
            <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '36px', color: '#fff', marginBottom: '10px', lineHeight: 1.15 }}>Home-cooked meals,<br />from your <span style={{ color: '#FFE0A3' }}>neighbors</span></h1>
            <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: '15px', marginBottom: '28px' }}>Real food made with love, ready for pickup near you</p>
            <div style={{ background: '#fff', borderRadius: '99px', display: 'flex', alignItems: 'center', maxWidth: '420px', margin: '0 auto', padding: '6px 6px 6px 18px', gap: '8px' }}>
              <input style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: '#2C1A0E', background: 'transparent' }} placeholder="Search cuisine or chef…" />
              <button style={{ background: '#2C1A0E', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: '99px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }} onClick={() => setScreen('browse')}>Find food</button>
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '24px', marginBottom: '20px' }}>How it works</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', maxWidth: '500px', margin: '0 auto 32px' }}>
              {[['🔍', 'Find', 'Browse local home chefs near you'], ['🛒', 'Order', 'Pick dishes and place your order'], ['🥡', 'Pickup', 'Collect your meal fresh and hot']].map(([emoji, title, desc]) => (
                <div key={title as string}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>{emoji}</div>
                  <div style={{ fontWeight: 500, marginBottom: '4px', fontSize: '14px' }}>{title}</div>
                  <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.4 }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button style={{ ...btn, width: 'auto', padding: '12px 28px', marginBottom: 0 }} onClick={() => setScreen('browse')}>Browse chefs</button>
              <button style={{ ...btnO, width: 'auto', padding: '12px 28px' }} onClick={() => { setRole('chef'); setMessage(''); setScreen('signup') }}>Become a chef</button>
            </div>
          </div>
        </>
      )}

      {/* BROWSE */}
      {screen === 'browse' && (
        <>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E8DDD4', background: '#fff', display: 'flex', gap: '8px', overflowX: 'auto' }}>
            <input
              style={{ flex: 1, padding: '8px 14px', borderRadius: '99px', border: '1.5px solid #E8DDD4', fontSize: '13px', outline: 'none', fontFamily: 'DM Sans, sans-serif', minWidth: '200px' }}
              placeholder="Search chefs or cuisine…"
              value={chefSearch}
              onChange={e => setChefSearch(e.target.value)}
            />
            {['Mexican', 'BBQ', 'Vegan', 'Tex-Mex'].map(f => (
              <div key={f} onClick={() => setChefSearch(f)} style={{ border: '1.5px solid #E8DDD4', padding: '6px 16px', borderRadius: '99px', fontSize: '12px', whiteSpace: 'nowrap', cursor: 'pointer', color: '#6B6560', background: '#fff' }}>{f}</div>
            ))}
          </div>
          <div style={{ padding: '14px 20px 6px', fontSize: '11px', letterSpacing: '.08em', textTransform: 'uppercase', color: '#6B6560' }}>
            {chefs.filter(c => c.kitchen_name.toLowerCase().includes(chefSearch.toLowerCase())).length} chefs near you
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', padding: '0 16px 24px' }}>
            {chefs.length === 0 && (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 20px', color: '#6B6560' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🍽️</div>
                <div style={{ fontWeight: 500, marginBottom: '6px', color: '#2C1A0E' }}>No chefs yet</div>
                <div style={{ fontSize: '13px' }}>Be the first to list your kitchen!</div>
              </div>
            )}
            {chefs
              .filter(c => c.kitchen_name.toLowerCase().includes(chefSearch.toLowerCase()) ||
                (c.cuisine_types && c.cuisine_types.some((t: string) => t.toLowerCase().includes(chefSearch.toLowerCase()))))
              .map(chef => (
                <div key={chef.id} onClick={() => openChef(chef)} style={{ background: '#fff', borderRadius: '14px', overflow: 'hidden', border: '1px solid #E8DDD4', cursor: 'pointer' }}>
                  <div style={{ height: '110px', background: '#F0E4D8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '38px' }}>🍽️</div>
                  <div style={{ padding: '12px' }}>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>{chef.kitchen_name}</div>
                    <div style={{ fontSize: '11px', color: '#6B6560', marginBottom: '7px' }}>{chef.cuisine_types?.join(', ') || 'Home cooking'}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#D4A84B' }}>
                        {chef.rating > 0 ? '★'.repeat(Math.round(chef.rating)) : '—'}
                        <span style={{ color: '#6B6560' }}> {chef.review_count || 0}</span>
                      </span>
                      <span style={badge(chef.is_open)}>{chef.is_open ? 'Open' : 'Closed'}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#6B6560', marginTop: '4px' }}>{chef.city}, TX</div>
                  </div>
                </div>
              ))}
          </div>
          {!session && (
            <div style={{ margin: '0 16px 24px', background: '#F0E4D8', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: '#2C1A0E' }}>Ready to order?</div>
              <div style={{ fontSize: '13px', color: '#6B6560', marginBottom: '12px' }}>Create a free account to place orders</div>
              <button style={{ ...btn, width: 'auto', padding: '10px 24px', marginBottom: 0 }} onClick={() => { setRole('customer'); setMessage(''); setScreen('signup') }}>Sign up free</button>
            </div>
          )}
        </>
      )}

      {/* SIGN UP */}
      {screen === 'signup' && (
        <div style={card}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', marginBottom: '4px' }}>Create account</div>
          <div style={{ fontSize: '13px', color: '#6B6560', marginBottom: '20px' }}>Join Homeplate today</div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <button style={roleBtn('customer')} onClick={() => setRole('customer')}>🛒 Customer</button>
            <button style={roleBtn('chef')} onClick={() => setRole('chef')}>👨‍🍳 Chef</button>
          </div>
          <input style={inp} placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
          <input style={inp} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={inp} placeholder="Password (min 6 characters)" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          {message && <div style={msgBox(isError)}>{message}</div>}
          <button style={btn} onClick={signUp} disabled={loading}>{loading ? 'Creating account…' : `Create ${role} account`}</button>
          <button style={btnO} onClick={() => { setMessage(''); setScreen('signin') }}>Already have an account? Sign in</button>
        </div>
      )}

      {/* SIGN IN */}
      {screen === 'signin' && (
        <div style={card}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', marginBottom: '4px' }}>Welcome back</div>
          <div style={{ fontSize: '13px', color: '#6B6560', marginBottom: '20px' }}>Sign in to Homeplate</div>
          <input style={inp} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input style={inp} placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          {message && <div style={msgBox(isError)}>{message}</div>}
          <button style={btn} onClick={signIn} disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
          <button style={btnO} onClick={() => { setMessage(''); setScreen('signup') }}>No account? Sign up free</button>
        </div>
      )}

      {/* CHEF MENU */}
      {screen === 'chef-menu' && selectedChef && (
        <div>
          <div style={{ background: '#C4622D', padding: '20px', position: 'relative' }}>
            <button onClick={() => setScreen('browse')} style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px' }}>←</button>
            <div style={{ textAlign: 'center', paddingTop: '8px' }}>
              <div style={{ fontSize: '48px', marginBottom: '8px' }}>🍽️</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', color: '#fff', fontWeight: 700 }}>{selectedChef.kitchen_name}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>{selectedChef.cuisine_types?.join(', ')}</div>
              <div style={{ marginTop: '10px' }}>
                <span style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '99px', background: selectedChef.is_open ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)', color: '#fff' }}>
                  {selectedChef.is_open ? '🟢 Open now' : '🔴 Closed'}
                </span>
              </div>
            </div>
          </div>
          {selectedChef.bio && (
            <div style={{ padding: '16px 20px', background: '#fff', borderBottom: '1px solid #E8DDD4' }}>
              <div style={{ fontSize: '13px', color: '#6B6560', lineHeight: 1.6 }}>{selectedChef.bio}</div>
            </div>
          )}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', marginBottom: '14px' }}>Menu</div>
            {selectedChefMenu.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px', background: '#fff', borderRadius: '14px', border: '1px solid #E8DDD4', color: '#6B6560' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🍳</div>
                <div style={{ fontSize: '14px' }}>No menu items yet</div>
              </div>
            )}
            {selectedChefMenu.map(item => (
              <div key={item.id} style={{ background: '#fff', border: '1px solid #E8DDD4', borderRadius: '12px', padding: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '4px' }}>{item.name}</div>
                  {item.description && <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.4, marginBottom: '6px' }}>{item.description}</div>}
                  <div style={{ fontSize: '15px', fontWeight: 500, color: '#C4622D' }}>${parseFloat(item.price).toFixed(2)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {cart[item.id] > 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => setCart(prev => { const n = {...prev}; if (n[item.id] > 1) n[item.id]--; else delete n[item.id]; return n })}
                        style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1.5px solid #C4622D', background: '#fff', cursor: 'pointer', fontSize: '18px', color: '#C4622D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >−</button>
                      <span style={{ fontWeight: 600, fontSize: '15px', minWidth: '20px', textAlign: 'center' }}>{cart[item.id]}</span>
                      <button
                        onClick={() => {
                          if (!session) { setScreen('signin'); return }
                          if (!selectedChef.is_open) return
                          setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }))
                        }}
                        style={{ width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: '#C4622D', cursor: 'pointer', fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >+</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (!session) { setScreen('signin'); return }
                        if (!selectedChef.is_open) return
                        setCart(prev => ({ ...prev, [item.id]: 1 }))
                      }}
                      style={{ background: selectedChef.is_open ? '#C4622D' : '#E8DDD4', color: '#fff', border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '20px', cursor: selectedChef.is_open ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >+</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {Object.keys(cart).length > 0 && (
            <div style={{ position: 'sticky', bottom: 0, background: '#2C1A0E', color: '#fff', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setScreen('cart')}>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>
                <span style={{ background: '#C4622D', color: '#fff', width: '22px', height: '22px', borderRadius: '50%', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '8px' }}>
                  {Object.values(cart).reduce((a, b) => a + b, 0)}
                </span>
                View order
              </div>
              <div style={{ background: '#C4622D', padding: '8px 18px', borderRadius: '99px', fontSize: '13px', fontWeight: 500 }}>
                ${cartTotal().total.toFixed(2)} →
              </div>
            </div>
          )}
          {!session && selectedChefMenu.length > 0 && (
            <div style={{ margin: '0 20px 24px', background: '#F0E4D8', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#2C1A0E' }}>Want to order?</div>
              <div style={{ fontSize: '13px', color: '#6B6560', marginBottom: '12px' }}>Sign in or create a free account</div>
              <button style={{ ...btn, width: 'auto', padding: '10px 24px', marginBottom: 0 }} onClick={() => setScreen('signin')}>Sign in to order</button>
            </div>
          )}
        </div>
      )}

      {/* CART */}
      {screen === 'cart' && selectedChef && (
        <div>
          <div style={{ background: '#fff', borderBottom: '1px solid #E8DDD4', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => { setScreen('chef-menu'); setLoading(false); setMessage('') }} style={{ background: '#F0E4D8', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontSize: '16px', color: '#2C1A0E' }}>←</button>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px' }}>Your order</div>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '13px', color: '#6B6560', marginBottom: '14px' }}>from {selectedChef.kitchen_name}</div>
            {Object.entries(cart).map(([id, qty]) => {
              const item = selectedChefMenu.find(i => i.id === id)
              if (!item) return null
              return (
                <div key={id} style={{ background: '#fff', border: '1px solid #E8DDD4', borderRadius: '12px', padding: '14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: '14px' }}>{item.name}</div>
                    <div style={{ fontSize: '13px', color: '#C4622D', marginTop: '3px' }}>${(item.price * (qty as number)).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => setCart(prev => { const n = {...prev}; if (n[id] > 1) n[id]--; else delete n[id]; return n })} style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #E8DDD4', background: '#fff', cursor: 'pointer', fontSize: '16px', color: '#C4622D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontWeight: 500, minWidth: '16px', textAlign: 'center' }}>{qty as number}</span>
                    <button onClick={() => setCart(prev => ({ ...prev, [id]: (prev[id] as number) + 1 }))} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', background: '#C4622D', cursor: 'pointer', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                </div>
              )
            })}
            <div style={{ background: '#fff', border: '1px solid #E8DDD4', borderRadius: '12px', padding: '16px', marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6B6560', marginBottom: '8px' }}>
                <span>Subtotal</span><span>${cartTotal().subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6B6560', marginBottom: '8px' }}>
                <span>Platform fee (10%)</span><span>${cartTotal().fee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 500, color: '#2C1A0E', borderTop: '1px solid #E8DDD4', paddingTop: '10px', marginTop: '4px' }}>
                <span>Total</span><span>${cartTotal().total.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ background: '#F0E4D8', borderRadius: '12px', padding: '14px', marginTop: '14px' }}>
              <div style={{ fontSize: '11px', color: '#C4622D', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: '4px' }}>Pickup from</div>
              <div style={{ fontSize: '13px', color: '#2C1A0E' }}>{selectedChef.kitchen_name} · {selectedChef.address_line}, {selectedChef.city}, TX</div>
            </div>
            {message && <div style={{ ...msgBox(isError), marginTop: '12px' }}>{message}</div>}
            <div id="payment-element-container" style={{ marginBottom: '12px' }}></div>
{!(window as any)._stripeElements ? (
  <button style={{ ...btn, marginTop: '4px' }} onClick={placeOrder} disabled={loading}>
    {loading ? 'Loading payment form…' : `Place order — pay $${cartTotal().total.toFixed(2)}`}
  </button>
) : (
 <button style={{ ...btn, marginTop: '4px' }} onClick={submitPayment} disabled={loading || !paymentReady}>
    {loading ? 'Processing…' : !paymentReady ? 'Loading card form…' : `Pay $${cartTotal().total.toFixed(2)}`}
  </button> 
)}
          </div>
        </div>
      )}

      {/* ORDER CONFIRMED */}
      {screen === 'order-confirmed' && (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🎉</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '26px', marginBottom: '8px' }}>Order placed!</div>
          <div style={{ fontSize: '14px', color: '#6B6560', marginBottom: '32px', lineHeight: 1.6 }}>
            Your payment was successful.<br />The chef has 10 minutes to accept your order.
          </div>
          <button style={{ ...btn, width: 'auto', padding: '12px 32px', marginBottom: '12px' }} onClick={() => setScreen('browse')}>Browse more chefs</button>
        </div>
      )}

      {/* CHEF ONBOARDING */}
      {screen === 'chef-onboarding' && (
        <div style={{ ...card, maxWidth: '500px' }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '22px', marginBottom: '4px' }}>Set up your kitchen</div>
          <div style={{ fontSize: '13px', color: '#6B6560', marginBottom: '24px' }}>Tell customers about your food</div>
          <label style={lbl}>Kitchen name *</label>
          <input style={inp} placeholder="e.g. Maria's Kitchen" value={kitchenName} onChange={e => setKitchenName(e.target.value)} />
          <label style={lbl}>About your kitchen</label>
          <textarea style={ta} placeholder="Tell customers what makes your food special…" value={bio} onChange={e => setBio(e.target.value)} />
          <label style={lbl}>Pickup address *</label>
          <input style={inp} placeholder="Street address" value={address} onChange={e => setAddress(e.target.value)} />
          <input style={inp} placeholder="ZIP code" value={zip} onChange={e => setZip(e.target.value)} />
          <label style={lbl}>Cuisine types</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {cuisineOptions.map(c => <button key={c} style={cBtn(cuisines.includes(c))} onClick={() => toggleCuisine(c)}>{c}</button>)}
          </div>
          <div style={{ background: '#FEF3C7', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#92400E', marginBottom: '6px' }}>Texas Cottage Food Law</div>
            <div style={{ fontSize: '12px', color: '#92400E', lineHeight: 1.5, marginBottom: '10px' }}>By using Homeplate, you confirm your food business complies with the Texas Cottage Food Law.</div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input type="checkbox" checked={attestation} onChange={e => setAttestation(e.target.checked)} style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', color: '#92400E' }}>I confirm my kitchen complies with Texas Cottage Food Law *</span>
            </label>
          </div>
          {message && <div style={msgBox(isError)}>{message}</div>}
          <button style={btn} onClick={saveChefProfile} disabled={loading}>{loading ? 'Saving…' : 'Launch my kitchen →'}</button>
        </div>
      )}

      {/* CHEF PORTAL */}
      {screen === 'chef-portal' && chefProfile && (
        <div>
          <div style={{ background: '#2C1A0E', color: '#fff', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', fontWeight: 700 }}>{chefProfile.kitchen_name}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>{chefProfile.city}, {chefProfile.state}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: chefProfile.is_open ? '#4CAF50' : 'rgba(255,255,255,0.4)' }}>{chefProfile.is_open ? 'Open' : 'Closed'}</span>
                <div onClick={toggleOpen} style={{ width: '44px', height: '24px', borderRadius: '99px', background: chefProfile.is_open ? '#4CAF50' : '#555', cursor: 'pointer', position: 'relative', transition: 'background .3s' }}>
                  <div style={{ position: 'absolute', top: '2px', left: chefProfile.is_open ? '22px' : '2px', width: '20px', height: '20px', background: '#fff', borderRadius: '50%', transition: 'left .3s' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', borderBottom: '1px solid #E8DDD4', display: 'flex', overflowX: 'auto', padding: '0 8px' }}>
           {[['orders', `🔔 Orders${incomingOrders.length > 0 ? ` (${incomingOrders.length})` : ''}`], ['dashboard', '📊 Dashboard'], ['menu', '🍽️ Menu'], ['hours', '🕐 Hours']].map(([id, label]) => (
              <button key={id} style={tabS(portalTab === id)} onClick={() => setPortalTab(id)}>{label}</button>
            ))}
          </div>
{portalTab === 'orders' && (
  <div style={{ padding: '20px' }}>
    {incomingOrders.length === 0 && activeOrders.length === 0 && (
      <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: '14px', border: '1px solid #E8DDD4' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🍽️</div>
        <div style={{ fontWeight: 500, marginBottom: '6px' }}>No orders yet</div>
        <div style={{ fontSize: '13px', color: '#6B6560' }}>New orders will appear here instantly</div>
      </div>
    )}

    {incomingOrders.length > 0 && (
      <>
        <div style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: '#C4622D', marginBottom: '12px' }}>⏱ Needs response</div>
        {incomingOrders.map(order => (
          <div key={order.id} style={{ background: '#fff', border: '2px solid #C4622D', borderRadius: '14px', padding: '16px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{order.profiles?.full_name || 'Customer'}</div>
                <div style={{ fontSize: '12px', color: '#6B6560', marginTop: '2px' }}>
                  {new Date(order.placed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: '16px', color: '#2C1A0E' }}>${parseFloat(order.chef_payout).toFixed(2)}</div>
                <div style={{ fontSize: '11px', color: '#2D5016' }}>your earnings</div>
              </div>
            </div>
            <OrderCountdown expiresAt={order.expires_at} onExpire={() => loadOrders(session.user.id)} />
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button
                onClick={() => acceptOrder(order.id)}
                style={{ flex: 1, padding: '12px', borderRadius: '99px', border: 'none', background: '#2D5016', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >Accept ✓</button>
              <button
                onClick={() => declineOrder(order.id)}
                style={{ flex: 1, padding: '12px', borderRadius: '99px', border: '1.5px solid #E8DDD4', background: '#fff', color: '#6B6560', fontSize: '14px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >Decline</button>
            </div>
          </div>
        ))}
      </>
    )}

    {activeOrders.length > 0 && (
      <>
        <div style={{ fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6B6560', marginBottom: '12px', marginTop: incomingOrders.length > 0 ? '20px' : '0' }}>Active orders</div>
        {activeOrders.map(order => (
          <div key={order.id} style={{ background: '#fff', border: '1px solid #E8DDD4', borderRadius: '14px', padding: '16px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{order.profiles?.full_name || 'Customer'}</div>
                <div style={{ fontSize: '12px', color: '#6B6560', marginTop: '2px' }}>
                  {new Date(order.placed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 500, padding: '4px 10px', borderRadius: '99px', background: order.status === 'ready' ? '#FEF3C7' : '#EAF0E0', color: order.status === 'ready' ? '#92400E' : '#2D5016' }}>
                {order.status === 'ready' ? 'Ready for pickup' : 'Cooking'}
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#C4622D', marginBottom: '12px' }}>${parseFloat(order.chef_payout).toFixed(2)} earnings</div>
            {order.status === 'accepted' && (
              <button
                onClick={() => markReady(order.id)}
                style={{ width: '100%', padding: '11px', borderRadius: '99px', border: 'none', background: '#2C1A0E', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
              >Mark as ready for pickup</button>
            )}
            {order.status === 'ready' && (
              <div style={{ textAlign: 'center', fontSize: '13px', color: '#92400E', fontWeight: 500 }}>⏳ Waiting for customer pickup</div>
            )}
          </div>
        ))}
      </>
    )}

    <button onClick={() => loadOrders(session.user.id)} style={{ width: '100%', padding: '11px', borderRadius: '99px', border: '1.5px solid #E8DDD4', background: '#fff', color: '#6B6560', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', marginTop: '12px' }}>
      🔄 Refresh orders
    </button>
  </div>
)}
          {portalTab === 'dashboard' && (
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                {[['0', 'Orders today'], ['$0', 'Earnings today'], [String(chefProfile.rating || '—'), 'Rating'], [String(chefProfile.review_count || '0'), 'Reviews']].map(([val, label]) => (
                  <div key={label} style={{ background: '#fff', border: '1px solid #E8DDD4', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '26px', fontWeight: 700, color: '#2C1A0E' }}>{val}</div>
                    <div style={{ fontSize: '11px', color: '#6B6560', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: '3px' }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', border: '1px solid #E8DDD4', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
                <div style={{ fontWeight: 500, marginBottom: '10px' }}>Setup checklist</div>
                <div style={{ fontSize: '13px', color: '#6B6560', lineHeight: 2 }}>
                  <span style={{ color: '#2D5016' }}>✅</span> Kitchen profile created<br />
                  <span onClick={() => setPortalTab('menu')} style={{ cursor: 'pointer', color: menuItems.length > 0 ? '#2D5016' : '#C4622D' }}>
                    {menuItems.length > 0 ? '✅' : '◻'} Add menu items {menuItems.length > 0 ? `(${menuItems.length} added)` : '→ tap Menu tab'}
                  </span><br />
                  <span onClick={() => setPortalTab('hours')} style={{ cursor: 'pointer', color: '#C4622D' }}>◻ Set your weekly hours → tap Hours tab</span><br />
                  <span style={{ color: '#6B6560' }}>◻ Connect Stripe to receive payments (coming soon)</span>
                </div>
              </div>
              <div style={{ background: '#EAF0E0', border: '1px solid #C0DD97', borderRadius: '12px', padding: '14px' }}>
                <div style={{ fontSize: '13px', color: '#2D5016', fontWeight: 500, marginBottom: '4px' }}>Kitchen details</div>
                <div style={{ fontSize: '12px', color: '#3B6D11', lineHeight: 1.6 }}>
                  📍 {chefProfile.address_line}, {chefProfile.city}, TX {chefProfile.zip}<br />
                  🍽️ {chefProfile.cuisine_types?.join(', ') || 'No cuisines set yet'}
                </div>
              </div>
            </div>
          )}

          {portalTab === 'menu' && (
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px' }}>Your menu</div>
                  <div style={{ fontSize: '12px', color: '#6B6560', marginTop: '2px' }}>{menuItems.length} item{menuItems.length !== 1 ? 's' : ''}</div>
                </div>
                <button style={{ ...btn, width: 'auto', padding: '9px 18px', marginBottom: 0, fontSize: '13px' }} onClick={openNewItemForm}>+ Add dish</button>
              </div>
              {showMenuForm && (
                <div style={{ background: '#fff', border: '2px solid #C4622D', borderRadius: '14px', padding: '20px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: 500, marginBottom: '14px', fontSize: '15px' }}>{editingItem ? 'Edit dish' : 'Add new dish'}</div>
                  <label style={lbl}>Dish name *</label>
                  <input style={inp} placeholder="e.g. Beef Enchiladas" value={itemName} onChange={e => setItemName(e.target.value)} />
                  <label style={lbl}>Description</label>
                  <textarea style={ta} placeholder="What's in it? What makes it special?" value={itemDesc} onChange={e => setItemDesc(e.target.value)} />
                  <label style={lbl}>Price *</label>
                  <input style={inp} placeholder="e.g. 12.00" type="number" step="0.01" value={itemPrice} onChange={e => setItemPrice(e.target.value)} />
                  {message && <div style={msgBox(isError)}>{message}</div>}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button style={btn} onClick={saveMenuItem} disabled={loading}>{loading ? 'Saving…' : editingItem ? 'Save changes' : 'Add to menu'}</button>
                    <button style={btnO} onClick={() => { setShowMenuForm(false); setMessage('') }}>Cancel</button>
                  </div>
                </div>
              )}
              {menuItems.length === 0 && !showMenuForm && (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: '14px', border: '1px solid #E8DDD4' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🍽️</div>
                  <div style={{ fontWeight: 500, marginBottom: '6px' }}>No dishes yet</div>
                  <div style={{ fontSize: '13px', color: '#6B6560', marginBottom: '16px' }}>Add your first dish to get started</div>
                  <button style={{ ...btn, width: 'auto', padding: '10px 24px', marginBottom: 0 }} onClick={openNewItemForm}>+ Add first dish</button>
                </div>
              )}
              {menuItems.map(item => (
                <div key={item.id} style={{ background: '#fff', border: '1px solid #E8DDD4', borderRadius: '12px', padding: '14px', marginBottom: '10px', opacity: item.is_available ? 1 : 0.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '3px' }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: '12px', color: '#6B6560', lineHeight: 1.4, marginBottom: '6px' }}>{item.description}</div>}
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#C4622D' }}>${parseFloat(item.price).toFixed(2)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      <button onClick={() => toggleItemAvailability(item)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #E8DDD4', background: item.is_available ? '#EAF0E0' : '#F3F4F6', color: item.is_available ? '#2D5016' : '#6B7280', fontSize: '11px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                        {item.is_available ? 'Available' : 'Hidden'}
                      </button>
                      <button onClick={() => openEditItemForm(item)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #E8DDD4', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => deleteMenuItem(item.id)} style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #FCEBEB', background: '#FCEBEB', fontSize: '12px', cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {portalTab === 'hours' && (
            <div style={{ padding: '20px' }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', marginBottom: '6px' }}>Weekly hours</div>
              <div style={{ fontSize: '13px', color: '#6B6560', marginBottom: '16px' }}>Use the open/closed toggle above to override at any time</div>
              <div style={{ background: '#fff', border: '1px solid #E8DDD4', borderRadius: '14px', overflow: 'hidden' }}>
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => {
                  const defaultOpen = [3, 4, 5, 6].includes(i)
                  return (
                    <div key={day} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: i < 6 ? '1px solid #E8DDD4' : 'none' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500, width: '100px' }}>{day}</span>
                      <span style={{ fontSize: '13px', color: '#6B6560', flex: 1 }}>{defaultOpen ? '5:00 PM – 9:00 PM' : 'Closed'}</span>
                      <div style={{ width: '36px', height: '20px', borderRadius: '99px', background: defaultOpen ? '#4CAF50' : '#E8DDD4', position: 'relative', cursor: 'pointer' }}>
                        <div style={{ position: 'absolute', top: '2px', left: defaultOpen ? '18px' : '2px', width: '16px', height: '16px', background: '#fff', borderRadius: '50%' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: '14px', background: '#FEF3C7', borderRadius: '12px', padding: '13px', fontSize: '12px', color: '#92400E' }}>
                ⚠️ Editable hours coming in the next update. Use the open/closed toggle at the top to control when you accept orders.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
