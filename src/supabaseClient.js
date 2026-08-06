import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function loadJSON(key, fallback) {
  try {
    const { data, error } = await supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error) throw error
    return { ok: true, value: data ? data.value : fallback }
  } catch (e) {
    console.error('loadJSON failed', key, e)
    return { ok: false, value: fallback }
  }
}

export async function saveJSON(key, value, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { error } = await supabase.from('app_data').upsert({ key, value })
      if (error) throw error
      return true
    } catch (e) {
      if (attempt === retries) {
        console.error('saveJSON failed', key, e)
        return false
      }
      await new Promise((r) => setTimeout(r, 350))
    }
  }
  return false
}
