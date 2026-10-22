import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
)

interface FilaResumen {
  provincia: string
  tecnico: string
  servicios: number
  total: number
}

const normalizar = (s: string) =>
  s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

const listarDias = (desde: string, hasta: string) => {
  const dias: string[] = []
  const [y1, m1, d1] = desde.split('-').map(Number)
  const [y2, m2, d2] = hasta.split('-').map(Number)
  const cur = new Date(Date.UTC(y1, m1 - 1, d1))
  const fin = new Date(Date.UTC(y2, m2 - 1, d2))
  while (cur.getTime() <= fin.getTime()) {
    dias.push(cur.toISOString().split('T')[0])
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dias
}

export async function POST(req: Request) {
  try {
    const { accion, filas, fechaDesde, fechaHasta } = (await req.json()) as {
      accion: 'preview' | 'importar'
      filas: FilaResumen[]
      fechaDesde: string
      fechaHasta: string
    }

    if (!filas?.length || !fechaDesde || !fechaHasta) {
      return NextResponse.json({ error: 'Faltan filas o fechas' }, { status: 400 })
    }

    const dias = listarDias(fechaDesde, fechaHasta)
    if (dias.length === 0) return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 })

    const { data: empleados } = await supabase.from('empleados').select('id, nombre_completo')
    const empList = (empleados || []).map(e => ({
      id: e.id as string,
      nombre: e.nombre_completo as string,
      tokens: normalizar(e.nombre_completo as string)
    }))

    // 🔧 MATCHING POR CONTENCIÓN: exigimos que TODOS los tokens del nombre
    // del archivo estén dentro del nombre oficial (cont = 1).
    // Jaccard solo desempata si varios empleados contienen el nombre.
    const matches = filas.map(f => {
      const tokens = normalizar(f.tecnico)
      let mejor: { id: string; nombre: string } | null = null
      let mejorKey = -1
      let mejorScore = 0

      for (const e of empList) {
        if (!e.tokens.length || !tokens.length) continue
        const setE = new Set(e.tokens)
        const inter = tokens.filter(t => setE.has(t)).length
        const cont = inter / Math.min(tokens.length, e.tokens.length)
        const union = new Set([...tokens, ...e.tokens]).size
        const jac = union > 0 ? inter / union : 0
        const key = cont * 1000 + jac
        if (cont >= 0.999 && key > mejorKey) {
          mejorKey = key
          mejor = e
          mejorScore = 1
        }
      }

      // Si no hubo contención perfecta, devolvemos el mejor cont posible
      // para que el preview muestre cuán cerca quedó (debug visual).
      if (!mejor) {
        let bestCont = 0
        for (const e of empList) {
          if (!e.tokens.length || !tokens.length) continue
          const setE = new Set(e.tokens)
          const inter = tokens.filter(t => setE.has(t)).length
          const cont = inter / Math.min(tokens.length, e.tokens.length)
          if (cont > bestCont) bestCont = cont
        }
        mejorScore = Math.round(bestCont * 100) / 100
      }

      return { fila: f, emp: mejor, score: mejorScore }
    })

    if (accion === 'preview') {
      return NextResponse.json({
        dias: dias.length,
        matches: matches.map(m => ({
          tecnico: m.fila.tecnico,
          provincia: m.fila.provincia,
          servicios: m.fila.servicios,
          total: m.fila.total,
          empleado_id: m.emp?.id || null,
          empleado: m.emp?.nombre || null,
          score: m.score
        }))
      })
    }

    // IMPORTAR: idempotente — borra acumulados previos del mismo rango
    const { error: delErr } = await supabase
      .from('actividades_diarias')
      .delete()
      .eq('origen', 'acumulado')
      .gte('fecha_actividad', fechaDesde)
      .lte('fecha_actividad', fechaHasta)
    if (delErr) throw delErr

    const inserts: Record<string, unknown>[] = []
    for (const m of matches) {
      if (!m.emp) continue
      const S = Math.round(m.fila.servicios)
      const T = Number(m.fila.total)
      if (S <= 0 || !isFinite(T)) continue
      const precioBase = Math.round((T / S) * 100) / 100
      let acum = 0
      for (let i = 0; i < S; i++) {
        const precio = i === S - 1 ? Math.round((T - acum) * 100) / 100 : precioBase
        acum = Math.round((acum + precio) * 100) / 100
        const fecha = dias[Math.floor((i * dias.length) / S)]
        inserts.push({
          empleado_id: m.emp.id,
          tecnico_nombre: m.fila.tecnico,
          provincia: m.fila.provincia || null,
          centro: null,
          precio,
          fecha_actividad: fecha,
          origen: 'acumulado'
        })
      }
    }

    let insertadas = 0
    for (let i = 0; i < inserts.length; i += 500) {
      const chunk = inserts.slice(i, i + 500)
      const { error } = await supabase.from('actividades_diarias').insert(chunk)
      if (error) throw error
      insertadas += chunk.length
    }

    return NextResponse.json({
      ok: true,
      insertadas,
      dias: dias.length,
      sinMatch: matches.filter(m => !m.emp).map(m => m.fila.tecnico)
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error interno' }, { status: 500 })
  }
}