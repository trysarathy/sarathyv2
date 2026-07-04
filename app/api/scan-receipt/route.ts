import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { getAuthenticatedUser } from '@/lib/supabase-server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { imageBase64 } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: 'No image' }, { status: 400 })
    const completion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          { type: 'text', text: 'Extract from this receipt: total amount, merchant name, and category (Food/Transport/Social/Home/Family/Shopping/Health/Education/Entertainment/Other). Return ONLY JSON: {"amount": 12.50, "merchant": "McDonaldss", "category": "Food"}' }
        ]
      }],
    })
    const raw = completion.choices[0]?.message?.content || '{}'
    const cleaned = raw.replace(/```json|```/g, '').trim()
    return NextResponse.json(JSON.parse(cleaned))
  } catch {
    return NextResponse.json({ amount: null, merchant: 'Could not read receipt', category: 'Other' })
  }
}
