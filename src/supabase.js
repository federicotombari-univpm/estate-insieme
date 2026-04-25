import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = "https://qsvhmwhmhncblaavaqtk.supabase.co"
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzdmhtd2htaG5jYmxhYXZhcXRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMzEwMDcsImV4cCI6MjA5MjYwNzAwN30.Go0A-guVzVcE7td8340pJwXSnPvGBTiRsZ7N6rXGG0E"

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON)

export async function getMembers(){ const {data}=await sb.from("members").select("*"); return data||[] }
export async function getEvents(){  const {data}=await sb.from("events").select("*");  return data||[] }
export async function upsertMember(m){ await sb.from("members").upsert(m) }
export async function upsertEvent(e){  await sb.from("events").upsert(e)  }
export async function deleteEventDB(id){ await sb.from("events").delete().eq("id",id) }
